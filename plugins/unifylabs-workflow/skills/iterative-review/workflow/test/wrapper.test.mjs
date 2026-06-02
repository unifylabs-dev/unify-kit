// wrapper.test.mjs — drives runIterativeReview with STUB injected callbacks
// (no agent() / no Workflow runtime). Asserts mode resolution, that the initial
// review output flows into the loop, and that the engine's exitReason/residuals
// surface in the frozen report. Covers a clean-skip path, a criticals-
// pending-gate path, and a fixed-point path.
//
// Zero-dep: node:test + node:assert only. NO wall-clock, NO random (the
// recursive determinism guard in stopping-engine.test.mjs scans this file too).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runIterativeReview } from '../wrapper.mjs';

// ---------------------------------------------------------------------------
// Deterministic budget + callback stubs.
// ---------------------------------------------------------------------------

function makeBudget(initial = 1, total = null) {
  let spent = initial;
  return {
    spent: () => spent,
    remaining: () => (total === null ? Infinity : total - spent),
    total,
    bump: (n) => {
      spent += n;
    },
  };
}

// A scripted reviewRound that returns a queued findings array per round.
function scriptedReviewRound(rounds) {
  let calls = 0;
  const fn = async () => {
    const r = rounds[calls] ?? [];
    calls += 1;
    return r;
  };
  fn.calls = () => calls;
  return fn;
}

const noopFixes = async () => {};
const passVerify = async () => 'pass';

// ---------------------------------------------------------------------------
// Mode resolution.
// ---------------------------------------------------------------------------

test('mode: explicit mode opt wins over target inference', async () => {
  let seenMode = null;
  const report = await runIterativeReview({
    mode: 'doc',
    target: 'src/index.ts', // would infer 'code'
    initialReview: async ({ mode }) => {
      seenMode = mode;
      return [];
    },
    reviewRound: scriptedReviewRound([]),
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
    skipClean: true,
  });
  assert.equal(seenMode, 'doc', 'initialReview received the explicit mode');
  assert.equal(report.mode, 'doc', 'report carries the explicit mode');
});

test('mode: inferred from target when no explicit mode (doc path)', async () => {
  let seenMode = null;
  const report = await runIterativeReview({
    target: 'docs/specs/module.md',
    initialReview: async ({ mode }) => {
      seenMode = mode;
      return [];
    },
    reviewRound: scriptedReviewRound([]),
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
  });
  assert.equal(seenMode, 'doc');
  assert.equal(report.mode, 'doc');
});

test('mode: inferred as code for a PR-number target', async () => {
  const report = await runIterativeReview({
    target: '47',
    initialReview: async () => [],
    reviewRound: scriptedReviewRound([]),
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
  });
  assert.equal(report.mode, 'code');
});

// ---------------------------------------------------------------------------
// Initial findings flow into the loop + are summarized in the report.
// ---------------------------------------------------------------------------

test('initial findings flow into the loop and are summarized', async () => {
  // 2 important + 1 suggestion initially. Default skipClean: NOT clean (has
  // Important), so it enters the loop. reviewRound returns empty -> resolved.
  const initial = [
    { file: 'a.js', line: 1, severity: 'important', score: 85, description: 'i-one' },
    { file: 'b.js', line: 2, severity: 'important', score: 82, description: 'i-two' },
    { file: 'c.js', line: 3, severity: 'suggestion', score: 40, description: 's-one' },
  ];
  let initialReviewCalls = 0;
  const review = scriptedReviewRound([[]]); // round 1 re-review: clean

  const report = await runIterativeReview({
    mode: 'code',
    target: 'x',
    initialReview: async () => {
      initialReviewCalls += 1;
      return initial;
    },
    reviewRound: review,
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
  });

  assert.equal(initialReviewCalls, 1, 'initialReview called exactly once');
  assert.equal(review.calls(), 1, 'reviewRound called once (one in-loop round)');
  assert.equal(report.findingsSummary.important, 2);
  assert.equal(report.findingsSummary.suggestion, 1);
  assert.equal(report.findingsSummary.critical, 0);
  assert.equal(report.findingsSummary.total, 3);
  // Engine resolved both Important in round 1 -> clean.
  assert.equal(report.exitReason, 'clean');
  assert.equal(report.roundsRun, 1);
  assert.equal(report.resolved, 2);
  assert.equal(report.residualImportant, 0);
  assert.equal(report.residualCritical, 0);
});

