'use strict';
//
// Tests for run-no-regression-eval.mjs — the M1 no-regression trust-gate scorer.
// Zero-dep: node:test + node:assert only. Run: node --test run-no-regression-eval.test.mjs
//
// Marquee tests: `self-test reproduces baseline.json` (the Tier-1 offline gate);
// `RED: broken normalization floors recall at 0` (normalization is load-bearing);
// and `over-escalation … is a false positive` (a noisier-than-baseline engine
// must not pass — the precision hole the adversarial audit found).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseFixtureHunkMap,
  normalizeLine,
  loadGold,
  loadBaseline,
  parseTranscriptMarkdown,
  parseFindingBlocks,
  parseFindingsJson,
  parseRunFindings,
  scoreRun,
  aggregate,
  scoreBaselineTranscripts,
  MATCH_TOLERANCE,
} from './run-no-regression-eval.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = join(HERE, 'benchmark');
const FIXTURE = readFileSync(join(BENCH, 'task-diff.fixture'), 'utf8');
const HUNK_MAP = parseFixtureHunkMap(FIXTURE);
const GOLD = loadGold();
const BASELINE = loadBaseline();

const F_DISCOUNT = 'src/discount-engine.js';
const F_CHECKOUT = 'src/checkout.js';
const F_CURRENCY = 'src/currency.js';

// Build a finding whose cited (diff-text) line normalizes to `source` for `file`.
function citeSource(file, source, severity) {
  return { file, citedLine: source + HUNK_MAP[file].hunkStartLine, severity };
}

// ─── Fixture hunk map ────────────────────────────────────────────────────────

test('fixture hunk map: per-file @@-header line numbers', () => {
  assert.equal(HUNK_MAP[F_DISCOUNT].hunkStartLine, 24);
  assert.equal(HUNK_MAP[F_CHECKOUT].hunkStartLine, 81);
  assert.equal(HUNK_MAP[F_CURRENCY].hunkStartLine, 128);
  assert.equal(HUNK_MAP[F_DISCOUNT].fileLength, 48);
  assert.equal(HUNK_MAP[F_CHECKOUT].fileLength, 41);
  assert.equal(HUNK_MAP[F_CURRENCY].fileLength, 23);
});

test('normalizeLine: cited diff-text line → post-image source line', () => {
  assert.equal(normalizeLine(49, F_DISCOUNT, HUNK_MAP), 25); // null-deref
  assert.equal(normalizeLine(62, F_DISCOUNT, HUNK_MAP), 38); // borderline
  assert.equal(normalizeLine(98, F_CHECKOUT, HUNK_MAP), 17); // missing-await
  assert.equal(normalizeLine(112, F_CHECKOUT, HUNK_MAP), 31); // swallowed (±1 of gold 32)
  assert.equal(normalizeLine(141, F_CURRENCY, HUNK_MAP), 13); // currency
  assert.equal(normalizeLine(5, 'src/nope.js', HUNK_MAP), null); // unknown file
});

// ─── THE Tier-1 self-test: reproduce baseline.json ──────────────────────────

test('self-test: scorer reproduces baseline.json from committed transcripts', () => {
  const results = scoreBaselineTranscripts({ gold: GOLD, hunkMap: HUNK_MAP });
  assert.equal(results.length, BASELINE.per_run.length);
  results.forEach((r, i) => {
    const b = BASELINE.per_run[i];
    assert.ok(
      Math.abs(r.critical_recall - b.critical_recall) < 1e-9,
      `run ${i + 1} recall ${r.critical_recall} != baseline ${b.critical_recall}`,
    );
    assert.equal(r.caught_criticals, b.caught_criticals, `run ${i + 1} caught`);
    assert.equal(r.missed_criticals, b.missed_criticals, `run ${i + 1} missed`);
    assert.equal(r.false_positives, b.false_positives, `run ${i + 1} fp`);
    assert.equal(r.false_clean, false, `run ${i + 1} must not be false-clean`);
    assert.equal(r.coordinate_warning, false, `run ${i + 1} must not trip a convention warning`);
  });
  const verdict = aggregate(results, BASELINE);
  assert.equal(verdict.pass, true);
  assert.ok(Math.abs(verdict.worst_run_critical_recall - 2 / 3) < 1e-9);
  assert.equal(verdict.worst_run_false_positives, 0);
  assert.equal(verdict.warnings.length, 0);
});

