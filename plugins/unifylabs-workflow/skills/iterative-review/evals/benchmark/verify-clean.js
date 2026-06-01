'use strict';

// Deterministic verifier for the benchmark project. Exercises ONLY the
// defect-free clean-artifact.js so that `npm test --silent` is a stable,
// passing verifier command in code mode (per references/verifier-detection.md).
//
// It deliberately does NOT import discount-engine.js / checkout.js /
// currency.js — those are described by the frozen task-diff.fixture and are not
// applied to this directory, so the verifier stays green and the eval measures
// REVIEW quality, not whether the planted bugs were applied.
//
// No timestamps, no randomness — fully deterministic.

const assert = require('assert');
const { clamp, unique } = require('./clean-artifact');

assert.strictEqual(clamp(5, 0, 10), 5, 'clamp in-range');
assert.strictEqual(clamp(-1, 0, 10), 0, 'clamp below min');
assert.strictEqual(clamp(99, 0, 10), 10, 'clamp above max');
assert.throws(() => clamp(NaN, 0, 10), TypeError, 'clamp rejects non-finite');
assert.throws(() => clamp(5, 10, 0), RangeError, 'clamp rejects min>max');

assert.deepStrictEqual(unique([1, 1, 2, 3, 3]), [1, 2, 3], 'unique dedupes');
assert.deepStrictEqual(unique('not-an-array'), [], 'unique guards non-array');
assert.deepStrictEqual(unique([]), [], 'unique handles empty');

// eslint-disable-next-line no-console
console.log('benchmark verifier: PASS (8 assertions)');