// ---------------------------------------------------------------------------
// Path: clean-skip (skip-if-clean pre-gate, reviewRound NEVER called).
// ---------------------------------------------------------------------------

test('clean-skip path: empty initial findings exits skip-if-clean without re-review', async () => {
  const review = scriptedReviewRound([[{ severity: 'critical', score: 99 }]]); // must NOT be called
  const report = await runIterativeReview({
    mode: 'doc',
    target: 'README.md',
    initialReview: async () => [],
    reviewRound: review,
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
    skipClean: true,
  });
  assert.equal(report.exitReason, 'skip-if-clean');
  assert.equal(report.roundsRun, 0);
  assert.equal(review.calls(), 0, 'reviewRound never called on a clean skip');
  assert.equal(report.findingsSummary.total, 0);
});

// ---------------------------------------------------------------------------
// Path: criticals-pending-gate (a residual Critical hands off to the gate).
// ---------------------------------------------------------------------------

test('criticals-pending-gate path: residual Critical surfaces in the report', async () => {
  // Initial has a Critical + an Important. Criticals are never fixed in-loop;
  // the Important gets resolved round 1 (re-review returns only the Critical),
  // so the working set is empty with a residual Critical -> pending-gate.
  const initial = [
    { file: 'a.js', line: 10, severity: 'critical', score: 95, description: 'crit-bug' },
    { file: 'b.js', line: 20, severity: 'important', score: 84, description: 'imp-x' },
  ];
  const review = scriptedReviewRound([
    [{ file: 'a.js', line: 10, severity: 'critical', score: 95, description: 'crit-bug' }],
  ]);
  const report = await runIterativeReview({
    mode: 'code',
    target: '99',
    initialReview: async () => initial,
    reviewRound: review,
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
  });
  assert.equal(report.exitReason, 'criticals-pending-gate');
  assert.equal(report.residualCritical, 1);
  assert.equal(report.findingsSummary.critical, 1);
  assert.equal(report.findingsSummary.important, 1);
  assert.ok(
    report.truncationLog.join('\n').includes('criticals-pending-gate'),
    'truncationLog records the handoff line',
  );
});

// ---------------------------------------------------------------------------
// Path: fixed-point (Important working set stalls, no Critical).
// ---------------------------------------------------------------------------

test('fixed-point path: stalled Important working set exits fixed-point', async () => {
  // Initial: 1 Important. Every re-review returns the SAME Important (no
  // shrinkage) -> fixed-point at round 1 (default fixedPointK=1).
  const stuck = [
    { file: 'a.js', line: 5, severity: 'important', score: 88, description: 'stuck-imp' },
  ];
  const review = scriptedReviewRound([stuck, stuck, stuck]);
  const report = await runIterativeReview({
    mode: 'code',
    target: 'x',
    initialReview: async () => stuck,
    reviewRound: review,
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
  });
  assert.equal(report.exitReason, 'fixed-point');
  assert.equal(report.residualImportant, 1);
  assert.equal(report.residualCritical, 0);
  assert.ok(report.truncationLog.join('\n').includes('fixed-point'));
});

// ---------------------------------------------------------------------------
// Report shape: frozen, deeply-frozen summary, exact key set.
// ---------------------------------------------------------------------------

test('report is frozen with the documented key set', async () => {
  const report = await runIterativeReview({
    mode: 'doc',
    target: 'x.md',
    initialReview: async () => [],
    reviewRound: scriptedReviewRound([]),
    applyFixes: noopFixes,
    verify: passVerify,
    budget: makeBudget(),
  });
  assert.ok(Object.isFrozen(report), 'report is frozen');
  assert.ok(Object.isFrozen(report.findingsSummary), 'findingsSummary is frozen');
  assert.ok(Object.isFrozen(report.truncationLog), 'truncationLog is frozen');
  assert.deepEqual(
    Object.keys(report).sort(),
    [
      'budgetSpent',
      'exitReason',
      'findingsSummary',
      'mode',
      'residualCritical',
      'residualImportant',
      'resolved',
      'roundsRun',
      'truncationLog',
    ],
    'report key set drifted',
  );
});

test('missing initialReview callback throws a clear error', async () => {
  await assert.rejects(
    () => runIterativeReview({ mode: 'doc', target: 'x.md', budget: makeBudget() }),
    /initialReview callback is required/,
  );
});
