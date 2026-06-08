// execution-engine.test.mjs — the enforced execution-loop CI gate (P-A, hardened
// after the adversarial kernel review wf_0cf2db43). Drives the PURE engine with
// deterministic stubs over a table of scenarios, asserts the frozen exit
// vocabulary + every ceiling + the fail direction of each callback, and adds (1)
// a determinism / frozen-vocabulary guard that recursively source-scans the
// workflow dir for forbidden wall-clock/random tokens and (2) a RED gate-the-gate
// structural guard that fails if a ceiling is unwired from the engine.
//
// Zero-dependency: node:test + node:assert + node:fs only. NO Date/now, NO
// Math.random anywhere (the forbidden-token list below is written SPLIT so it
// does not match itself when this file is scanned by the recursive walk).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { runExecutionLoop, isUsableManifest } from '../execution-engine.mjs';
import {
  EXIT_REASONS,
  EXIT_REASON_VALUES,
  assertExitReason,
} from '../lib/exit-reasons.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_DIR = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Deterministic stub builder — each scenario describes per-unit behavior; the
// stubs accrue a DETERMINISTIC spend counter (no wall-clock, no random) so the
// budget breaker is reproducible. Per-unit knobs: spend, execute(false->null),
// executeError(->{error}), executeThrow, verify(string), verifyThrow,
// blockingDiff(count), diffThrow.
// ---------------------------------------------------------------------------

function buildStubs(scenario) {
  const cfg = scenario.config ?? {};
  const perUnit = scenario.units ?? [];

  let spent = Number(cfg.initialSpend ?? 0);
  const total = cfg.budgetTotal === undefined ? null : cfg.budgetTotal;
  const budget = {
    spent: () => spent,
    remaining: () => (total === null ? Infinity : total - spent),
    total,
  };

  let executeCalls = 0;
  let verifyCalls = 0;
  let diffReviewCalls = 0;

  async function executeUnit({ index }) {
    executeCalls += 1;
    const u = perUnit[index] ?? {};
    if (typeof u.spend === 'number') spent += u.spend;
    if (u.executeThrow) throw new Error('exec-boom');
    if (u.execute === false) return null;
    if (u.executeError) return { error: u.executeError, summary: 'x', diff_path: '/tmp/x' };
    return { changed_files: ['f.txt'], diff_path: `/tmp/diff-${index}`, summary: 'did it' };
  }
  async function verify({ index }) {
    verifyCalls += 1;
    const u = perUnit[index] ?? {};
    if (u.verifyThrow) throw new Error('verify-boom');
    return u.verify ?? 'pass';
  }
  async function diffReview({ index }) {
    diffReviewCalls += 1;
    const u = perUnit[index] ?? {};
    if (u.diffThrow) throw new Error('diff-boom');
    return Number(u.blockingDiff ?? 0);
  }

  return {
    budget,
    executeUnit,
    verify,
    diffReview,
    counters: {
      get executeCalls() { return executeCalls; },
      get verifyCalls() { return verifyCalls; },
      get diffReviewCalls() { return diffReviewCalls; },
    },
  };
}

function unitsOf(n) {
  return Array.from({ length: n }, (_u, i) => ({
    id: `u${i + 1}`,
    title: `Unit ${i + 1}`,
    instruction: 'do it',
  }));
}

// ---------------------------------------------------------------------------
// Direct classifier coverage — isUsableManifest's four rejection branches.
// ---------------------------------------------------------------------------

test('isUsableManifest: rejects null / non-object / array / {error}, accepts a lean manifest', () => {
  assert.equal(isUsableManifest(null), false, 'null');
  assert.equal(isUsableManifest(undefined), false, 'undefined');
  assert.equal(isUsableManifest('manifest'), false, 'string');
  assert.equal(isUsableManifest(['f']), false, 'array');
  assert.equal(isUsableManifest({ error: 'hook-blocked' }), false, 'truthy error -> unusable');
  assert.equal(isUsableManifest({ summary: 's', diff_path: '/tmp/d' }), true, 'lean manifest -> usable');
});

