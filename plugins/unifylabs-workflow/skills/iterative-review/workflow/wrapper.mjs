// wrapper.mjs — the INJECTION-BASED iterative-review orchestrator (M1 P3).
//
// This wraps the tested kernel (stopping-engine.mjs runLoopUntilDry) with the
// review flow described in SKILL.md, WITHOUT any agent() call, i/o, wall-clock,
// or random. Every effectful step — the initial review, the per-round
// re-review, the fixer, the verifier — is an INJECTED async callback. That
// mirrors the engine's own pattern: a node:test can drive the entire wrapper
// with deterministic stubs, and only the thin generated glue (src/glue.mjs)
// binds the real agent()/parallel()/Bash-backed callbacks.
//
// Flow (runIterativeReview):
//   (a) resolve mode — use injected `mode` or detectMode(target);
//   (b) initialFindings = await initialReview({mode,target,workingDir,runSeed});
//   (c) result = await runLoopUntilDry({ ...injected loop callbacks });
//   (d) build + return a FROZEN structured report.
//
// Determinism: pure orchestration over injected callbacks. No wall-clock, no
// random, no i/o. (The callbacks themselves may be effectful; that lives in the
// glue, which is not part of the determinism guard's enforced contract because
// it cannot run without the Workflow runtime — but it still avoids the
// forbidden tokens so the recursive guard scan stays green.)

import { detectMode } from './lib/mode-detect.mjs';
import { runLoopUntilDry } from './stopping-engine.mjs';
import { tierOf } from './stopping-engine.mjs';

/**
 * Summarize a findings array into per-tier counts, using the SAME tier logic
 * the engine uses (tierOf), so the report agrees with the loop's bookkeeping.
 * @param {Array<object>} findings
 * @returns {{critical:number,important:number,suggestion:number,total:number}}
 */
function summarize(findings) {
  let critical = 0;
  let important = 0;
  let suggestion = 0;
  for (const f of findings ?? []) {
    const t = tierOf(f);
    if (t === 'critical') critical += 1;
    else if (t === 'important') important += 1;
    else suggestion += 1;
  }
  return {
    critical,
    important,
    suggestion,
    total: critical + important + suggestion,
  };
}

/**
 * Run the full iterative-review orchestration over injected callbacks.
 *
 * @param {object} opts
 * @param {'code'|'doc'|'phase'} [opts.mode]   explicit mode; else detectMode(target)
 * @param {string} [opts.target]               the review target (path / PR / phase arg)
 * @param {(ctx:object)=>Promise<Array<object>>} opts.initialReview  initial review pass cb
 * @param {(ctx:object)=>Promise<Array<object>>} opts.reviewRound    per-round re-review cb
 * @param {(ctx:object)=>Promise<void|object>}  opts.applyFixes      fixer cb
 * @param {(ctx:object)=>Promise<'pass'|'fail'|'fail-permanent'>} opts.verify  verifier cb
 * @param {{spent:()=>number,remaining:()=>number,total:number|null}} opts.budget
 * @param {number} [opts.cap=3]
 * @param {number} [opts.fixedPointK=1]
 * @param {boolean} [opts.skipClean=true]
 * @param {boolean} [opts.includeSuggestions=false]
 * @param {boolean} [opts.gateImportant=false]
 * @param {string} [opts.workingDir]
 * @param {number} [opts.runSeed]
 * @returns {Promise<Readonly<object>>}  frozen structured report
 */
export async function runIterativeReview({
  mode,
  target,
  initialReview,
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
} = {}) {
  // --- (a) resolve mode ----------------------------------------------------
  const resolvedMode = mode ?? detectMode(target);

  if (typeof initialReview !== 'function') {
    throw new Error('runIterativeReview: initialReview callback is required');
  }

  // --- (b) initial review pass --------------------------------------------
  // The glue's initialReview is responsible for fanning out the review agents
  // (via native parallel()) and accruing their cost into `budget` BEFORE the
  // engine captures its baseline. We pass the resolved mode through so the glue
  // can pick the code- vs doc- reviewer set.
  const initialFindingsRaw = await initialReview({
    mode: resolvedMode,
    target,
    workingDir,
    runSeed,
  });
  const initialFindings = Array.isArray(initialFindingsRaw)
    ? initialFindingsRaw
    : [];

  const findingsSummary = summarize(initialFindings);

  // --- (c) run the tested kernel ------------------------------------------
  const result = await runLoopUntilDry({
    initialFindings,
    reviewRound,
    applyFixes,
    verify,
    budget,
    cap,
    fixedPointK,
    skipClean,
    includeSuggestions,
    gateImportant,
    workingDir,
    runSeed,
  });

  // --- (d) build the frozen structured report -----------------------------
  // Surface the engine's load-bearing fields verbatim (exitReason / residuals /
  // resolved / budgetSpent / truncationLog) plus the resolved mode and the
  // initial findings summary, so the between-runs gate and the SKILL.md report
  // step can render without re-deriving anything.
  return Object.freeze({
    mode: resolvedMode,
    exitReason: result.exitReason,
    roundsRun: result.roundsRun,
    residualCritical: result.residualCritical,
    residualImportant: result.residualImportant,
    resolved: result.resolved,
    budgetSpent: result.budgetSpent,
    truncationLog: result.truncationLog, // already frozen by makeReturn
    findingsSummary: Object.freeze(findingsSummary),
  });
}