// ─── Calibration probe: full vs partial (the borderline Critical) ────────────

test('calibration probe: borderline scored Important → PARTIAL, not caught', () => {
  const r = scoreRun([citeSource(F_DISCOUNT, 38, 'important')], GOLD, HUNK_MAP);
  assert.equal(r.caught_criticals, 0);
  assert.equal(r.partials.length, 1);
  assert.equal(r.partials[0].goldId, 'gf-borderline-critical');
  assert.equal(r.partials[0].reviewerTier, 'important');
  assert.equal(r.partials[0].goldTier, 'critical');
  assert.equal(r.false_positives, 0); // an Important is never a critical FP
});

test('calibration probe: borderline scored Critical → FULL match, caught', () => {
  const r = scoreRun([citeSource(F_DISCOUNT, 38, 'critical')], GOLD, HUNK_MAP);
  assert.equal(r.caught_criticals, 1);
  assert.deepEqual(r.caught_ids, ['gf-borderline-critical']);
  assert.equal(r.false_positives, 0); // it full-matched a gold Critical
});

// ─── Precision: over-escalation is a false positive (adversarial-audit hole) ──

test('over-escalation: a Critical on a non-Critical gold line IS a false positive', () => {
  // Critical fired at the naming SUGGESTION line (46) and the await IMPORTANT line (17).
  const r = scoreRun(
    [citeSource(F_DISCOUNT, 46, 'critical'), citeSource(F_CHECKOUT, 17, 'critical')],
    GOLD,
    HUNK_MAP,
  );
  assert.equal(r.caught_criticals, 0); // neither is a gold Critical
  assert.equal(r.false_positives, 2); // both are over-escalations → FPs
});

test('over-escalation: a 2/3-recall run that over-fires Criticals FAILS on precision', () => {
  // The exact exploit the audit constructed: real recall ≥ baseline, but a bogus
  // Critical sprayed onto the naming Suggestion. Must NOT pass.
  const run = scoreRun(
    [
      citeSource(F_DISCOUNT, 25, 'critical'), // null-deref (real)
      citeSource(F_CURRENCY, 13, 'critical'), // currency (real) → recall 2/3
      citeSource(F_DISCOUNT, 46, 'critical'), // naming nit escalated to Critical → FP
    ],
    GOLD,
    HUNK_MAP,
  );
  assert.equal(run.caught_criticals, 2);
  assert.ok(Math.abs(run.critical_recall - 2 / 3) < 1e-9); // recall meets baseline
  assert.equal(run.false_positives, 1);
  const v = aggregate([run, run, run], BASELINE);
  assert.equal(v.pass, false); // precision regressed despite recall meeting baseline
  assert.ok(v.reasons.some((x) => x.includes('precision') || x.includes('over-escalation')));
});

// ─── ±3 tolerance boundary ───────────────────────────────────────────────────

test('±3 tolerance: source within 3 of a gold Critical matches; 4 does not', () => {
  assert.equal(scoreRun([citeSource(F_DISCOUNT, 28, 'critical')], GOLD, HUNK_MAP).caught_criticals, 1); // dist 3
  const miss = scoreRun([citeSource(F_DISCOUNT, 29, 'critical')], GOLD, HUNK_MAP); // dist 4 from 25
  assert.equal(miss.caught_criticals, 0);
  assert.equal(miss.false_positives, 1); // unmatched Critical → FP
  assert.equal(MATCH_TOLERANCE, 3);
});

// ─── False-clean / skip-if-clean probe ───────────────────────────────────────

test('false-clean: a run with zero Critical findings fails the gate', () => {
  const r = scoreRun(
    [citeSource(F_CHECKOUT, 17, 'important'), citeSource(F_DISCOUNT, 46, 'suggestion')],
    GOLD,
    HUNK_MAP,
  );
  assert.equal(r.false_clean, true);
  assert.equal(r.caught_criticals, 0);
  const v = aggregate([r], BASELINE);
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((x) => x.includes('clean')));
});