// ---------------------------------------------------------------------------
// The scenario table — one node:test per scenario. The engine make-return maps
// the unit domain onto its review-domain fields: resolved = units completed,
// residualCritical = residual (pending/blocked) units. INVARIANT asserted on
// every scenario: resolved + residualCritical === unitCount.
// ---------------------------------------------------------------------------

const SCENARIOS = [
  {
    id: 'clean-single',
    description: 'one unit, execute ok, verify pass, no blocking diff -> clean',
    unitCount: 1,
    units: [{ verify: 'pass', blockingDiff: 0 }],
    expect: { exitReason: 'clean', unitsCompleted: 1, unitsResidual: 0 },
  },
  {
    id: 'clean-three',
    description: 'three units all clean -> clean',
    unitCount: 3,
    units: [{}, {}, {}],
    expect: { exitReason: 'clean', unitsCompleted: 3, unitsResidual: 0 },
  },
  {
    id: 'skip-empty',
    description: 'zero units -> skip-if-clean (executor never called)',
    unitCount: 0,
    units: [],
    expect: { exitReason: 'skip-if-clean', unitsCompleted: 0, unitsResidual: 0 },
    expectExecuteCalls: 0,
  },
  {
    id: 'aborted-execute-null',
    description: 'unit 1 executor returns null (hook-blocked) -> aborted',
    unitCount: 1,
    units: [{ execute: false }],
    expect: { exitReason: 'aborted', unitsCompleted: 0, unitsResidual: 1 },
    expectVerifyCalls: 0, // a failed executor short-circuits verify
  },
  {
    id: 'aborted-execute-error-object',
    description: 'unit 1 executor returns {error} -> aborted (the !m.error branch)',
    unitCount: 1,
    units: [{ executeError: 'hook-blocked the write' }],
    expect: { exitReason: 'aborted', unitsCompleted: 0, unitsResidual: 1 },
    expectVerifyCalls: 0,
  },
  {
    id: 'aborted-execute-throw',
    description: 'unit 1 executor THROWS -> aborted (fail-closed, routed not crashed)',
    unitCount: 1,
    units: [{ executeThrow: true }],
    expect: { exitReason: 'aborted', unitsCompleted: 0, unitsResidual: 1 },
    expectVerifyCalls: 0,
    expectTruncationContains: 'executor threw',
  },
  {
    id: 'aborted-verify-permanent',
    description: 'unit 1 verify fail-permanent -> aborted',
    unitCount: 1,
    units: [{ verify: 'fail-permanent' }],
    expect: { exitReason: 'aborted', unitsCompleted: 0, unitsResidual: 1 },
  },
  {
    id: 'aborted-verify-throw',
    description: 'unit 1 verify THROWS -> aborted (fail-closed)',
    unitCount: 1,
    units: [{ verifyThrow: true }],
    expect: { exitReason: 'aborted', unitsCompleted: 0, unitsResidual: 1 },
    expectTruncationContains: 'verifier threw',
  },
  {
    id: 'aborted-verify-unknown',
    description: 'unit 1 verify returns an unrecognized verdict -> aborted (fail-closed, NOT clean)',
    unitCount: 1,
    units: [{ verify: 'PASS' }], // wrong case / out-of-contract string
    expect: { exitReason: 'aborted', unitsCompleted: 0, unitsResidual: 1 },
    expectTruncationContains: 'unrecognized verdict',
  },
  {
    id: 'blocked-verify-red',
    description: 'unit 1 verify RED -> criticals-pending-gate',
    unitCount: 1,
    units: [{ verify: 'fail' }],
    expect: { exitReason: 'criticals-pending-gate', unitsCompleted: 0, unitsResidual: 1 },
    expectDiffReviewCalls: 0, // a RED verify short-circuits the diff-reviewer
  },
  {
    id: 'blocked-diff-consensus',
    description: 'unit 1 verify pass but 2 consensus-Critical diff findings -> criticals-pending-gate',
    unitCount: 1,
    units: [{ verify: 'pass', blockingDiff: 2 }],
    expect: { exitReason: 'criticals-pending-gate', unitsCompleted: 0, unitsResidual: 1 },
  },
  {
    id: 'clean-diff-throw-fail-open',
    description: 'unit 1 diff-reviewer THROWS -> fail-open (treated as 0) -> clean',
    unitCount: 1,
    units: [{ verify: 'pass', diffThrow: true }],
    expect: { exitReason: 'clean', unitsCompleted: 1, unitsResidual: 0 },
    expectTruncationContains: 'fail-open',
  },
  {
    id: 'blocked-second-unit',
    description: 'unit 1 clean, unit 2 RED -> stop at unit 2 (gates between units)',
    unitCount: 3,
    units: [{}, { verify: 'fail' }, {}],
    expect: { exitReason: 'criticals-pending-gate', unitsCompleted: 1, unitsResidual: 2 },
  },
  {
    id: 'circuit-breaker',
    description: 'cumulative spend blows past 5x the FIRST-unit baseline -> circuit-breaker',
    unitCount: 3,
    // baseline = cost through unit1 = 100; at unit3 top, spent 700 > 5*100 = 500.
    units: [{ spend: 100 }, { spend: 600 }, {}],
    expect: { exitReason: 'circuit-breaker', unitsCompleted: 2, unitsResidual: 1 },
    expectTruncationContains: 'circuit-breaker',
  },
  {
    id: 'zero-baseline-stays-clean',
    description: 'REGRESSION: null budget + modest per-unit spend must reach clean, NOT false-trip the breaker',
    unitCount: 2,
    units: [{ spend: 10 }, { spend: 10 }], // 0 pre-loop baseline used to make 5x0=0 trip
    expect: { exitReason: 'clean', unitsCompleted: 2, unitsResidual: 0 },
  },
  {
    id: 'cap',
    description: 'cap=2 over 3 units -> process 2 then cap with 1 pending',
    unitCount: 3,
    config: { cap: 2 },
    units: [{}, {}, {}],
    expect: { exitReason: 'cap', unitsCompleted: 2, unitsResidual: 1 },
    expectTruncationContains: 'still pending',
  },
  {
    id: 'cap-clamp-upper',
    description: 'cap above unit count is clamped (never silent)',
    unitCount: 2,
    config: { cap: 9 },
    units: [{}, {}],
    expect: { exitReason: 'clean', unitsCompleted: 2, unitsResidual: 0 },
    expectTruncationContains: 'clamped',
  },
  {
    id: 'cap-clamp-lower',
    description: 'cap=0 clamps UP to 1 (process exactly one unit) -> cap',
    unitCount: 2,
    config: { cap: 0 },
    units: [{}, {}],
    expect: { exitReason: 'cap', unitsCompleted: 1, unitsResidual: 1 },
    expectTruncationContains: 'clamped',
  },
];

