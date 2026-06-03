// consensus-aggregate.test.mjs — the precision stage proven during the M1 engine
// de-risk (2026-06-03): a Critical-tier reviewer finding survives ONLY if ≥2
// distinct reviewers independently tier a Critical within ±tolerance lines (same
// file); otherwise it is demoted to Important. This replaces the precision-fragile
// max-over-reviewers aggregation that let one reviewer's stochastic over-escalation
// fail the no-regression gate (FP≤0).
//
// Zero-dep: node:test / node:assert only. RED-capable — a broken consensus rule
// (e.g. keeping lone criticals) MUST turn a test red.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { consensusAggregate } from '../lib/consensus-aggregate.mjs';

const crit = (file, line, extra = {}) => ({ file, line, severity: 'critical', score: 95, description: `c-${file}-${line}`, ...extra });
const imp = (file, line, extra = {}) => ({ file, line, severity: 'important', score: 85, description: `i-${file}-${line}`, ...extra });
const sug = (file, line, extra = {}) => ({ file, line, severity: 'suggestion', score: 50, description: `s-${file}-${line}`, ...extra });

const tierOf = (findings, file, line, tol = 0) =>
  findings
    .filter((f) => f.file === file && Math.abs(Number(f.line) - line) <= tol)
    .map((f) => f.severity);

test('two reviewers agree on a Critical at the same line → stays Critical', () => {
  const out = consensusAggregate([[crit('a.js', 49)], [crit('a.js', 49)]]);
  const crits = out.filter((f) => f.severity === 'critical');
  assert.equal(crits.length, 1, 'deduped to one Critical');
  assert.equal(crits[0].file, 'a.js');
  assert.equal(Number(crits[0].line), 49);
});

test('a LONE Critical (one reviewer) is demoted to Important', () => {
  const out = consensusAggregate([[crit('a.js', 98)], [imp('a.js', 98)], [imp('a.js', 98)]]);
  assert.equal(out.filter((f) => f.severity === 'critical').length, 0, 'no surviving Critical');
  // the location is still present, as Important
  assert.ok(out.some((f) => f.file === 'a.js' && Number(f.line) === 98 && f.severity === 'important'));
});

test('Critical citations that DRIFT within ±tolerance still corroborate', () => {
  // reviewer A @49, reviewer B @51 — each within ±3 of the other → both ≥2 votes
  const out = consensusAggregate([[crit('a.js', 49)], [crit('a.js', 51)]]);
  const crits = out.filter((f) => f.severity === 'critical');
  assert.equal(crits.length, 2, 'both survive as Critical (drift within tolerance)');
});

test('Critical citations beyond ±tolerance do NOT corroborate → both demoted', () => {
  const out = consensusAggregate([[crit('a.js', 49)], [crit('a.js', 60)]]);
  assert.equal(out.filter((f) => f.severity === 'critical').length, 0, 'no lone Critical survives');
});

test('different files never cross-corroborate', () => {
  const out = consensusAggregate([[crit('a.js', 49)], [crit('b.js', 49)]]);
  assert.equal(out.filter((f) => f.severity === 'critical').length, 0, 'same line, different file ≠ consensus');
});

test('non-Critical findings pass through unchanged', () => {
  const out = consensusAggregate([[imp('a.js', 10)], [sug('b.js', 20)]]);
  assert.ok(out.some((f) => f.file === 'a.js' && f.severity === 'important'));
  assert.ok(out.some((f) => f.file === 'b.js' && f.severity === 'suggestion'));
});

test('exact duplicates collapse (dedup by canonical key)', () => {
  const f = crit('a.js', 49);
  const out = consensusAggregate([[f, { ...f }], [{ ...f }]]);
  assert.equal(out.length, 1, 'identical findings dedup to one');
});

test('critVotes is configurable: critVotes=1 keeps a lone Critical', () => {
  const out = consensusAggregate([[crit('a.js', 98)]], { critVotes: 1 });
  assert.equal(out.filter((f) => f.severity === 'critical').length, 1);
});

test('the de-risk regression: unanimous reals survive, lone over-escalation demoted', () => {
  // mirrors captured run-1: 6 reviewers all Critical @49 and @141; ONE reviewer
  // (sfh) lone-Critical @98 (gold Important). Expect @49 + @141 Critical (deduped
  // to one each), @98 demoted to Important → 2 surviving Criticals, 0 FP-shaped.
  const sfh = [crit('discount-engine.js', 49), crit('currency.js', 141), crit('checkout.js', 98)];
  const others = Array.from({ length: 5 }, () => [crit('discount-engine.js', 49), crit('currency.js', 141), imp('checkout.js', 98)]);
  const out = consensusAggregate([sfh, ...others]);
  const crits = out.filter((f) => f.severity === 'critical');
  assert.equal(crits.length, 2, 'exactly the two unanimous reals survive');
  assert.ok(crits.some((f) => f.file === 'discount-engine.js' && Number(f.line) === 49));
  assert.ok(crits.some((f) => f.file === 'currency.js' && Number(f.line) === 141));
  assert.equal(tierOf(out, 'checkout.js', 98).filter((s) => s === 'critical').length, 0, 'lone @98 over-escalation demoted');
});

test('empty / malformed input never throws', () => {
  assert.deepEqual(consensusAggregate([]), []);
  assert.deepEqual(consensusAggregate(), []);
  assert.deepEqual(consensusAggregate([[], null, undefined]), []);
  const out = consensusAggregate([[{ file: 'a.js', severity: 'critical' /* no line */ }]]);
  // a Critical with no usable line cannot be corroborated → demoted, not crash
  assert.equal(out.filter((f) => f.severity === 'critical').length, 0);
});
