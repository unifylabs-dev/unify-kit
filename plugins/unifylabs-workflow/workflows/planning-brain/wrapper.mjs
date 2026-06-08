// wrapper.mjs — the INJECTION-BASED planning-brain orchestrator (M2 seed).
//
// This wraps the pure planning-core kernel with the Ground -> Plan -> Critique
// -> Judge flow, WITHOUT any agent()/parallel() call, i/o, wall-clock, or random.
// Every effectful step — the scouts, the angled planners, the adversarial critic,
// the judge — is an INJECTED async callback. That mirrors the iterative-review
// wrapper exactly: a node:test can drive the entire wrapper with deterministic
// stubs, and only the thin generated glue (src/glue.mjs) binds the real
// agent()/parallel()-backed callbacks.
//
// Flow (runPlanningBrain):
//   (a) GROUND (optional) — if `runScouts` is injected, fan out scout agents to
//       read repo/task state into structured briefs; aggregate + filter; the
//       surviving briefs become part of the planners' shared `facts`.
//   (b) PLAN — build the per-angle planner specs from the ANGLES table, run them
//       in parallel via `runPlanners`, then SALVAGE (.filter(Boolean)) the
//       outputs so a planner that returned nothing cannot crash the run.
//   (c) CRITIQUE — one adversarial critic reads ALL surviving plans (lean input)
//       and hunts gaps/edge-cases/gaming.
//   (d) JUDGE — synthesize ONE master plan from the surviving plans + the
//       critique, explicitly told some planners may have returned nothing.
//   (e) assemble + return the FROZEN result.
//
// Determinism: pure orchestration over injected callbacks. No wall-clock, no
// random, no i/o. (The callbacks themselves may be effectful; that lives in the
// glue, which still avoids the forbidden tokens so the determinism guard stays
// green.)

import {
  plannerSpecsFromAngles,
  salvagePlans,
  assembleCriticInput,
  assembleJudgeInput,
  aggregateGroundBriefs,
  assemblePlanningResult,
} from './lib/planning-core.mjs';

/**
 * Run the full planning-brain orchestration over injected callbacks.
 *
 * @param {object} opts
 * @param {string} opts.task                 the task statement / one-liner to plan
 * @param {string} [opts.facts]              caller-supplied ground-truth brief
 * @param {string} [opts.plansDir]           where manifest planners write heavy content
 * @param {(ctx:object)=>Promise<Array<*>>} [opts.runScouts]   GROUND: fan out scout agents -> raw briefs
 * @param {(ctx:object)=>Promise<Array<*>>} opts.runPlanners   PLAN: run the angled planner specs -> raw plans
 * @param {(ctx:object)=>Promise<object|null>} opts.runCritic  CRITIQUE: adversarial critic over all plans
 * @param {(ctx:object)=>Promise<object|null>} opts.runJudge   JUDGE: synthesize one master plan
 * @param {(msg:string)=>void} [opts.log]    optional structured log sink
 * @returns {Promise<Readonly<object>>}  frozen { master_plan, critique, angled_plans, ground_briefs?, scout_count }
 */
export async function runPlanningBrain({
  task,
  facts,
  plansDir,
  runScouts,
  runPlanners,
  runCritic,
  runJudge,
  log,
} = {}) {
  const note = typeof log === 'function' ? log : () => {};

  if (typeof runPlanners !== 'function') {
    throw new Error('runPlanningBrain: runPlanners callback is required');
  }
  if (typeof runCritic !== 'function') {
    throw new Error('runPlanningBrain: runCritic callback is required');
  }
  if (typeof runJudge !== 'function') {
    throw new Error('runPlanningBrain: runJudge callback is required');
  }

  // --- (a) GROUND (optional) ------------------------------------------------
  // If scouts are injected, run them and fold the surviving briefs into the
  // shared `facts` the planners see. The Ground stage is OPTIONAL — when no
  // `runScouts` callback is injected, the seed plans directly from caller facts.
  let groundBriefs = null;
  let scoutCount = 0;
  let effectiveFacts = String(facts ?? '');
  if (typeof runScouts === 'function') {
    const rawBriefs = await runScouts({ task, facts: effectiveFacts });
    const ground = aggregateGroundBriefs(rawBriefs);
    groundBriefs = ground.briefs;
    scoutCount = ground.scout_count;
    note(`ground: ${scoutCount} surviving scout brief(s)`);
    // Fold the briefs into the facts the planners are grounded on. We thread the
    // structured briefs through to the glue (which may serialize them); here we
    // only record that they exist + keep the caller facts as the textual base.
  }

  // --- (b) PLAN -------------------------------------------------------------
  // Build the per-angle planner specs (pure) then run them in parallel (glue).
  const specs = plannerSpecsFromAngles({
    task,
    facts: effectiveFacts,
    plansDir,
  });
  const rawPlans = await runPlanners({ specs, task, facts: effectiveFacts, groundBriefs });

  // MANDATORY SALVAGE: a planner that returned nothing is dropped; the critic +
  // judge run on whatever survives. This is the lean-schema-failure guard.
  const salvage = salvagePlans(rawPlans);
  note(
    `plan: ${salvage.survived}/${salvage.total} planner(s) survived` +
      (salvage.some_dropped ? ` (${salvage.dropped} returned nothing)` : ''),
  );

  // --- (c) CRITIQUE ---------------------------------------------------------
  const criticInput = assembleCriticInput({
    task,
    facts: effectiveFacts,
    salvage,
  });
  const critiqueRaw = await runCritic(criticInput);
  const critique =
    critiqueRaw != null && typeof critiqueRaw === 'object' ? critiqueRaw : null;
  note(`critique: ${critique ? 'received' : 'none'}`);

  // --- (d) JUDGE ------------------------------------------------------------
  // The judge receives ALL surviving plans + the critic output, and is told some
  // planners may have returned nothing.
  const judgeInput = assembleJudgeInput({
    task,
    facts: effectiveFacts,
    salvage,
    critique,
  });
  const masterPlanRaw = await runJudge(judgeInput);
  const masterPlan =
    masterPlanRaw != null && typeof masterPlanRaw === 'object'
      ? masterPlanRaw
      : null;
  note(`judge: ${masterPlan ? 'master plan synthesized' : 'no plan returned'}`);

  // --- (e) assemble the frozen result --------------------------------------
  return assemblePlanningResult({
    masterPlan,
    critique,
    angledPlans: salvage.plans,
    groundBriefs,
    scoutCount,
  });
}
