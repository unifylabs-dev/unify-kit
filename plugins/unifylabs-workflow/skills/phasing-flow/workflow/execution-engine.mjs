// execution-engine.mjs — the phasing-flow execution loop (M2). The flagship
// kernel: PURE CONTROL FLOW over INJECTED async callbacks (executeUnit / verify
// / diffReview) and a budget object. NO agent() call, NO i/o, NO wall-clock, NO
// random — that separation is what makes it node:test-unit-testable with
// deterministic stubs, exactly like iterative-review's stopping-engine.mjs.
//
// MODEL (M2: single-unit serial; the kernel supports units.length > 1 and runs
// them ONE AT A TIME — M3 adds native parallel() fan-out + worktree isolation):
//   for each unit, in order, by integer cursor:
//     (i)   budget circuit-breaker check (cheap, FIRST; from unit 2 on) -> 'circuit-breaker'
//     (ii)  executeUnit(unit) -> manifest | null/error/throw -> 'aborted' if unusable
//     (iii) verify(unit) -> 'pass'|'fail'|'fail-permanent' (AUTHORITATIVE, J4)
//             'fail-permanent' / unrecognized / throw -> 'aborted'; 'fail' (RED) -> 'criticals-pending-gate'
//     (iv)  diffReview(unit) -> consensus-Critical COUNT (fail-OPEN) -> 'criticals-pending-gate'
//     (v)   unit clean -> advance the cursor
//   exhausted all units clean            -> 'clean'
//   units empty                          -> 'skip-if-clean'
//   processed `cap` units, more remain   -> 'cap'
//
// A blocking finding (RED verify or consensus-Critical diff) STOPS the whole loop
// at that unit and hands off to the BETWEEN-RUNS human gate — you cannot proceed
// to the next unit until the human resolves the blocker (the gates-between-runs
// control model: a running Workflow takes no mid-run input). Every exit is one of
// the FROZEN 7 reasons, routed through make-return + assertExitReason: a novel /
// silent stop is impossible by construction.
//
// FAIL DIRECTION (hardened after the P-A adversarial kernel review, wf_0cf2db43):
//   - The AUTHORITATIVE deterministic verify fails CLOSED: a throw, a permanent
//     failure, or an UNRECOGNIZED verdict routes to 'aborted' (never silently
//     passes a unit). executeUnit failure/throw likewise -> 'aborted'.
//   - The non-authoritative adversarial diff-reviewer fails OPEN: a throw or a
//     non-finite return is coerced to 0 (never blocks) — the deterministic verify
//     is the real gate (J4). Every degraded path is logged to truncationLog.
//
// M2 does NOT wire a fixed-point stall ceiling: with a strictly-advancing serial
// cursor a stall cannot occur, and a Set-based stall signal false-positives on
// duplicate-labeled units (P-A review). The loop is bounded by the unit count +
// the `cap` ceiling. M3 (parallel fan-out / retries, where the cursor can stall)
// reintroduces a stall guard then.
//
// References carried from iterative-review (copied verbatim, CI byte-identity
// diff-guarded): lib/clamp, lib/budget-guard, lib/exit-reasons, lib/make-return.

import { clampWithFlag } from './lib/clamp.mjs';
import { checkBudget } from './lib/budget-guard.mjs';
import { makeReturn } from './lib/make-return.mjs';
import { EXIT_REASONS, assertExitReason } from './lib/exit-reasons.mjs';
import { classifyUnit } from './verify-verdict.mjs';

/**
 * Is an executeUnit return a usable manifest? A unit's executor returns a lean
 * manifest object on success, or null/undefined (or an object carrying a truthy
 * `error`) when it failed or was hook-blocked mid-run. PURE.
 * @param {*} m
 * @returns {boolean}
 */
export function isUsableManifest(m) {
  return m != null && typeof m === 'object' && !Array.isArray(m) && !m.error;
}

/** Coerce a thrown value to a short message string (no wall-clock/random). */
function errMessage(e) {
  if (e == null) return 'unknown error';
  if (typeof e === 'object' && typeof e.message === 'string') return e.message;
  return String(e);
}

