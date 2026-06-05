// verify-verdict.test.mjs — per-unit classification onto the frozen vocabulary
// (P-A). Zero-dependency: node:test + node:assert. NO Date/now, NO Math.random.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyUnit } from '../verify-verdict.mjs';
import { EXIT_REASONS, EXIT_REASON_VALUES } from '../lib/exit-reasons.mjs';

test('execute failed / hook-blocked -> aborted (terminal)', () => {
  const v = classifyUnit({ executeOk: false, verifyVerdict: 'pass', blockingDiffCount: 0 });
  assert.equal(v.terminal, true);
  assert.equal(v.status, 'aborted');
  assert.equal(v.exitReason, EXIT_REASONS.ABORTED);
  assert.ok(Object.isFrozen(v));
});

test('verify fail-permanent -> aborted', () => {
  const v = classifyUnit({ executeOk: true, verifyVerdict: 'fail-permanent', blockingDiffCount: 0 });
  assert.equal(v.status, 'aborted');
  assert.equal(v.exitReason, EXIT_REASONS.ABORTED);
});

test('verify RED (fail) -> criticals-pending-gate (blocked)', () => {
  const v = classifyUnit({ executeOk: true, verifyVerdict: 'fail', blockingDiffCount: 0 });
  assert.equal(v.terminal, true);
  assert.equal(v.status, 'blocked');
  assert.equal(v.exitReason, EXIT_REASONS.CRITICALS_PENDING_GATE);
});

test('consensus-Critical diff finding -> criticals-pending-gate (J2 generalize)', () => {
  const v = classifyUnit({ executeOk: true, verifyVerdict: 'pass', blockingDiffCount: 2 });
  assert.equal(v.status, 'blocked');
  assert.equal(v.exitReason, EXIT_REASONS.CRITICALS_PENDING_GATE);
});

test('executed + verify pass + no consensus-Critical -> CLEAN (continue)', () => {
  const v = classifyUnit({ executeOk: true, verifyVerdict: 'pass', blockingDiffCount: 0 });
  assert.equal(v.terminal, false);
  assert.equal(v.status, 'clean');
  assert.equal(v.exitReason, null);
});

test('FAIL-CLOSED: an unrecognized verdict -> aborted, NEVER clean', () => {
  // The authoritative verify gate must not silently pass a unit on a malformed
  // verdict. Anything that is not exactly 'pass'/'fail'/'fail-permanent' aborts.
  for (const bad of ['PASS', 'failed', 'error', '', 'ok', undefined]) {
    const v = classifyUnit({ executeOk: true, verifyVerdict: bad, blockingDiffCount: 0 });
    assert.equal(v.status, 'aborted', `verdict ${JSON.stringify(bad)} must abort, not pass`);
    assert.equal(v.exitReason, EXIT_REASONS.ABORTED);
  }
});

test('precedence: execute-fail wins over a RED verify / blocking diff', () => {
  // executeOk false short-circuits — classifyUnit returns aborted regardless of
  // the (engine-ignored) verify verdict and diff count.
  const v = classifyUnit({ executeOk: false, verifyVerdict: 'fail', blockingDiffCount: 5 });
  assert.equal(v.status, 'aborted');
  assert.equal(v.exitReason, EXIT_REASONS.ABORTED);
});

test('GUARD (J2): every emitted exitReason is in the FROZEN vocabulary', () => {
  // Exhaust the classifier across the whole signal space; assert no novel reason
  // ever escapes (a member added to verify-verdict outside the vocabulary would
  // throw via assertExitReason, but this also catches a silently-mistyped string).
  const verdicts = ['pass', 'fail', 'fail-permanent'];
  for (const executeOk of [true, false]) {
    for (const verifyVerdict of verdicts) {
      for (const blockingDiffCount of [0, 1, 3]) {
        const v = classifyUnit({ executeOk, verifyVerdict, blockingDiffCount });
        if (v.exitReason !== null) {
          assert.ok(
            EXIT_REASON_VALUES.has(v.exitReason),
            `emitted exitReason "${v.exitReason}" not in frozen vocabulary`,
          );
        }
      }
    }
  }
});
