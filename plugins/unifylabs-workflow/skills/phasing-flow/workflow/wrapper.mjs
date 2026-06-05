// wrapper.mjs — the INJECTION-BASED phasing-flow execution orchestrator (M2).
//
// Wraps the tested kernel (execution-engine.mjs runExecutionLoop) WITHOUT any
// agent() call, i/o, wall-clock, or random. Every effectful step — executeUnit,
// verify, diffReview — is an INJECTED async callback, so a node:test can drive
// the whole wrapper with deterministic stubs and only the thin generated glue
// (src/glue.mjs) binds the real agent()/parallel()-backed callbacks. Mirrors
// iterative-review/workflow/wrapper.mjs exactly.
//
// Flow (runPhasingFlowExecution):
//   (a) normalize the units list (defensive — tolerate a missing/short list);
//   (b) result = await runExecutionLoop({ ...injected callbacks });
//   (c) build + return a FROZEN units-domain report (clean field names; the
//       engine's make-return review-domain fields are translated here).
//
// Determinism: pure orchestration over injected callbacks. No wall-clock, no
// random, no i/o.

import { runExecutionLoop } from './execution-engine.mjs';

/**
 * Run the full phasing-flow execution over injected callbacks.
 *
 * @param {object} opts
 * @param {Array<object>} opts.units      ordered lean units [{id,title,instruction,verify_hint?}]
 * @param {(ctx:object)=>Promise<object|null>} opts.executeUnit
 * @param {(ctx:object)=>Promise<'pass'|'fail'|'fail-permanent'>} opts.verify
 * @param {(ctx:object)=>Promise<number>} opts.diffReview
 * @param {{spent:()=>number, remaining:()=>number, total:number|null}} opts.budget
 * @param {number} [opts.cap]
 * @param {number} [opts.fixedPointK=1]
 * @param {number} [opts.relativeMultiplier=5]
 * @param {number} [opts.absoluteThreshold]
 * @param {string} [opts.workingDir]
 * @param {number} [opts.runSeed]
 * @returns {Promise<Readonly<object>>}  frozen units-domain report
 */
export async function runPhasingFlowExecution({
  units,
  executeUnit,
  verify,
  diffReview,
  budget,
  cap,
  fixedPointK = 1,
  relativeMultiplier = 5,
  absoluteThreshold,
  workingDir,
  runSeed,
} = {}) {
  const normalizedUnits = Array.isArray(units) ? units : [];

  if (typeof executeUnit !== 'function') {
    throw new Error('runPhasingFlowExecution: executeUnit callback is required');
  }

  // --- run the tested kernel ----------------------------------------------
  const result = await runExecutionLoop({
    units: normalizedUnits,
    executeUnit,
    verify,
    diffReview,
    budget,
    cap,
    fixedPointK,
    relativeMultiplier,
    absoluteThreshold,
    workingDir,
    runSeed,
  });

  // --- build the frozen units-domain report -------------------------------
  // Translate the engine's frozen make-return shape (review-domain field names,
  // reused verbatim) into the clean units-domain report the between-runs gate +
  // SKILL render directly. The load-bearing fields (exitReason / truncationLog /
  // budgetSpent) are surfaced verbatim so a silent stop is impossible.
  return Object.freeze({
    exitReason: result.exitReason,
    unitsTotal: normalizedUnits.length,
    unitsCompleted: result.resolved,
    unitsResidual: result.residualCritical,
    budgetSpent: result.budgetSpent,
    truncationLog: result.truncationLog, // already frozen by makeReturn
  });
}
