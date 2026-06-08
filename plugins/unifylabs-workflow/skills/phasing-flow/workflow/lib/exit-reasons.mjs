// exit-reasons.mjs — the FROZEN exit-reason vocabulary (M2 foundation).
//
// The whole point of M1 is that the loop's ceilings are PROVABLE by running
// code, not prose a model is asked to honor. A core part of that proof is that
// every exit is one of a closed, frozen set of reasons. If the engine ever
// computes a reason outside this set, that is a logic bug and we throw rather
// than emit a silent / novel stop.
//
// Determinism: no wall-clock, no random. Pure constants + a guard.

// Per-member meaning (the vocabulary is FROZEN at exactly these 7 — never add
// a member; generalize an existing one's meaning instead):
//   skip-if-clean          pre-loop gate fired; initial set had nothing gated.
//   clean                  loop ended with ZERO residual blocking findings
//                          (Critical + gated-Important + promoted-Suggestion)
//                          and zero auto-fixable work left.
//   fixed-point            no blocking findings, but the auto-fixable working
//                          set stalled (no strict shrinkage / set-swap / cycle).
//   cap                    no blocking findings, but maxRounds was reached.
//   circuit-breaker        a budget breaker tripped (relative 5x or absolute).
//   aborted                the verifier permanently failed.
//   criticals-pending-gate blocking findings collected, awaiting the
//                          between-runs human gate (Criticals always; Important
//                          under --gate-important). Despite the historical name,
//                          this fires for ANY residual blocking finding, not
//                          only Criticals.
export const EXIT_REASONS = Object.freeze({
  SKIP_IF_CLEAN: 'skip-if-clean',
  CLEAN: 'clean',
  FIXED_POINT: 'fixed-point',
  CAP: 'cap',
  CIRCUIT_BREAKER: 'circuit-breaker',
  ABORTED: 'aborted',
  CRITICALS_PENDING_GATE: 'criticals-pending-gate',
});

// The frozen SET of legal string values, for membership checks.
export const EXIT_REASON_VALUES = Object.freeze(
  new Set(Object.values(EXIT_REASONS)),
);

/**
 * Guard: assert `reason` is a member of the frozen vocabulary. Throws
 * otherwise. The engine routes EVERY exit through this so a novel/silent stop
 * is impossible by construction.
 * @param {string} reason
 * @returns {string} the same reason (for chaining)
 */
export function assertExitReason(reason) {
  if (!EXIT_REASON_VALUES.has(reason)) {
    throw new Error(
      `illegal exitReason "${String(reason)}" — not in the frozen vocabulary ` +
        `{${Array.from(EXIT_REASON_VALUES).join(', ')}}`,
    );
  }
  return reason;
}
