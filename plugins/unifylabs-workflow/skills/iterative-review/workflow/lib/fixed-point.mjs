// fixed-point.mjs — stall / no-progress detection (M2 foundation, rule 4).
//
// Operates on the AUTO-FIXABLE (Important) working set in the NEW-MODEL — that
// is the set the loop actually shrinks each round (Criticals are collected, not
// fixed in-loop, so they cannot be the progress signal). Three stall triggers:
//
//   (a) NO STRICT SHRINKAGE: curr.size >= prev.size.
//   (b) SET-SWAP: same/larger size and curr is NOT a subset of prev (a finding
//       was swapped in — count looks flat/up but membership changed).
//   (c) CYCLE / OSCILLATION: the canonical set repeats any set seen in the
//       recent round history (catches 2->1->2->1 that a K-consecutive-empty
//       counter misses). If fixedPointK>1 is ever set, the cycle detector is
//       MANDATORY (a longer K window makes oscillation more likely to slip a
//       size-only check, so we always run the history-based detector).
//
// fixedPointK defaults to 1 (strict single-round shrinkage). It is the number
// of consecutive non-shrinking rounds tolerated before declaring a stall via
// triggers (a)/(b). The cycle detector (c) is independent of K and always on.
//
// Determinism: no wall-clock, no random. Pure function of the supplied sets +
// history.

import { isSubset, serializeSet } from './canonical.mjs';

/**
 * @param {object} args
 * @param {Set<string>} args.prev     prior round's canonical Important set
 * @param {Set<string>} args.curr     current round's canonical Important set
 * @param {string[]} args.history     serialized canonical sets from prior rounds
 *                                     (most-recent-first or any order; we scan all)
 * @param {number} args.fixedPointK   consecutive non-shrink rounds tolerated (>=1)
 * @param {number} args.nonShrinkStreak  how many consecutive non-shrinking rounds
 *                                        have already occurred (incl. this one)
 * @returns {{ stalled: boolean, log: string|null }}
 */
export function checkFixedPoint({
  prev,
  curr,
  history,
  fixedPointK,
  nonShrinkStreak,
}) {
  const k = typeof fixedPointK === 'number' && fixedPointK >= 1 ? fixedPointK : 1;

  // --- (c) CYCLE / OSCILLATION — checked FIRST --------------------------
  // `history` holds canonical sets from rounds STRICTLY OLDER than the
  // immediately-preceding round (the engine excludes `prev` from it). So if
  // `curr` matches a member of `history`, we have RE-VISITED an older state
  // after moving away from it — oscillation (e.g. 2 -> 1 -> 2 -> 1). A
  // K-consecutive-non-shrink counter never catches this because each step can
  // show progress vs its immediate predecessor. The cycle detector is what
  // catches it, and because `prev` is excluded from `history`, this does NOT
  // pre-empt the flat-stall case (curr === prev), which rule (a) owns. When
  // fixedPointK>1 this detector is MANDATORY; it is always on here regardless
  // of K.
  const serialized = serializeSet(curr);
  if ((history ?? []).includes(serialized)) {
    return {
      stalled: true,
      log:
        `fixed-point: cycle detected — Important set {${serialized || '∅'}} ` +
        `repeats a set seen in a prior round (oscillation)`,
    };
  }

  const strictShrink = curr.size < prev.size;

  if (strictShrink) {
    // Genuine progress vs prev and not a re-visited older state — keep going.
    return { stalled: false, log: null };
  }

  // --- prev-relative checks (a)/(b) -------------------------------------
  // No strict shrinkage vs the immediately-preceding round.
  const swapped = !isSubset(curr, prev);

  // (b) SET-SWAP: same/larger size AND not a subset => a new finding entered.
  if (curr.size >= prev.size && swapped) {
    return {
      stalled: true,
      log:
        `fixed-point: set-swap — Important set did not shrink ` +
        `(prev ${prev.size}, curr ${curr.size}) and a new finding was swapped in`,
    };
  }

  // (a) NO STRICT SHRINKAGE, tolerated up to K consecutive rounds. With the
  // default K=1, a single non-shrinking round is a stall.
  //
  // K>1 NOTE (FIX 5 — rule-(a) K>1 branch is SUBSUMED by the cycle detector):
  // To accumulate nonShrinkStreak >= 2 we need two consecutive rounds with no
  // strict shrinkage where neither (c) nor (b) fired. "No strict shrinkage"
  // means curr.size >= prev.size; "not a set-swap" means isSubset(curr, prev);
  // together those force curr === prev (a subset that is not smaller is equal).
  // But the engine pushes each continuing round's prev set into `history`, so
  // the moment a round repeats its immediate predecessor's set, that set is
  // ALREADY in `history` and the cycle detector (c) above fires FIRST. Any
  // membership change at equal-or-larger size is instead caught by set-swap (b)
  // at streak 1. Hence rule (a) can only ever fire at streak === 1 (the K=1
  // case); its K>1 branch is unreachable in the live loop. Verified by an
  // exhaustive subset-sequence search (no sequence of length <=5 over a 3-member
  // universe reaches it). We keep the `>= k` form so the rule stays correct if
  // the ordering invariants ever change, but no eval scenario exercises K>1 here
  // because the cycle detector owns that territory.
  if (nonShrinkStreak >= k) {
    return {
      stalled: true,
      log:
        `fixed-point: no strict shrinkage — Important set ` +
        `(prev ${prev.size}, curr ${curr.size}) for ${nonShrinkStreak} ` +
        `consecutive round(s) >= K=${k}`,
    };
  }

  // Non-shrinking but within the K tolerance window — not yet a stall.
  return { stalled: false, log: null };
}
