// clamp.mjs — pure numeric clamp helper (M2 foundation).
//
// Rule 1 (MAX-ROUNDS) is built on top of this: maxRounds = clamp(cap ?? 3, 1, 5).
// The clamp is "clamp-with-warning" at the call site — this helper is the pure
// arithmetic core; the warning line is pushed by the caller (budget/engine) when
// the raw value differed from the clamped value, so a clamp is NEVER silent.
//
// Determinism: no wall-clock, no random. Pure function of its inputs.

/**
 * Clamp `value` into the inclusive range [lo, hi].
 * @param {number} value
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(value, lo, hi) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    // Non-numeric / NaN collapses to the low bound — never silently propagate
    // a bad value into the ceiling arithmetic.
    return lo;
  }
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/**
 * Clamp and report whether the value was changed, so the caller can push a
 * truncation/warning log line. Returns { value, clamped, raw }.
 * @param {number} raw
 * @param {number} lo
 * @param {number} hi
 * @returns {{ value: number, clamped: boolean, raw: number }}
 */
export function clampWithFlag(raw, lo, hi) {
  const value = clamp(raw, lo, hi);
  return { value, clamped: value !== raw, raw };
}
