// planning-core.mjs — the PURE logic kernel of the planning-brain seed (M2 seed).
//
// THE WHOLE POINT: every transform that does NOT need the Workflow runtime lives
// here so it is unit-testable with deterministic fixtures. This file contains NO
// agent()/parallel() call, NO i/o, NO Date.now/Math.random/wall-clock. The only
// inputs are its arguments; the only outputs are pure values.
//
// What lives here:
//   - the ANGLES table (the planner lenses — copied-in-shape from the dogfooded
//     stophook-design planning brain, but applied to a GENERIC planning task);
//   - plannerSpecsFromAngles(): build the per-planner spec list from ANGLES + the
//     shared task brief;
//   - salvagePlans(): the MANDATORY downstream-salvage .filter(Boolean) that
//     drops planners which returned nothing (the lean-schema-failure lesson:
//     this session a planner with a ~14-field nested+hyphenated-key schema never
//     called StructuredOutput and returned null — the loop MUST survive that);
//   - assembleCriticInput() / assembleJudgeInput(): assemble the lean
//     downstream-stage inputs with DEFENSIVE accessors over prior-stage output;
//   - assemblePlanningResult(): the final frozen return shape.
//
// LEAN-SCHEMA DISCIPLINE baked in here (see README.md):
//   (1) the schemas the glue uses are LEAN + flat-ish (few required fields);
//   (2) snake_case keys ONLY — never hyphenated (a hyphenated key cannot be a
//       bare object property and was a direct cause of the null-return failure);
//   (3) heavy plan content is written to disk by a manifest agent where it fits —
//       these assemblers only thread the LEAN manifests/summaries;
//   (4) salvage is MANDATORY: planners may return null -> filter -> critic ->
//       judge, and the judge input explicitly carries `some_planners_returned_nothing`
//       so the judge prompt can tell the model to synthesize from whatever survives;
//   (5) defensive accessors (`?.` + `?? fallback`) on every prior-stage field.
//
// Determinism: pure functions of the arguments. No wall-clock, no random, no i/o.

// ---------------------------------------------------------------------------
// The ANGLES table — the planner lenses.
// ---------------------------------------------------------------------------
//
// Each angle is ONE planner that produces a full plan through a different lens.
// snake_case `key` only. The dogfooded brain used 3 angles; we keep that shape
// but phrase the lenses generically so the seed plans ANY task, not just the
// Stop-hook design it was first dogfooded on. M2 may extend this table when it
// wires /phasing-flow plan.
const ANGLES = Object.freeze([
  Object.freeze({
    key: 'minimal_scope',
    lens:
      'Prioritize the SMALLEST plan that genuinely satisfies the task. Defer ' +
      'everything deferrable. Favor the fewest moving parts, the least new ' +
      'surface area, and the cheapest path to a verifiable result.',
  }),
  Object.freeze({
    key: 'robust_general',
    lens:
      'Prioritize a robust, general plan that holds up across edge cases and ' +
      'future variation. Solve the cross-cutting concerns (failure modes, ' +
      'rollback, idempotency, the general case) thoroughly rather than the ' +
      'happy path only.',
  }),
  Object.freeze({
    key: 'risk_provability',
    lens:
      'Prioritize two things equally: (a) minimal blast radius / surprise for ' +
      'everyone downstream, and (b) maximal provability — every claim the plan ' +
      'makes should be checkable by running something, not by trusting prose. ' +
      'Treat the task’s stated invariants as sacred and design so they are ' +
      'unambiguously enforced.',
  }),
]);

/**
 * The frozen list of angle keys, for membership/count checks in tests + the glue.
 * @returns {readonly string[]}
 */
function angleKeys() {
  return Object.freeze(ANGLES.map((a) => a.key));
}

// ---------------------------------------------------------------------------
// Planner-spec construction.
// ---------------------------------------------------------------------------

