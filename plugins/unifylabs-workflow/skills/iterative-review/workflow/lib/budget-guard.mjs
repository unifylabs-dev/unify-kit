// budget-guard.mjs — the TWO budget circuit breakers (M2 foundation, rule 5).
//
// Two breakers; EITHER firing exits with 'circuit-breaker'. Checked FIRST each
// iteration so a costly fixer is never entered when a cheap rule should exit.
//
//  (a) RELATIVE 5x backstop:
//        budget.spent() > relativeMultiplier(default 5) * initialReviewCost
//      where initialReviewCost is captured ONCE, immediately after the initial
//      review pass. This works even when budget.total is null because spent()
//      is always measurable — so the common no-budget case still has runaway
//      protection.
//
//  (b) ABSOLUTE floor:
//        budget.remaining() < absoluteThreshold
//      active ONLY when budget.total is finite. When total is null,
//      remaining() returns Infinity, so Infinity < threshold is always false
//      and the absolute breaker never trips.
//
// Determinism: no wall-clock, no random. Pure function of the budget object's
// reported numbers + the captured baseline.

export const DEFAULT_RELATIVE_MULTIPLIER = 5;

/**
 * Evaluate both breakers. Returns { tripped, log } where `log` is a human line
 * naming which breaker fired (or null when none fired).
 *
 * @param {object} args
 * @param {{ spent: () => number, remaining: () => number, total: number|null }} args.budget
 * @param {number} args.initialReviewCost  baseline captured after initial review
 * @param {number} args.relativeMultiplier  default 5
 * @param {number} args.absoluteThreshold   absolute floor on remaining()
 * @returns {{ tripped: boolean, log: string|null }}
 */
export function checkBudget({
  budget,
  initialReviewCost,
  relativeMultiplier,
  absoluteThreshold,
}) {
  const mult =
    typeof relativeMultiplier === 'number' && relativeMultiplier > 0
      ? relativeMultiplier
      : DEFAULT_RELATIVE_MULTIPLIER;

  const spent = budget.spent();

  // (a) RELATIVE breaker — always active (spent() always measurable).
  const relativeLimit = mult * initialReviewCost;
  if (spent > relativeLimit) {
    return {
      tripped: true,
      log:
        `circuit-breaker: relative 5x backstop fired — spent ${spent} > ` +
        `${mult}x initial review cost ${initialReviewCost} (limit ${relativeLimit})`,
    };
  }

  // (b) ABSOLUTE breaker — only meaningful when total is finite. When total is
  // null, remaining() is Infinity and this comparison is always false.
  const remaining = budget.remaining();
  if (
    typeof absoluteThreshold === 'number' &&
    Number.isFinite(remaining) &&
    remaining < absoluteThreshold
  ) {
    return {
      tripped: true,
      log:
        `circuit-breaker: absolute floor fired — remaining ${remaining} < ` +
        `absoluteThreshold ${absoluteThreshold}`,
    };
  }

  return { tripped: false, log: null };
}
