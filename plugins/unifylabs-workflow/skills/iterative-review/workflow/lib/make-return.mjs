// make-return.mjs — the FROZEN engine return shape (M2 foundation).
//
// Every return from runLoopUntilDry goes through this builder so the shape is
// uniform and immutable (Object.freeze). A frozen shape means a consumer (the
// between-runs gate, the journaled-resume reader) can rely on exactly these
// keys, and the engine cannot accidentally leak extra mutable state.
//
// Determinism: no wall-clock, no random. Pure shape constructor.

import { assertExitReason } from './exit-reasons.mjs';

/**
 * Build the frozen return object.
 * @param {object} o
 * @param {string} o.exitReason          one of the frozen vocabulary
 * @param {number} o.roundsRun           how many in-loop rounds executed
 * @param {number} o.budgetSpent         budget.spent() at exit
 * @param {number} o.residualCritical    count of unresolved Critical findings
 * @param {number} o.residualImportant   count of unresolved Important findings
 * @param {number} o.resolved            count of Important findings auto-fixed
 * @param {string[]} o.truncationLog     every ceiling/clamp/breaker line
 * @returns {Readonly<object>}
 */
export function makeReturn({
  exitReason,
  roundsRun,
  budgetSpent,
  residualCritical,
  residualImportant,
  resolved,
  truncationLog,
}) {
  // Guard the reason here too — defense in depth: nothing leaves the engine
  // with an illegal exitReason.
  assertExitReason(exitReason);

  return Object.freeze({
    exitReason,
    roundsRun: Number(roundsRun ?? 0),
    budgetSpent: Number(budgetSpent ?? 0),
    residualCritical: Number(residualCritical ?? 0),
    residualImportant: Number(residualImportant ?? 0),
    resolved: Number(resolved ?? 0),
    // Freeze a COPY so callers cannot mutate the engine's log array.
    truncationLog: Object.freeze([...(truncationLog ?? [])]),
  });
}
