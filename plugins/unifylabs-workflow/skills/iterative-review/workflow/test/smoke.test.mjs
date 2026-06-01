// Smoke test for the iterative-review enforced-loop CI gate (P0 of M1).
//
// Its ONLY job at P0 is to prove the executed-JS gate is LIVE in CI:
// `node --test` actually runs here and can turn the job red. The real
// stopping-engine assertions land in P1/P2 (generated from
// workflow/evals/loop-control-evals.json) and replace this placeholder.
//
// Zero-dependency on purpose: node:test + node:assert only, no package.json,
// no node_modules — matches the kit's no-toolchain ethos (ADR: Node stack
// expansion). Determinism: no Date/now, no Math.random.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('loop-harness gate is live (P0 placeholder — replaced by the engine tests in P1/P2)', () => {
  assert.equal(1 + 1, 2);
});
