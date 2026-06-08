// stopping-engine.mjs — M1's load-bearing kernel: the enforced loop-until-dry.
//
// THE WHOLE POINT: the ceilings are PROVABLE by running code, not prose a model
// is asked to honor. This file is PURE CONTROL FLOW over INJECTED async
// callbacks (reviewRound / applyFixes / verify) and a budget object. It contains
// NO agent() call, NO i/o, NO wall-clock, NO random. That separation is what
// makes it unit-testable with deterministic stubs (the eval-JSON harness).
//
// NEW-MODEL SEMANTICS (a running Workflow takes NO mid-run human input):
//   - Criticals are COLLECTED, never fixed in-loop. Fixing a Critical needs the
//     between-runs human gate, so the loop hands them off via the
//     'criticals-pending-gate' exit reason.
//   - The loop AUTO-FIXES Important findings each round and re-reviews. With
//     gateImportant, Important is ALSO collected (not auto-fixed).
//   - Suggestions are report-only unless includeSuggestions (then collected for
//     the gate, still never auto-fixed).
//
// SEVERITY (severity-policy.md): Critical = score>=90; Important = 80-89;
// Suggestion = <80. A finding may carry an explicit `severity` tag that
// overrides the score-derived tier.
//
// EXIT PRECEDENCE (after each round's re-review) — see classifyExit().
//
// References re-homed here:
//   references/stopping-rules.md   — the 5 rules + per-iteration ORDERING
//   references/severity-policy.md  — tiers + aggregation key (file,line,desc)

import { clampWithFlag } from './lib/clamp.mjs';
import {
  canonical,
  canonicalSet,
  serializeSet,
} from './lib/canonical.mjs';
import { checkFixedPoint } from './lib/fixed-point.mjs';
import { checkBudget } from './lib/budget-guard.mjs';
import { makeReturn } from './lib/make-return.mjs';
import { EXIT_REASONS, assertExitReason } from './lib/exit-reasons.mjs';

// ---------------------------------------------------------------------------
// Severity classification
// ---------------------------------------------------------------------------

/**
 * Derive a finding's tier: 'critical' | 'important' | 'suggestion'.
 * Explicit string `severity` tag wins; otherwise derive from numeric `score`.
 * @param {object} f
 * @returns {'critical'|'important'|'suggestion'}
 */
export function tierOf(f) {
  const tag = String(f?.severity ?? '').toLowerCase();
  if (tag === 'critical' || tag === 'important' || tag === 'suggestion') {
    return tag;
  }
  const score = Number(f?.score);
  if (Number.isFinite(score)) {
    if (score >= 90) return 'critical';
    if (score >= 80) return 'important';
    return 'suggestion';
  }
  // No usable signal: treat as a suggestion (the most conservative, never
  // auto-fixed, never gating) so an under-specified finding cannot silently
  // become a blocker.
  return 'suggestion';
}

/**
 * Split a finding array into the three tiers.
 * @param {Array<object>} findings
 * @returns {{critical: object[], important: object[], suggestion: object[]}}
 */
function categorize(findings) {
  const critical = [];
  const important = [];
  const suggestion = [];
  for (const f of findings ?? []) {
    const t = tierOf(f);
    if (t === 'critical') critical.push(f);
    else if (t === 'important') important.push(f);
    else suggestion.push(f);
  }
  return { critical, important, suggestion };
}

/**
 * The "auto-fixable working set" the loop tries to shrink each round. In the
 * default model that is Important. With gateImportant, Important is collected
 * (not auto-fixed), so the working set is empty. With includeSuggestions,
 * Suggestions are collected too (still never auto-fixed) — they affect the
 * clean/skip gates but are NOT part of the shrink signal.
 *
 * Returns the array of findings the loop will auto-fix this round.
 * @param {{important: object[]}} cat
 * @param {boolean} gateImportant
 * @returns {object[]}
 */
function autoFixSet(cat, gateImportant) {
  if (gateImportant) return [];
  return cat.important;
}

// ---------------------------------------------------------------------------
// Exit classification — the precedence ladder (post-review, in-loop)
// ---------------------------------------------------------------------------

