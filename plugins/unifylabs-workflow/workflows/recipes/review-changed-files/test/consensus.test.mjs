// consensus.test.mjs — zero-dep node:test for the review-changed-files pure kernel.
// RED-CAPABLE: pins the Critical-precision consensus arithmetic so a regression in
// the vote count, the ±tolerance window, the demotion, the dedup, or the report
// tallies turns this suite red. CI mutates a kernel line and asserts failure
// (gate-the-gate).
//
// Run: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalKey,
  normalizeFinding,
  consensusAggregate,
  buildReport,
} from '../lib/consensus.mjs';

// ---------------------------------------------------------------------------
// canonicalKey
// ---------------------------------------------------------------------------

test('canonicalKey: identical findings collapse; case/whitespace normalized', () => {
  const a = { file: 'src/a.js', line: 10, severity: 'critical', description: '  Null  Deref ' };
  const b = { file: 'src/a.js', line: 10, severity: 'CRITICAL', description: 'null deref' };
  assert.equal(canonicalKey(a), canonicalKey(b));
});

test('canonicalKey: different line ⇒ different key', () => {
  const a = { file: 'src/a.js', line: 10, severity: 'critical', description: 'x' };
  const b = { file: 'src/a.js', line: 11, severity: 'critical', description: 'x' };
  assert.notEqual(canonicalKey(a), canonicalKey(b));
});

test('canonicalKey: unlocatable line is stable ("?")', () => {
  const a = { file: 'src/a.js', line: null, severity: 'important', description: 'x' };
  assert.match(canonicalKey(a), /:\?:/);
});

// ---------------------------------------------------------------------------
// normalizeFinding
// ---------------------------------------------------------------------------

test('normalizeFinding: unknown severity falls back to suggestion', () => {
  assert.equal(normalizeFinding({ file: 'a', line: 1, severity: 'blocker', description: 'x' }).severity, 'suggestion');
});

test('normalizeFinding: non-numeric line becomes null', () => {
  assert.equal(normalizeFinding({ file: 'a', line: 'nope', severity: 'critical', description: 'x' }).line, null);
});

test('normalizeFinding: valid critical preserved', () => {
  const n = normalizeFinding({ file: 'a', line: 42, severity: 'critical', description: 'x' });
  assert.deepEqual(n, { file: 'a', line: 42, severity: 'critical', description: 'x' });
});

// ---------------------------------------------------------------------------
// consensusAggregate — the load-bearing arithmetic
// ---------------------------------------------------------------------------

test('consensus: a LONE critical (1 vote) is DEMOTED to important', () => {
  const perReviewer = [
    [{ file: 'a.js', line: 50, severity: 'critical', description: 'lone over-escalation' }],
    [{ file: 'a.js', line: 200, severity: 'important', description: 'unrelated' }],
  ];
  const out = consensusAggregate(perReviewer);
  const f = out.find((x) => x.line === 50);
  assert.equal(f.severity, 'important', 'a single reviewer cannot mint a Critical');
});

test('consensus: TWO reviewers within ±tolerance KEEP the critical (drifted lines ok)', () => {
  const perReviewer = [
    [{ file: 'a.js', line: 49, severity: 'critical', description: 'real bug' }],
    [{ file: 'a.js', line: 51, severity: 'critical', description: 'same real bug, drifted line' }],
  ];
  const out = consensusAggregate(perReviewer, { tolerance: 3 });
  assert.ok(out.some((x) => x.severity === 'critical'), 'two votes within ±3 confirm the Critical');
});

test('consensus: two criticals OUTSIDE tolerance are each demoted', () => {
  const perReviewer = [
    [{ file: 'a.js', line: 10, severity: 'critical', description: 'one' }],
    [{ file: 'a.js', line: 99, severity: 'critical', description: 'far away' }],
  ];
  const out = consensusAggregate(perReviewer, { tolerance: 3 });
  assert.equal(out.filter((x) => x.severity === 'critical').length, 0, 'no neighborhood ⇒ no consensus');
});

test('consensus: different FILES never vote for each other', () => {
  const perReviewer = [
    [{ file: 'a.js', line: 10, severity: 'critical', description: 'x' }],
    [{ file: 'b.js', line: 10, severity: 'critical', description: 'x' }],
  ];
  const out = consensusAggregate(perReviewer, { tolerance: 3 });
  assert.equal(out.filter((x) => x.severity === 'critical').length, 0);
});

test('consensus: an unlocatable (null-line) critical cannot vote and is demoted', () => {
  const perReviewer = [
    [{ file: 'a.js', line: null, severity: 'critical', description: 'no line' }],
    [{ file: 'a.js', line: null, severity: 'critical', description: 'also no line' }],
  ];
  const out = consensusAggregate(perReviewer);
  assert.equal(out.filter((x) => x.severity === 'critical').length, 0);
});

test('consensus: identical findings from 2 reviewers dedup to one confirmed critical', () => {
  const perReviewer = [
    [{ file: 'a.js', line: 10, severity: 'critical', description: 'dup' }],
    [{ file: 'a.js', line: 10, severity: 'critical', description: 'dup' }],
  ];
  const out = consensusAggregate(perReviewer);
  const crits = out.filter((x) => x.severity === 'critical');
  assert.equal(crits.length, 1, 'deduped to a single confirmed critical');
});

test('consensus: critVotes is configurable (3 required ⇒ a 2-vote critical demotes)', () => {
  const perReviewer = [
    [{ file: 'a.js', line: 10, severity: 'critical', description: 'x' }],
    [{ file: 'a.js', line: 10, severity: 'critical', description: 'x2' }],
  ];
  const out = consensusAggregate(perReviewer, { critVotes: 3 });
  assert.equal(out.filter((x) => x.severity === 'critical').length, 0);
});

test('consensus: empty / null input never throws', () => {
  assert.deepEqual(consensusAggregate([]), []);
  assert.deepEqual(consensusAggregate(null), []);
  assert.deepEqual(consensusAggregate([null, [null]]), []);
});

// ---------------------------------------------------------------------------
// buildReport
// ---------------------------------------------------------------------------

test('buildReport: tallies by severity and excludes refuted criticals', () => {
  const confirmed = [
    { file: 'a', line: 1, severity: 'critical', description: 'c1' },
    { file: 'a', line: 2, severity: 'critical', description: 'c2' },
    { file: 'a', line: 3, severity: 'important', description: 'i1' },
  ];
  const verdicts = [
    { file: 'a', line: 1, severity: 'critical', description: 'c1', refuted: false },
    { file: 'a', line: 2, severity: 'critical', description: 'c2', refuted: true },
  ];
  const r = buildReport({ diffRange: 'X', dimensions: [{ key: 'correctness' }], confirmed, verdicts });
  assert.equal(r.findings_total, 3);
  assert.deepEqual(r.by_severity, { critical: 2, important: 1, suggestion: 0 });
  assert.equal(r.criticals_confirmed, 1, 'the refuted critical is excluded');
  assert.equal(r.criticals_refuted, 1);
  assert.deepEqual(r.dimensions_run, ['correctness']);
});

test('buildReport: result is frozen', () => {
  const r = buildReport({ diffRange: 'X', dimensions: [], confirmed: [], verdicts: [] });
  assert.ok(Object.isFrozen(r));
});