/**
 * Run the phasing-flow execution loop over an ordered units list.
 *
 * @param {object} opts
 * @param {Array<object>} opts.units      ordered lean units [{id,title,instruction,verify_hint?}]
 * @param {(ctx:object)=>Promise<object|null>} opts.executeUnit   do the unit's work -> manifest|null
 * @param {(ctx:object)=>Promise<'pass'|'fail'|'fail-permanent'>} opts.verify  deterministic verifier
 * @param {(ctx:object)=>Promise<number>} opts.diffReview         adversarial diff-review -> consensus-Critical COUNT
 * @param {{spent:()=>number, remaining:()=>number, total:number|null}} opts.budget
 * @param {number} [opts.cap]             max units to process; default = units.length; clamped to [1, units.length]
 * @param {number} [opts.relativeMultiplier=5]
 * @param {number} [opts.absoluteThreshold]
 * @param {string} [opts.workingDir]      passed through to callbacks (opaque)
 * @param {number} [opts.runSeed]         passed through to callbacks (opaque)
 * @returns {Promise<Readonly<object>>}   frozen make-return shape
 */
export async function runExecutionLoop({
  units,
  executeUnit,
  verify,
  diffReview,
  budget,
  cap,
  relativeMultiplier = 5,
  absoluteThreshold,
  workingDir,
  runSeed,
} = {}) {
  const truncationLog = [];
  const all = Array.isArray(units) ? units : [];
  const totalUnits = all.length;

  if (typeof executeUnit !== 'function') {
    throw new Error('runExecutionLoop: executeUnit callback is required');
  }
  if (typeof verify !== 'function') {
    throw new Error('runExecutionLoop: verify callback is required');
  }
  if (typeof diffReview !== 'function') {
    throw new Error('runExecutionLoop: diffReview callback is required');
  }

  // --- skip-if-clean analogue: no units to run -----------------------------
  if (totalUnits === 0) {
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

  // --- Rule 1: cap clamp-with-warning (max units to process) ---------------
  // Default cap = process every unit. A caller-supplied cap below totalUnits is
  // an intentional ceiling (stop after N units with the rest pending). A clamp is
  // NEVER silent — the warning is pushed onto truncationLog.
  const { value: maxUnits, clamped, raw } = clampWithFlag(
    cap == null ? totalUnits : cap,
    1,
    totalUnits,
  );
  if (clamped) {
    truncationLog.push(`cap ${raw} clamped to ${maxUnits}`);
  }

  // The relative circuit-breaker needs a NON-ZERO baseline. There is no pre-loop
  // "initial pass" here (unlike iterative-review, where the baseline is the
  // initial review cost), and the pre-loop spend is commonly 0 — so a 0 baseline
  // would make 5x0 == 0 and false-trip on any spend (P-A review CRITICAL). We
  // therefore capture the baseline AFTER the first unit's clean cycle (= the cost
  // of doing one unit) and only arm the breaker from the second unit on. A
  // single-unit run cannot run away, so it is never gated.
  let initialCost = null;

  let index = 0; // cursor: number of units consumed (completed clean).
  let completed = 0;

  while (index < totalUnits) {
    // --- (cap) processed the allowed number of units, more remain ----------
    if (index >= maxUnits) {
      truncationLog.push(
        `cap: processed ${maxUnits} unit(s) with ${totalUnits - index} unit(s) ` +
          'still pending',
      );
      return finalize({
        exitReason: EXIT_REASONS.CAP,
        completed,
        residualUnits: totalUnits - index,
        budget,
        truncationLog,
      });
    }

    // --- (i) budget circuit-breaker — cheap, checked FIRST (armed from unit 2)
    if (initialCost !== null) {
      const budgetCheck = checkBudget({
        budget,
        initialReviewCost: initialCost,
        relativeMultiplier,
        absoluteThreshold,
      });
      if (budgetCheck.tripped) {
        truncationLog.push(budgetCheck.log);
        return finalize({
          exitReason: EXIT_REASONS.CIRCUIT_BREAKER,
          completed,
          residualUnits: totalUnits - index,
          budget,
          truncationLog,
        });
      }
    }

    const unit = all[index];
    const unitNum = index + 1;
    const unitLabel = String(unit?.title ?? unit?.id ?? `#${unitNum}`);

    // --- (ii) EXECUTE the unit (fail-CLOSED: a throw -> aborted) ------------
    let manifest = null;
    let execErr = null;
    try {
      manifest = await executeUnit({ unit, index, unitNum, workingDir, runSeed });
    } catch (e) {
      execErr = errMessage(e);
      manifest = null;
    }
    const executeOk = isUsableManifest(manifest);

    // --- (iii) VERIFY (deterministic, authoritative; fail-CLOSED) ----------
    // Only run the verifier when the unit was produced; a failed / hook-blocked
    // executor short-circuits to 'aborted'. A verify throw -> 'fail-permanent'.
    let verifyVerdict = 'pass';
    let verifyErr = null;
    if (executeOk) {
      try {
        verifyVerdict = await verify({ unit, index, unitNum, manifest, workingDir, runSeed });
      } catch (e) {
        verifyErr = errMessage(e);
        verifyVerdict = 'fail-permanent';
      }
    }

    // --- (iv) DIFF-REVIEW (adversarial; fail-OPEN: a throw -> 0) ------------
    // Only run the reviewer when the unit executed + verified pass. The glue
    // returns the consensus-Critical COUNT (it fans out >=2 reviewers +
    // consensus-aggregates). A throw / non-finite return is coerced to 0 and
    // NEVER blocks — the deterministic verify is the real gate (J4).
    let blockingDiffCount = 0;
    if (executeOk && verifyVerdict === 'pass') {
      try {
        const rawCount = await diffReview({ unit, index, unitNum, manifest, workingDir, runSeed });
        blockingDiffCount = Number.isFinite(Number(rawCount)) ? Number(rawCount) : 0;
      } catch (e) {
        truncationLog.push(
          `diff-review: unit ${unitNum} ("${unitLabel}") reviewer threw (${errMessage(e)}) — ` +
            'fail-open, treated as 0 blocking findings',
        );
        blockingDiffCount = 0;
      }
    }

    // --- classify the unit's outcome --------------------------------------
    const verdict = classifyUnit({ executeOk, verifyVerdict, blockingDiffCount });

    if (verdict.terminal) {
      if (verdict.status === 'aborted') {
        let why;
        if (!executeOk) {
          why = execErr
            ? `unit ${unitNum} ("${unitLabel}") executor threw: ${execErr}`
            : `unit ${unitNum} ("${unitLabel}") could not be produced (executor returned ` +
              'no manifest — failed or hook-blocked mid-run)';
        } else if (verifyVerdict === 'fail-permanent') {
          why = verifyErr
            ? `unit ${unitNum} ("${unitLabel}") verifier threw: ${verifyErr}`
            : `unit ${unitNum} ("${unitLabel}") verifier permanently failed`;
        } else {
          why = `unit ${unitNum} ("${unitLabel}") verifier returned an unrecognized verdict ` +
            `"${String(verifyVerdict)}" — failing closed`;
        }
        truncationLog.push(`aborted: ${why}`);
      } else {
        // blocked -> criticals-pending-gate
        const why =
          verifyVerdict === 'fail'
            ? 'deterministic verifier RED'
            : `${blockingDiffCount} consensus-Critical diff finding(s)`;
        truncationLog.push(
          `criticals-pending-gate: unit ${unitNum} ("${unitLabel}") blocked — ` +
            `${why} — handed to the between-runs gate`,
        );
      }
      return finalize({
        exitReason: verdict.exitReason,
        completed,
        residualUnits: totalUnits - index, // this unit + any after it
        budget,
        truncationLog,
      });
    }

    // --- (v) unit CLEAN -> advance the cursor ------------------------------
    index += 1;
    completed += 1;
    // Arm the relative breaker against the cost of the FIRST completed unit.
    if (initialCost === null) {
      initialCost = budget.spent();
    }
  }

  // --- all units consumed clean -------------------------------------------
  return finalize({
    exitReason: EXIT_REASONS.CLEAN,
    completed,
    residualUnits: 0,
    budget,
    truncationLog,
  });
}

/**
 * Build the frozen return. The execution engine reuses iterative-review's
 * make-return shape VERBATIM (so the between-runs gate + journaled-resume reader
 * rely on the SAME keys across both seeds), mapping the UNIT domain onto its
 * review-domain fields:
 *   residualCritical  := residual (unprocessed / blocked / pending) units
 *   resolved          := units completed clean
 *   roundsRun         := units processed this run
 *   residualImportant := unused here (always 0)
 * The wrapper translates these to clean units-domain names (unitsResidual /
 * unitsCompleted) for the report, so the awkward review-domain naming never
 * surfaces to the SKILL or the gate. INVARIANT: resolved + residualCritical
 * === totalUnits on every exit path (asserted in the test harness).
 * @returns {Readonly<object>}
 */
function finalize({ exitReason, completed, residualUnits, budget, truncationLog }) {
  assertExitReason(exitReason);
  return makeReturn({
    exitReason,
    roundsRun: completed,
    budgetSpent: budget.spent(),
    residualCritical: residualUnits,
    residualImportant: 0,
    resolved: completed,
    truncationLog,
  });
}