/**
 * Decide the exit reason (or null to continue) AFTER a round's re-review.
 *
 * "Blocking findings" = findings that are COLLECTED for the between-runs human
 * gate rather than auto-fixed in-loop. That is residual Criticals (ALWAYS,
 * since Criticals are never fixed in-loop) PLUS residual collected Important
 * when --gate-important is set (Important is then collected, not auto-fixed).
 * 'clean' requires ZERO residual blocking findings AND zero auto-fixable work
 * AND zero promoted Suggestions; any residual blocking findings route to
 * 'criticals-pending-gate' instead.
 *
 * Precedence (highest first):
 *   (i)   budget tripped        -> 'circuit-breaker'
 *   (ii)  verify perm-failed    -> 'aborted'
 *   (iii) 0 blocking findings AND 0 auto-fixable Important AND (0 promoted
 *         Suggestions when includeSuggestions) -> 'clean'
 *   (iv)  blocking findings remain AND (working set empty OR stalled OR
 *         round==cap) -> 'criticals-pending-gate'
 *   (v)   NO blocking findings AND working set did not strictly shrink
 *         (stall/swap/cycle) -> 'fixed-point'
 *   (vi)  NO blocking findings AND round==maxRounds -> 'cap'
 *   (vii) otherwise null (continue)
 *
 * @param {object} a
 * @returns {string|null}
 */
