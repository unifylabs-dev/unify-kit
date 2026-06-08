// wrapper.test.mjs — the injection-based phasing-flow orchestrator (P-A).
// Zero-dependency: node:test + node:assert. NO Date/now, NO Math.random.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runPhasingFlowExecution } from '../wrapper.mjs';

function nullBudget() {
  return { spent: () => 0, remaining: () => Infinity, total: null };
}

test('wrapper: clean run returns the units-domain report shape', async () => {
  const units = [
    { id: 'a', title: 'A', instruction: 'do a' },
    { id: 'b', title: 'B', instruction: 'do b' },
  ];
  const report = await runPhasingFlowExecution({
    units,
    executeUnit: async () => ({ changed_files: ['f'], diff_path: '/tmp/d', summary: 's' }),
    verify: async () => 'pass',
    diffReview: async () => 0,
    budget: nullBudget(),
  });
  assert.ok(Object.isFrozen(report));
  assert.deepEqual(
    Object.keys(report).sort(),
    ['budgetSpent', 'exitReason', 'truncationLog', 'unitsCompleted', 'unitsResidual', 'unitsTotal'],
    'report key set',
  );
  assert.equal(report.exitReason, 'clean');
  assert.equal(report.unitsTotal, 2);
  assert.equal(report.unitsCompleted, 2);
  assert.equal(report.unitsResidual, 0);
});

test('wrapper: a blocked unit surfaces criticals-pending-gate + residual', async () => {
  const units = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ];
  const report = await runPhasingFlowExecution({
    units,
    executeUnit: async () => ({ diff_path: '/tmp/d', summary: 's' }),
    verify: async ({ index }) => (index === 0 ? 'pass' : 'fail'),
    diffReview: async () => 0,
    budget: nullBudget(),
  });
  assert.equal(report.exitReason, 'criticals-pending-gate');
  assert.equal(report.unitsCompleted, 1); // unit a cleared
  assert.equal(report.unitsResidual, 1); // unit b blocked
});

test('wrapper: empty units -> skip-if-clean', async () => {
  const report = await runPhasingFlowExecution({
    units: [],
    executeUnit: async () => ({}),
    verify: async () => 'pass',
    diffReview: async () => 0,
    budget: nullBudget(),
  });
  assert.equal(report.exitReason, 'skip-if-clean');
  assert.equal(report.unitsTotal, 0);
  assert.equal(report.unitsCompleted, 0);
});

test('wrapper: throws when executeUnit is missing', async () => {
  await assert.rejects(
    () => runPhasingFlowExecution({
      units: [{ id: 'a', title: 'A' }],
      verify: async () => 'pass',
      diffReview: async () => 0,
      budget: nullBudget(),
    }),
    /executeUnit callback is required/,
  );
});