for (const sc of SCENARIOS) {
  test(`scenario: ${sc.id} — ${sc.description}`, async () => {
    const stubs = buildStubs(sc);
    const result = await runExecutionLoop({
      units: unitsOf(sc.unitCount),
      executeUnit: stubs.executeUnit,
      verify: stubs.verify,
      diffReview: stubs.diffReview,
      budget: stubs.budget,
      cap: (sc.config ?? {}).cap,
      workingDir: '/tmp/eval',
      runSeed: 0,
    });

    assert.ok(
      EXIT_REASON_VALUES.has(result.exitReason),
      `${sc.id}: exitReason "${result.exitReason}" not in frozen vocabulary`,
    );
    assert.equal(result.exitReason, sc.expect.exitReason, `${sc.id}: exitReason`);
    // make-return maps: resolved = completed, residualCritical = residual units.
    assert.equal(result.resolved, sc.expect.unitsCompleted, `${sc.id}: unitsCompleted`);
    assert.equal(result.residualCritical, sc.expect.unitsResidual, `${sc.id}: unitsResidual`);
    // INVARIANT (load-bearing for the between-runs gate): completed + residual === total.
    assert.equal(
      result.resolved + result.residualCritical,
      sc.unitCount,
      `${sc.id}: completed + residual must equal unitCount`,
    );
    assert.ok(Object.isFrozen(result), `${sc.id}: return not frozen`);
    assert.ok(Object.isFrozen(result.truncationLog), `${sc.id}: truncationLog not frozen`);

    if (sc.expectTruncationContains) {
      assert.ok(
        result.truncationLog.join('\n').includes(sc.expectTruncationContains),
        `${sc.id}: truncationLog missing "${sc.expectTruncationContains}" — got ${JSON.stringify(result.truncationLog)}`,
      );
    }
    if (typeof sc.expectExecuteCalls === 'number') {
      assert.equal(stubs.counters.executeCalls, sc.expectExecuteCalls, `${sc.id}: executeUnit call count`);
    }
    if (typeof sc.expectVerifyCalls === 'number') {
      assert.equal(stubs.counters.verifyCalls, sc.expectVerifyCalls, `${sc.id}: verify call count`);
    }
    if (typeof sc.expectDiffReviewCalls === 'number') {
      assert.equal(stubs.counters.diffReviewCalls, sc.expectDiffReviewCalls, `${sc.id}: diffReview call count`);
    }
  });
}