test('skip-if-clean probe: missing the SEPARATE-file currency Critical lowers recall', () => {
  const r = scoreRun(
    [citeSource(F_DISCOUNT, 25, 'critical'), citeSource(F_DISCOUNT, 38, 'critical')],
    GOLD,
    HUNK_MAP,
  );
  assert.equal(r.caught_criticals, 2);
  assert.equal(r.false_clean, false);
  assert.ok(Math.abs(r.critical_recall - 2 / 3) < 1e-9);
});

// ─── False positives / precision (hallucinated Critical) ─────────────────────

test('false positive: a Critical citing a non-gold line regresses precision', () => {
  const r = scoreRun(
    [
      citeSource(F_DISCOUNT, 25, 'critical'),
      citeSource(F_DISCOUNT, 38, 'critical'),
      citeSource(F_CURRENCY, 13, 'critical'), // 3/3 recall
      citeSource(F_CHECKOUT, 39, 'critical'), // beyond the file, no gold → FP
    ],
    GOLD,
    HUNK_MAP,
  );
  assert.equal(r.caught_criticals, 3);
  assert.equal(r.false_positives, 1);
  const v = aggregate([r], BASELINE);
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((x) => x.includes('precision') || x.includes('false-positive')));
});

// ─── RED mutation: normalization is load-bearing ─────────────────────────────

test('RED: broken normalization (zero offsets) floors Critical-recall at 0', () => {
  const run1 = parseTranscriptMarkdown(readFileSync(join(BENCH, 'baseline-transcripts', 'run-1.md'), 'utf8'));
  assert.equal(scoreRun(run1, GOLD, HUNK_MAP).caught_criticals, 2); // real map: 2 criticals
  const brokenMap = {
    [F_DISCOUNT]: { hunkStartLine: 0, fileLength: 48 },
    [F_CHECKOUT]: { hunkStartLine: 0, fileLength: 41 },
    [F_CURRENCY]: { hunkStartLine: 0, fileLength: 23 },
  };
  const broken = scoreRun(run1, GOLD, brokenMap);
  assert.equal(broken.caught_criticals, 0);
  assert.equal(broken.critical_recall, 0);
});

// ─── Coordinate-convention detection (source-cited transcript) ───────────────

test('coordinate_warning: a transcript citing post-image source lines is flagged', () => {
  const sourceCited = [
    { file: F_DISCOUNT, citedLine: 25, severity: 'critical' }, // should be 49 as diff-text
    { file: F_DISCOUNT, citedLine: 38, severity: 'critical' },
    { file: F_CURRENCY, citedLine: 13, severity: 'critical' },
  ];
  const r = scoreRun(sourceCited, GOLD, HUNK_MAP);
  assert.equal(r.caught_criticals, 0); // wrong under the diff-text contract
  assert.equal(r.coordinate_warning, true); // but cited-as-source catches all 3
  assert.equal(r.shadow_caught_criticals, 3);
  const v = aggregate([r], BASELINE);
  assert.ok(v.warnings.some((w) => w.includes('convention')));
});

// ─── Transcript / JSON / block parsing ───────────────────────────────────────

test('parseFindingsJson: array of objects with severity or score', () => {
  const json = JSON.stringify([
    { file: F_DISCOUNT, line: 49, severity: 'Critical' },
    { file: F_CURRENCY, line: 141, score: 93 }, // tier from score → critical
    { file: F_DISCOUNT, line: 70, severity: 'Suggestion' },
  ]);
  const findings = parseFindingsJson(json);
  assert.equal(findings.length, 3);
  assert.equal(findings[1].severity, 'critical');
  assert.equal(scoreRun(findings, GOLD, HUNK_MAP).caught_criticals, 2);
});

test('parseFindingsJson: malformed JSON throws (caller must catch, never silent)', () => {
  assert.throws(() => parseFindingsJson('[{"file":"a","line":1,'), SyntaxError);
  assert.throws(() => parseRunFindings('{ not valid json', '.json'));
});

