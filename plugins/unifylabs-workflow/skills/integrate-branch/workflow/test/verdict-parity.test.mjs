// verdict-parity.test.mjs — the M3 acceptance harness (OD1: reduce-parity, two-gate).
//
// The literal "byte-identical to the CURRENT audit" is unachievable (the current
// audit is prose; consensus + resolveVerifier change D4/D2 BY DESIGN). So we lock
// parity on the deterministic REDUCE:
//   GATE A (parity, byte-identical): on a fixture engineered so consensus +
//     resolveVerifier are INERT, the new pipeline (aggregateD4 / resolveD2Commands
//     → computeAudit) yields a byte-identical composite + route to an INDEPENDENT
//     `legacyReduce` re-encoding of the SKILL.md formulas. Proves zero arithmetic
//     drift in the re-platform.
//   GATE B (documented delta): on divergent fixtures, the consensus + D2 deltas
//     match PRE-REGISTERED golden values derived here (not hand-waved).
//   DISCRIMINATION: a perturbed-weight reduce DIVERGES from legacyReduce on the
//     inert fixture — so Gate A is not vacuous (the P5 CI RED self-test
//     sed-mutates a compute-audit weight and asserts this suite turns red).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAudit, scoreD4 } from '../compute-audit.mjs';
import { aggregateD4, naiveD4, resolveD2Commands, d2Bucket, d2SignalsFromResults } from '../audit-aggregate.mjs';
import { resolveVerifier } from '../lib/verifier-detect.mjs';

// An INDEPENDENT re-encoding of SKILL.md Phase-2/3 (does NOT import compute-audit's
// WEIGHTS) — the parity reference. Same math, different source.
function legacyReduce(sig) {
  const f0 = (n) => Math.max(0, n);
  const s1 = f0(100 - 20 * (sig.d1?.critical || 0) - 10 * (sig.d1?.important || 0));
  const s2 = f0(100 - 40 * (sig.d2?.build_fail || 0) - 30 * (sig.d2?.tsc_fail || 0) - 20 * (sig.d2?.tests_fail || 0) - Math.min(5 * (sig.d2?.untested_new || 0), 30));
  const s3 = f0(100 - 20 * (sig.d3?.drift || 0) - 15 * (sig.d3?.missing_update || 0));
  const s4 = f0(100 - 10 * (sig.d4?.critical || 0) - 4 * (sig.d4?.important || 0));
  const s5 = f0(100 - 15 * (sig.d5?.foundational || 0) - Math.min(5 * (sig.d5?.shared || 0), 30) - 15 * (sig.d5?.adjacent_drift || 0) - 40 * (sig.d5?.migration_conflict || 0));
  const d6app = !!(sig.d6 && sig.d6.applicable);
  const s6 = d6app ? f0(100 - 10 * (sig.d6?.drift || 0)) : 0;
  const sansD6 = 0.3 * s1 + 0.2 * s2 + 0.15 * s3 + 0.1 * s4 + 0.2 * s5;
  const composite = d6app ? sansD6 + 0.05 * s6 : sansD6 / 0.95;
  const route = composite >= 80 ? 'salvage' : composite >= 40 ? 'user-decides' : 'rebuild';
  return { composite, route };
}

// ---------------------------------------------------------------------------
// GATE A — parity on an INERT fixture (consensus + resolveVerifier are no-ops).
// ---------------------------------------------------------------------------

// D4 findings: distinct, locatable, NO duplicates ⇒ consensus(dedup) == naive.
const D4_INERT = [
  [{ file: 'a.ts', line: 10, severity: 'critical', summary: 'c1' }],
  [{ file: 'b.ts', line: 20, severity: 'important', summary: 'i1' }],
];
// D2 project: test+typecheck+build scripts ⇒ resolveVerifier emits all 3 buckets,
// matching legacy's hardwired build/tsc/test coverage. All commands pass.
const D2_PROJECT_INERT = { packageJson: { scripts: { test: 'jest', typecheck: 'tsc --noEmit', build: 'next build' } }, otherFiles: ['tsconfig.json'] };
const D2_RESULTS_INERT = [{ bucket: 'build', pass: true }, { bucket: 'tsc', pass: true }, { bucket: 'test', pass: true }];

const BASE = { d1: { critical: 1, important: 1 }, d3: { drift: 1 }, d5: { shared: 2 }, d6: { applicable: false } };