function classifyExit(a) {
  const {
    budgetTripped,
    verifyPermFailed,
    criticalCount,
    gatedImportantCount, // residual COLLECTED Important; only > 0 under gateImportant
    workingCount, // auto-fixable Important still present this round
    promotedSuggestionCount, // only > 0 when includeSuggestions
    stalled,
    atCap,
  } = a;

  // Blocking findings awaiting the between-runs human gate: Criticals always,
  // plus collected Important under --gate-important.
  const blockingCount = criticalCount + gatedImportantCount;

  // (i)
  if (budgetTripped) return EXIT_REASONS.CIRCUIT_BREAKER;
  // (ii)
  if (verifyPermFailed) return EXIT_REASONS.ABORTED;
  // (iii) clean — nothing left to collect or fix at any gated tier.
  if (
    blockingCount === 0 &&
    workingCount === 0 &&
    promotedSuggestionCount === 0
  ) {
    return EXIT_REASONS.CLEAN;
  }
  // (iv) Blocking findings remain and there is nothing productive left to do
  // this round (or we are out of rounds / stalled). Hand them to the
  // between-runs gate. MUST win over 'fixed-point' and 'cap' when blocking
  // findings are present.
  if (blockingCount > 0) {
    if (workingCount === 0 || stalled || atCap) {
      return EXIT_REASONS.CRITICALS_PENDING_GATE;
    }
    // Blocking findings remain but there is still auto-fixable work and room to
    // run.
    return null;
  }
  // From here: blockingCount === 0.
  // (v) stall on the Important working set.
  if (stalled) return EXIT_REASONS.FIXED_POINT;
  // (vi) ran out of rounds with no blocking findings.
  if (atCap) return EXIT_REASONS.CAP;
  // (vii) continue.
  return null;
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

/**
 * Run the review→fix→verify→re-review loop until a ceiling fires.
 *
 * @param {object} opts
 * @param {Array<object>} opts.initialFindings   findings from the initial pass
 * @param {(ctx: object) => Promise<Array<object>>} opts.reviewRound  re-review cb
 * @param {(ctx: object) => Promise<void|object>} opts.applyFixes     fixer cb
 * @param {(ctx: object) => Promise<'pass'|'fail'|'fail-permanent'>} opts.verify
 * @param {{ spent: () => number, remaining: () => number, total: number|null }} opts.budget
 * @param {number} [opts.cap=3]               raw cap; clamped to [1,5]
 * @param {number} [opts.fixedPointK=1]       consecutive non-shrink tolerance
 * @param {boolean} [opts.skipClean=true]     pre-loop skip-if-clean gate
 * @param {boolean} [opts.includeSuggestions=false] promote Suggestions to the gate
 * @param {boolean} [opts.gateImportant=false] collect Important instead of fixing
 * @param {string} [opts.workingDir]          passed through to callbacks (opaque)
 * @param {number} [opts.runSeed]             passed through to callbacks (opaque)
 * @param {number} [opts.relativeMultiplier=5]
 * @param {number} [opts.absoluteThreshold]
 * @returns {Promise<Readonly<object>>}        frozen make-return shape
 */
export async function runLoopUntilDry({
  initialFindings,
  reviewRound,
  applyFixes,
  verify,
  budget,
  cap = 3,
  fixedPointK = 1,
  skipClean = true,
  includeSuggestions = false,
  gateImportant = false,
  workingDir,
  runSeed,
  relativeMultiplier = 5,
  absoluteThreshold,
} = {}) {
  const truncationLog = [];

  // --- Rule 1: MAX-ROUNDS clamp-with-warning -------------------------------
  const { value: maxRounds, clamped, raw } = clampWithFlag(cap ?? 3, 1, 5);
  if (clamped) {
    truncationLog.push(`cap ${raw} clamped to ${maxRounds}`);
  }

  // --- Initial categorization ----------------------------------------------
  let cat = categorize(initialFindings);
  let working = autoFixSet(cat, gateImportant);
  const promotedSuggestionCount = includeSuggestions
    ? cat.suggestion.length
    : 0;

  // initialReviewCost: captured ONCE immediately after the initial review pass.
  // The injected budget has already accrued the initial-pass spend before the
  // engine is called, so spent() here IS the baseline. Works even when
  // budget.total is null.
  const initialReviewCost = budget.spent();

  // Track how many Important findings we resolve over the run. Baseline is the
  // initial auto-fixable count; resolved = baseline - residual (floored at 0),
  // recomputed at exit so swaps don't inflate it.
  const initialImportantCount = working.length;

  // --- Rule 2: SKIP-IF-CLEAN (pre-loop) ------------------------------------
  // If enabled and the INITIAL set has 0 Critical AND 0 Important (AND 0
  // promoted Suggestions when includeSuggestions) -> skip without entering the
  // loop. reviewRound is NEVER called.
  if (skipClean) {
    const cleanInitial =
      cat.critical.length === 0 &&
      cat.important.length === 0 &&
      promotedSuggestionCount === 0;
    if (cleanInitial) {
      return makeReturn({
        exitReason: assertExitReason(EXIT_REASONS.SKIP_IF_CLEAN),
        roundsRun: 0,
        budgetSpent: budget.spent(),
        residualCritical: 0,
        residualImportant: 0,
        resolved: 0,
        truncationLog,
      });
    }
  } else {
    // --no-skip-clean disables the pre-gate; push a warning. An empty initial
    // set under this flag falls THROUGH the loop to 'clean' (iii), NOT
    // 'fixed-point'.
    truncationLog.push('skip-if-clean disabled (--no-skip-clean)');
  }

  // --- The loop ------------------------------------------------------------
  // `prevWorkingSet` is the canonical set of the auto-fixable working set as it
  // stood ENTERING the current round (i.e., the set we tried to shrink). After
  // re-review we compare the NEW working set against it.
  //
  // `history` holds serialized canonical sets from rounds STRICTLY OLDER than
  // `prevWorkingSet`. It deliberately EXCLUDES the immediately-preceding set so
  // the cycle detector fires only on RE-VISITING an older state (oscillation),
  // not on a flat curr===prev stall (which rule (a) owns). The previous set is
  // pushed into `history` only when a round CONTINUES — at which point it has
  // become "older than" the new prev.
  let prevWorkingSet = canonicalSet(working);
  const history = [];

  let round = 0;
  let nonShrinkStreak = 0;
  let residualCriticalCount = cat.critical.length;
  let residualImportantCount = working.length;

  // Guard against any pathological infinite loop independent of maxRounds:
  // maxRounds is <=5 and we increment every iteration, so this is belt-and-
  // suspenders only.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    round += 1;

    // --- Step (per-iteration ORDER): budget FIRST ------------------------
    // Checked before entering the costly fixer so a cheap rule exits first.
    const budgetCheck = checkBudget({
      budget,
      initialReviewCost,
      relativeMultiplier,
      absoluteThreshold,
    });
    if (budgetCheck.tripped) {
      truncationLog.push(budgetCheck.log);
      return finalize({
        exitReason: EXIT_REASONS.CIRCUIT_BREAKER,
        round,
        budget,
        residualCriticalCount,
        residualImportantCount,
        initialImportantCount,
        truncationLog,
      });
    }

    // --- AUTO-FIX the Important working set (NEW-MODEL: collect Criticals) --
    // Criticals are never fixed in-loop. With gateImportant the working set is
    // empty, so applyFixes is a no-op pass-through but still invoked for symmetry
    // ONLY when there is work; we skip the call when nothing is auto-fixable to
    // avoid spurious side effects.
    if (working.length > 0) {
      await applyFixes({
        findings: working,
        round,
        workingDir,
        runSeed,
      });
    }

    // --- VERIFY -----------------------------------------------------------
    const verdict = await verify({ round, workingDir, runSeed });
    if (verdict === 'fail-permanent') {
      truncationLog.push(
        `aborted: verifier permanently failed at round ${round}`,
      );
      return finalize({
        exitReason: EXIT_REASONS.ABORTED,
        round,
        budget,
        residualCriticalCount,
        residualImportantCount,
        initialImportantCount,
        truncationLog,
      });
    }
    // A transient 'fail' is tolerated (the auto-fix retry happens via the next
    // round's review); only 'fail-permanent' aborts. 'pass' continues.

    // --- RE-REVIEW --------------------------------------------------------
    const newFindings = await reviewRound({
      round,
      workingDir,
      runSeed,
      prevFindings: working,
    });
    cat = categorize(newFindings);
    const newWorking = autoFixSet(cat, gateImportant);
    const promotedNow = includeSuggestions ? cat.suggestion.length : 0;
    // Under --gate-important, Important findings are COLLECTED (not auto-fixed),
    // so residual collected Important is a BLOCKING finding awaiting the gate —
    // it must not be allowed to exit 'clean'. With auto-fix (default) Important
    // is the shrink signal, not a blocking finding, so this is 0.
    const gatedImportantNow = gateImportant ? cat.important.length : 0;

    residualCriticalCount = cat.critical.length;
    residualImportantCount = cat.important.length;

    const currWorkingSet = canonicalSet(newWorking);

    // --- FIXED-POINT detection on the working set ------------------------
    // Update the non-shrink streak before the check.
    const strictShrink = currWorkingSet.size < prevWorkingSet.size;
    nonShrinkStreak = strictShrink ? 0 : nonShrinkStreak + 1;

    const fp = checkFixedPoint({
      prev: prevWorkingSet,
      curr: currWorkingSet,
      history,
      fixedPointK,
      nonShrinkStreak,
    });

    const atCap = round >= maxRounds;

    // --- Classify the exit (precedence ladder) ---------------------------
    const reason = classifyExit({
      budgetTripped: false, // already handled at top of iteration
      verifyPermFailed: false, // already handled above
      criticalCount: residualCriticalCount,
      gatedImportantCount: gatedImportantNow,
      workingCount: currWorkingSet.size,
      promotedSuggestionCount: promotedNow,
      stalled: fp.stalled,
      atCap,
    });

    if (reason !== null) {
      // Attach the stall/cap/handoff log line where one exists.
      if (reason === EXIT_REASONS.FIXED_POINT && fp.log) {
        truncationLog.push(fp.log);
      } else if (reason === EXIT_REASONS.CAP) {
        truncationLog.push(
          `cap: reached maxRounds ${maxRounds} with no residual Criticals`,
        );
      } else if (reason === EXIT_REASONS.CRITICALS_PENDING_GATE) {
        const why = fp.stalled
          ? 'stalled'
          : currWorkingSet.size === 0
            ? 'no auto-fixable findings left'
            : atCap
              ? `reached maxRounds ${maxRounds}`
              : 'no productive work left';
        // Blocking findings = residual Criticals (always) + residual collected
        // Important (under --gate-important). Name both so the handoff line is
        // accurate when Important is the blocker and there are no Criticals.
        const blocking = [];
        if (residualCriticalCount > 0) {
          blocking.push(`${residualCriticalCount} Critical(s)`);
        }
        if (gatedImportantNow > 0) {
          blocking.push(`${gatedImportantNow} collected Important`);
        }
        truncationLog.push(
          `criticals-pending-gate: ${blocking.join(' + ')} residual ` +
            `blocking finding(s) handed to the between-runs gate (${why})`,
        );
      }
      return finalize({
        exitReason: reason,
        round,
        budget,
        residualCriticalCount,
        residualImportantCount,
        initialImportantCount,
        truncationLog,
      });
    }

    // --- Continue: advance state for the next round ----------------------
    // The set we just compared against (`prevWorkingSet`) is now strictly older
    // than the new prev (`currWorkingSet`), so it joins `history` — making it
    // visible to the cycle detector on subsequent rounds. `currWorkingSet`
    // itself is NOT pushed: it becomes the new `prev`, which the detector
    // excludes by construction.
    history.push(serializeSet(prevWorkingSet));
    working = newWorking;
    prevWorkingSet = currWorkingSet;
  }
}

/**
 * Build the frozen return, computing `resolved` from baseline minus residual.
 */
function finalize({
  exitReason,
  round,
  budget,
  residualCriticalCount,
  residualImportantCount,
  initialImportantCount,
  truncationLog,
}) {
  assertExitReason(exitReason);
  const resolved = Math.max(0, initialImportantCount - residualImportantCount);
  return makeReturn({
    exitReason,
    roundsRun: round,
    budgetSpent: budget.spent(),
    residualCritical: residualCriticalCount,
    residualImportant: residualImportantCount,
    resolved,
    truncationLog,
  });
}

// Re-export the canonical helper for callers/tests that want the same key the
// engine uses (single source of truth on what "the same finding" means).
export { canonical };