/**
 * Build one planner spec from an angle + the shared task brief. The spec is a
 * PLAIN data object (no agent()/parallel()) so it is unit-testable; the glue
 * turns it into an agent() call. The `schema` is supplied by the glue (it is the
 * runtime-shaped lean schema) and threaded through verbatim, so this stays pure.
 *
 * @param {{key:string, lens:string}} angle
 * @param {object} opts
 * @param {string} opts.task           the task statement / one-liner
 * @param {string} [opts.facts]        the shared ground-truth brief (may be empty)
 * @param {string} [opts.plansDir]     where a manifest planner writes heavy content
 * @param {object} [opts.schema]       the lean planner output schema (from the glue)
 * @returns {{key:string, label:string, lens:string, task:string, facts:string, plansDir:string, schema:object|null}}
 */
function plannerSpecFromAngle(angle, { task, facts, plansDir, schema } = {}) {
  return {
    key: angle?.key ?? '',
    label: `plan:${angle?.key ?? 'unknown'}`,
    lens: angle?.lens ?? '',
    task: String(task ?? ''),
    facts: String(facts ?? ''),
    plansDir: String(plansDir ?? ''),
    schema: schema ?? null,
  };
}

/**
 * Build the full planner-spec list from the ANGLES table + the shared brief.
 * One spec per angle, in the frozen ANGLES order (deterministic).
 *
 * @param {object} opts  forwarded to plannerSpecFromAngle (task/facts/plansDir/schema)
 * @returns {Array<object>}
 */
function plannerSpecsFromAngles(opts = {}) {
  return ANGLES.map((angle) => plannerSpecFromAngle(angle, opts));
}

// ---------------------------------------------------------------------------
// SALVAGE — the mandatory downstream filter (the lean-schema-failure lesson).
// ---------------------------------------------------------------------------

/**
 * A planner output "survives" iff it is a non-null object (a plan). A planner
 * that never called StructuredOutput returns null/undefined; a planner that
 * returned a primitive is also discarded. This is the single chokepoint the
 * critic + judge are fed from — so a dead planner cannot crash the run.
 * @param {*} plan
 * @returns {boolean}
 */
function isSurvivingPlan(plan) {
  return plan != null && typeof plan === 'object' && !Array.isArray(plan);
}

/**
 * MANDATORY downstream salvage: drop planners that returned nothing.
 * `.filter(Boolean)` semantics, hardened to also drop non-object outputs.
 * Returns { plans, total, survived, dropped, someDropped } so the caller can
 * tell the judge that some planners returned nothing (lean-schema discipline #4).
 *
 * @param {Array<*>} rawPlans  the parallel() planner outputs (may contain null)
 * @returns {{plans:object[], total:number, survived:number, dropped:number, someDropped:boolean}}
 */
function salvagePlans(rawPlans) {
  const all = Array.isArray(rawPlans) ? rawPlans : [];
  const plans = all.filter(isSurvivingPlan);
  const total = all.length;
  const survived = plans.length;
  const dropped = total - survived;
  return {
    plans,
    total,
    survived,
    dropped,
    some_dropped: dropped > 0,
  };
}

// ---------------------------------------------------------------------------
// Downstream-stage input assembly (lean, defensive accessors).
// ---------------------------------------------------------------------------

/**
 * Assemble the LEAN input the adversarial critic is given: the task + the
 * surviving plans + the salvage stats. Defensive: tolerates a missing/short
 * plan list. Keeps the payload small (the heavy plan content, if written to
 * disk by a manifest planner, is referenced by path inside each plan, not
 * inlined here).
 *
 * @param {object} args
 * @param {string} [args.task]
 * @param {string} [args.facts]
 * @param {{plans:object[], some_dropped:boolean, survived:number, total:number}} args.salvage
 * @returns {{task:string, facts:string, plans:object[], some_planners_returned_nothing:boolean, plan_count:number}}
 */
function assembleCriticInput({ task, facts, salvage } = {}) {
  const s = salvage ?? {};
  const plans = Array.isArray(s.plans) ? s.plans : [];
  return {
    task: String(task ?? ''),
    facts: String(facts ?? ''),
    plans,
    some_planners_returned_nothing: s.some_dropped === true,
    plan_count: plans.length,
  };
}