// ---------------------------------------------------------------------------
// Required-callback guards.
// ---------------------------------------------------------------------------

test('engine throws when a required callback is missing', async () => {
  await assert.rejects(
    () => runExecutionLoop({
      units: unitsOf(1),
      verify: async () => 'pass',
      diffReview: async () => 0,
      budget: { spent: () => 0, remaining: () => Infinity, total: null },
    }),
    /executeUnit callback is required/,
  );
});

// ---------------------------------------------------------------------------
// Determinism + frozen-vocabulary guard.
// ---------------------------------------------------------------------------

test('guard: engine + lib + kernels + tools + tests are free of wall-clock / random calls', () => {
  const targets = [];
  function collectMjs(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.startsWith('.')) continue;
        collectMjs(full);
      } else if (ent.isFile() && ent.name.endsWith('.mjs')) {
        targets.push(full);
      }
    }
  }
  collectMjs(WORKFLOW_DIR);

  const forbidden = [
    'Date' + '.now(',
    'new ' + 'Date(',
    'Date' + '.parse(',
    'Math' + '.random(',
    'crypto' + '.randomUUID(',
    'crypto' + '.getRandomValues(',
    'set' + 'Timeout(',
    'set' + 'Interval(',
    'process' + '.hrtime(',
    'performance' + '.now(',
  ];
  for (const file of targets) {
    const src = readFileSync(file, 'utf8');
    for (const pat of forbidden) {
      assert.ok(!src.includes(pat), `forbidden non-deterministic call "${pat}" found in ${file}`);
    }
  }
});

test('guard: exit-reasons vocabulary is frozen at exactly 7', () => {
  assert.ok(Object.isFrozen(EXIT_REASONS), 'EXIT_REASONS not frozen');
  assert.ok(Object.isFrozen(EXIT_REASON_VALUES), 'EXIT_REASON_VALUES not frozen');
  assert.deepEqual(
    Array.from(EXIT_REASON_VALUES).sort(),
    [
      'aborted',
      'cap',
      'circuit-breaker',
      'clean',
      'criticals-pending-gate',
      'fixed-point',
      'skip-if-clean',
    ],
    'frozen vocabulary drifted',
  );
  assert.throws(() => assertExitReason('not-a-real-reason'), /illegal exitReason/);
});

// ---------------------------------------------------------------------------
// RED gate-the-gate structural guard. A disabled ceiling MUST turn the gate red.
// This source-scan asserts every ceiling M2 wires is present — deleting any one
// (the budget breaker, the cap clamp, the frozen-reason assertion, the per-unit
// classifier, the frozen return) makes this test fail. Combined with the
// behavioral scenarios above (each of which independently goes red if its ceiling
// stops firing), the suite is red-capable by construction. (fixed-point is NOT a
// wired M2 ceiling — see the engine header — so it is intentionally absent here.)
// ---------------------------------------------------------------------------

test('gate-the-gate: every M2 ceiling is wired into the execution engine', () => {
  const engineSrc = readFileSync(join(WORKFLOW_DIR, 'execution-engine.mjs'), 'utf8');
  const required = [
    'checkBudget(', // budget circuit-breaker
    'clampWithFlag(', // cap clamp-with-warning
    'assertExitReason(', // frozen-reason enforcement
    'classifyUnit(', // per-unit terminal classification
    'makeReturn(', // frozen return shape
  ];
  for (const token of required) {
    assert.ok(
      engineSrc.includes(token),
      `RED: execution engine no longer wires "${token}" — a ceiling was removed`,
    );
  }
});
