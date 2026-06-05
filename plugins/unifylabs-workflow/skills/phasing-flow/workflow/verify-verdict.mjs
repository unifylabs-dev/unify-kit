// verify-verdict.mjs — per-unit outcome classification for the phasing-flow
// execution engine (M2). PURE: no agent(), no i/o, no wall-clock, no random.
//
// Each unit runs ONE execute -> deterministic verify -> adversarial diff-review
// cycle. This module maps that cycle's signals onto the FROZEN 7 exit reasons
// (lib/exit-reasons.mjs, copied verbatim) WITHOUT adding a member (J2 —
// GENERALIZE 'criticals-pending-gate' to "any residual blocking finding", which
// is its own documented meaning; never extend the vocabulary). Every reason it
// returns is routed through assertExitReason, so a novel/silent classification
// is impossible by construction.
//
// SIGNALS in, per unit:
//   - executeOk:    did executeUnit return a usable manifest? A null/error
//                   return means the executor failed OR a security hook
//                   HARD-BLOCKED its write mid-run (no human is present inside a
//                   running Workflow to approve the write) — see R3. Either way
//                   the unit could not be produced.
//   - verifyVerdict: the deterministic verifier's result — 'pass' | 'fail' |
//                   'fail-permanent'. This is the AUTHORITATIVE gate (J4).
//   - blockingDiffCount: how many CONSENSUS-Critical findings the adversarial
//                   diff-reviewer raised (already consensus-aggregated + counted
//                   by the glue; the diff-reviewer is fail-open and can only
//                   RAISE a gate, never lower the deterministic verdict).
//
// MAPPING (precedence high -> low):
//   executeOk === false                  -> 'aborted'                 (R3)
//   verifyVerdict === 'fail-permanent'   -> 'aborted'
//   verifyVerdict === 'fail'  (RED)      -> 'criticals-pending-gate'
//   blockingDiffCount > 0                -> 'criticals-pending-gate'  (J2 generalize)
//   otherwise (executed + verify pass +  -> null  (unit CLEAN; advance cursor)
//     no consensus-Critical)
//
// Determinism: pure function of its inputs.

import { EXIT_REASONS, assertExitReason } from './lib/exit-reasons.mjs';

/**
 * Classify a single unit's execute -> verify -> diff-review outcome.
 * Returns a FROZEN verdict { terminal, exitReason, status }:
 *   - terminal=true  => the loop STOPS at this unit and hands off to the human
 *     gate (status 'aborted' or 'blocked'); exitReason is a frozen-vocabulary
 *     reason.
 *   - terminal=false => the unit is CLEAN (status 'clean'); exitReason is null;
 *     the engine advances the cursor to the next unit.
 *
 * @param {object} a
 * @param {boolean} a.executeOk            executeUnit returned a usable manifest
 * @param {'pass'|'fail'|'fail-permanent'} a.verifyVerdict
 * @param {number} [a.blockingDiffCount=0] consensus-Critical diff findings
 * @returns {Readonly<{terminal:boolean, exitReason:string|null, status:'clean'|'blocked'|'aborted'}>}
 */
export function classifyUnit({ executeOk, verifyVerdict, blockingDiffCount = 0 } = {}) {
  // (1) execute failed / hook-blocked mid-run -> aborted.
  if (executeOk === false) {
    return terminal('aborted', EXIT_REASONS.ABORTED);
  }
  // (2) deterministic verifier permanently failed -> aborted.
  if (verifyVerdict === 'fail-permanent') {
    return terminal('aborted', EXIT_REASONS.ABORTED);
  }
  // (3) deterministic verifier RED -> blocking, hand to the between-runs gate.
  if (verifyVerdict === 'fail') {
    return terminal('blocked', EXIT_REASONS.CRITICALS_PENDING_GATE);
  }
  // (4) AUTHORITATIVE gate fails CLOSED on an unrecognized verdict: anything that
  // is not exactly 'pass' (an out-of-contract string, '', undefined) routes to
  // 'aborted', never silently passes the unit (P-A review). 'pass' alone clears
  // the verify gate.
  if (verifyVerdict !== 'pass') {
    return terminal('aborted', EXIT_REASONS.ABORTED);
  }
  // (5) adversarial diff-reviewer raised a consensus-Critical -> blocking.
  if (Number(blockingDiffCount) > 0) {
    return terminal('blocked', EXIT_REASONS.CRITICALS_PENDING_GATE);
  }
  // (6) executed + verify pass + no consensus-Critical -> unit clean, continue.
  return Object.freeze({ terminal: false, exitReason: null, status: 'clean' });
}

/**
 * Build a frozen TERMINAL verdict, routing the reason through assertExitReason so
 * nothing leaves this module with a reason outside the frozen vocabulary.
 * @param {'blocked'|'aborted'} status
 * @param {string} exitReason
 * @returns {Readonly<object>}
 */
function terminal(status, exitReason) {
  return Object.freeze({
    terminal: true,
    exitReason: assertExitReason(exitReason),
    status,
  });
}