test('GATE A: inert fixture ⇒ new pipeline is byte-identical to legacyReduce', () => {
  // NEW path: consensus-aggregated D4 + role-tagged resolveVerifier D2.
  const newSignals = {
    ...BASE,
    d4: aggregateD4(D4_INERT),
    d2: { ...d2SignalsFromResults(D2_RESULTS_INERT), untested_new: 0 },
    override_signals: {},
  };
  // LEGACY path: naive D4 + hardwired all-pass D2 (the inert fixture makes both equal).
  const legacySignals = {
    ...BASE,
    d4: naiveD4(D4_INERT),
    d2: { build_fail: 0, tsc_fail: 0, tests_fail: 0, untested_new: 0 },
  };
  const got = computeAudit(newSignals);
  const want = legacyReduce(legacySignals);
  assert.equal(got.composite, want.composite); // byte-identical float
  assert.equal(got.route, want.route);
  // Sanity: the inert fixture really did make consensus a no-op.
  assert.deepEqual(aggregateD4(D4_INERT), naiveD4(D4_INERT));
});

test('GATE A: resolveVerifier on the inert project covers exactly build/tsc/test (no synthetic)', () => {
  const cmds = resolveD2Commands(D2_PROJECT_INERT);
  assert.deepEqual(cmds.map((c) => c.bucket).sort(), ['build', 'test', 'tsc']);
  assert.ok(!cmds.some((c) => c.synthetic));
});

// ---------------------------------------------------------------------------
// GATE B — documented deltas vs pre-registered goldens.
// ---------------------------------------------------------------------------

test('GATE B (consensus dedup delta): 3 identical criticals ⇒ naive 3 / consensus 1; D4 70 vs 90 (+20)', () => {
  const dup = { file: 'x.ts', line: 42, severity: 'critical', summary: 'identical issue' };
  const fixture = [[{ ...dup }], [{ ...dup }], [{ ...dup }]];
  // Pre-registered goldens:
  assert.deepEqual(naiveD4(fixture), { critical: 3, important: 0, suggestion: 0 });
  assert.deepEqual(aggregateD4(fixture), { critical: 1, important: 0, suggestion: 0 });
  assert.equal(scoreD4(naiveD4(fixture)), 70); // 100 − 10·3
  assert.equal(scoreD4(aggregateD4(fixture)), 90); // 100 − 10·1
  assert.equal(scoreD4(aggregateD4(fixture)) - scoreD4(naiveD4(fixture)), 20); // documented +20 dedup delta
});

test('GATE B (importants dedup-divergence): identical collapse, distinct survive', () => {
  const same = [[{ file: 'y.ts', line: 5, severity: 'important', summary: 'dup imp' }], [{ file: 'y.ts', line: 5, severity: 'important', summary: 'dup imp' }]];
  const diff = [[{ file: 'y.ts', line: 5, severity: 'important', summary: 'A' }], [{ file: 'y.ts', line: 5, severity: 'important', summary: 'B' }]];
  assert.equal(aggregateD4(same).important, 1); // collapse
  assert.equal(aggregateD4(diff).important, 2); // distinct descriptions survive (canonical key includes desc)
});

test('GATE B (D2 delta, OD4): missing-typecheck-script ⇒ raw resolveVerifier drops the tsc gate; the fallback restores it', () => {
  const proj = { packageJson: { scripts: { test: 'jest' } }, otherFiles: ['tsconfig.json'] };
  // The silent hole: raw resolveVerifier emits NO tsc command (no typecheck script).
  const rawBuckets = resolveVerifier(proj).map((c) => d2Bucket(c));
  assert.ok(!rawBuckets.includes('tsc'), 'raw resolveVerifier silently drops the tsc gate');
  // The OD4 fallback restores it (tsconfig.json present).
  const withFallback = resolveD2Commands(proj);
  const tsc = withFallback.find((c) => c.bucket === 'tsc');
  assert.ok(tsc && tsc.synthetic, 'synthetic tsc fallback restores the −30 tsc gate');
  assert.equal(tsc.cmd, 'npx tsc --noEmit');
});

// ---------------------------------------------------------------------------
// DISCRIMINATION — Gate A is not vacuous: a perturbed weight diverges.
// ---------------------------------------------------------------------------

test('DISCRIMINATION: a perturbed-weight reduce diverges from legacyReduce on the inert fixture', () => {
  const sig = { ...BASE, d1: { critical: 1, important: 1 }, d4: aggregateD4(D4_INERT), d2: { build_fail: 0, tsc_fail: 0, tests_fail: 0, untested_new: 0 } };
  // Same as legacyReduce but with d1 weight 0.31 instead of 0.30 (what a CI sed-mutation does).
  const f0 = (n) => Math.max(0, n);
  const s1 = f0(100 - 20 * 1 - 10 * 1), s2 = 100, s3 = f0(100 - 20 * 1), s4 = scoreD4(sig.d4), s5 = f0(100 - 5 * 2);
  const perturbed = (0.31 * s1 + 0.2 * s2 + 0.15 * s3 + 0.1 * s4 + 0.2 * s5) / 0.95;
  assert.notEqual(perturbed, legacyReduce(sig).composite); // the parity comparison HAS teeth
});