/**
 * Assemble the LEAN input the judge is given: the task + ALL surviving plans +
 * the critic output + the salvage stats. The judge is EXPLICITLY told (via
 * `some_planners_returned_nothing`) that some planners may have produced nothing,
 * so its prompt can instruct the model to synthesize from whatever is present.
 * Defensive accessors throughout: a missing critique becomes an empty object,
 * never a throw.
 *
 * @param {object} args
 * @param {string} [args.task]
 * @param {string} [args.facts]
 * @param {{plans:object[], some_dropped:boolean, survived:number, total:number}} args.salvage
 * @param {object|null} [args.critique]  the critic's structured output (may be null)
 * @returns {{task:string, facts:string, plans:object[], critique:object, some_planners_returned_nothing:boolean, plan_count:number}}
 */
function assembleJudgeInput({ task, facts, salvage, critique } = {}) {
  const s = salvage ?? {};
  const plans = Array.isArray(s.plans) ? s.plans : [];
  return {
    task: String(task ?? ''),
    facts: String(facts ?? ''),
    plans,
    // Defensive: a critic that returned nothing becomes {} so the judge prompt
    // can still render. The judge is told to synthesize from whatever survives.
    critique: critique != null && typeof critique === 'object' ? critique : {},
    some_planners_returned_nothing: s.some_dropped === true,
    plan_count: plans.length,
  };
}

// ---------------------------------------------------------------------------
// Ground-brief aggregation (scouts).
// ---------------------------------------------------------------------------

/**
 * Aggregate the parallel scout outputs into a lean ground-brief bundle. Scouts
 * are the same lean/salvageable shape as planners: a scout that returned nothing
 * is dropped. Returns the surviving briefs + a count so the planners' shared
 * `facts` can be assembled from them and the final result can report scout_count.
 *
 * @param {Array<*>} rawBriefs
 * @returns {{briefs:object[], scout_count:number}}
 */
function aggregateGroundBriefs(rawBriefs) {
  const all = Array.isArray(rawBriefs) ? rawBriefs : [];
  const briefs = all.filter(isSurvivingPlan);
  return { briefs, scout_count: briefs.length };
}

// ---------------------------------------------------------------------------
// Final result assembly (frozen).
// ---------------------------------------------------------------------------

/**
 * Build the FROZEN planning-brain result. Surfaces the judge's master plan, the
 * critique, the surviving angled plans, the optional ground briefs, and the
 * scout count. Defensive: every field tolerates a missing upstream stage.
 *
 * @param {object} args
 * @param {object|null} [args.masterPlan]    the judge's synthesized plan (may be null)
 * @param {object|null} [args.critique]
 * @param {object[]} [args.angledPlans]      the surviving planner outputs
 * @param {object[]|null} [args.groundBriefs]
 * @param {number} [args.scoutCount]
 * @returns {Readonly<object>}
 */
function assemblePlanningResult({
  masterPlan,
  critique,
  angledPlans,
  groundBriefs,
  scoutCount,
} = {}) {
  const result = {
    master_plan: masterPlan != null && typeof masterPlan === 'object' ? masterPlan : null,
    critique: critique != null && typeof critique === 'object' ? critique : null,
    angled_plans: Array.isArray(angledPlans) ? angledPlans : [],
    scout_count: Number.isFinite(scoutCount) ? scoutCount : 0,
  };
  // ground_briefs is OPTIONAL — only present when the Ground stage ran.
  if (Array.isArray(groundBriefs)) {
    result.ground_briefs = groundBriefs;
  }
  return Object.freeze(result);
}

export {
  ANGLES,
  angleKeys,
  plannerSpecFromAngle,
  plannerSpecsFromAngles,
  isSurvivingPlan,
  salvagePlans,
  assembleCriticInput,
  assembleJudgeInput,
  aggregateGroundBriefs,
  assemblePlanningResult,
};