test('parseFindingBlocks: the engine native `### [tier] … **Location:**` format', () => {
  const blocks = [
    '### [Critical] Null deref in applyDiscount',
    '**Confidence:** 95/100',
    '**Location:** src/discount-engine.js:49',
    '**Issue:** coupon.pct dereferenced after a null lookupCoupon.',
    '',
    '### [Critical] Currency null deref',
    '**Confidence:** 93/100',
    '**Location:** src/currency.js:141',
    '**Issue:** raw.replace on null input.',
    '',
  ].join('\n');
  const findings = parseFindingBlocks(blocks);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].file, F_DISCOUNT);
  assert.equal(findings[0].citedLine, 49);
  assert.equal(findings[0].severity, 'critical');
  assert.equal(scoreRun(findings, GOLD, HUNK_MAP).caught_criticals, 2);
  // parseRunFindings dispatches to blocks when the text is not a table/JSON.
  assert.equal(parseRunFindings(blocks).length, 2);
});

test('parseRunFindings: dispatches md table vs json by content', () => {
  const md = readFileSync(join(BENCH, 'baseline-transcripts', 'run-3.md'), 'utf8');
  assert.equal(parseRunFindings(md).length > 0, true);
  assert.equal(parseRunFindings('[{"file":"a","line":1,"severity":"Critical"}]').length, 1);
});

test('parseTranscriptMarkdown uses the CITED column, never the Source-line column', () => {
  const findings = parseTranscriptMarkdown(
    readFileSync(join(BENCH, 'baseline-transcripts', 'run-3.md'), 'utf8'),
  );
  const first = findings.find((f) => f.file === F_DISCOUNT && f.severity === 'critical');
  assert.equal(first.citedLine, 49);
  assert.equal(normalizeLine(first.citedLine, first.file, HUNK_MAP), 25);
});

// ─── Aggregate gating ────────────────────────────────────────────────────────

test('aggregate: a regressed run (1/3 recall) fails on recall', () => {
  const regressed = scoreRun([citeSource(F_DISCOUNT, 25, 'critical')], GOLD, HUNK_MAP);
  assert.ok(Math.abs(regressed.critical_recall - 1 / 3) < 1e-9);
  assert.equal(regressed.false_clean, false);
  const v = aggregate([regressed], BASELINE);
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((x) => x.includes('recall')));
});

test('aggregate: worst-of-N takes the minimum recall across runs', () => {
  const good = scoreRun(
    [citeSource(F_DISCOUNT, 25, 'critical'), citeSource(F_DISCOUNT, 38, 'critical'), citeSource(F_CURRENCY, 13, 'critical')],
    GOLD,
    HUNK_MAP,
  ); // 3/3
  const meets = scoreRun(
    [citeSource(F_DISCOUNT, 25, 'critical'), citeSource(F_CURRENCY, 13, 'critical')],
    GOLD,
    HUNK_MAP,
  ); // 2/3
  const v = aggregate([good, meets], BASELINE);
  assert.ok(Math.abs(v.worst_run_critical_recall - 2 / 3) < 1e-9);
  assert.equal(v.worst_run_index, 1);
  assert.equal(v.pass, true);
});

test('aggregate: empty run set never passes and exposes an iterable reasons array', () => {
  const v = aggregate([], BASELINE);
  assert.equal(v.pass, false);
  assert.ok(Array.isArray(v.reasons));
  assert.ok(v.reasons.length >= 1);
  assert.ok(Array.isArray(v.warnings));
});

test('aggregate: a run-level error is a hard fail with an explicit reason', () => {
  const errored = { file: 'broken.json', error: 'could not read/parse run (bad json)', critical_recall: 0, false_positives: 0, false_clean: true };
  const v = aggregate([errored], BASELINE);
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((x) => x.includes('broken.json')));
});

// ─── Benchmark invariant the scorer relies on ────────────────────────────────

test('gold lines within a file are > 2×tolerance apart (nearest-match unambiguous)', () => {
  const byFile = {};
  for (const g of GOLD.defects) (byFile[g.file] ??= []).push(g.line);
  for (const [file, lines] of Object.entries(byFile)) {
    const sorted = [...lines].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i] - sorted[i - 1] > 2 * MATCH_TOLERANCE,
        `${file}: gold lines ${sorted[i - 1]} & ${sorted[i]} within 2×tolerance — nearest-match could mis-assign`,
      );
    }
  }
});
