'use strict';

// clean-artifact.js — a genuinely defect-free module used to assert that the
// skip-if-clean pre-gate fires. There are NO planted defects here: every input
// is validated, every branch is total, no async result is dropped, and there
// is no swallowed error. A correct reviewer should produce zero Critical and
// zero Important findings against this file and EXIT via skip-if-clean.

/**
 * Clamp a number into the inclusive [min, max] range.
 * Pure, total, and side-effect free. Throws only on programmer error
 * (non-finite inputs), which is the documented contract.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new TypeError('clamp expects finite numbers');
  }
  if (min > max) {
    throw new RangeError('clamp requires min <= max');
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/**
 * Return a new array with duplicate primitives removed, order preserved.
 * Handles the empty case explicitly and never mutates its input.
 *
 * @param {Array<string|number|boolean>} items
 * @returns {Array<string|number|boolean>}
 */
function unique(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return Array.from(new Set(items));
}

module.exports = { clamp, unique };
