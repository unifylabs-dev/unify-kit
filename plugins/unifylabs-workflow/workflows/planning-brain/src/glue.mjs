// glue.mjs — the agent()-backed SOURCE for the planning-brain Workflow (M2 seed).
//
// THIS IS THE ONLY FILE THAT TOUCHES RUNTIME GLOBALS (agent / parallel / phase /
// log). It is NOT unit-tested (it needs the Workflow runtime), but it MUST
// `node --check` clean and MUST avoid the forbidden wall-clock/random tokens.
//
// The deterministic bundler (build-workflow.mjs) inlines the pure kernel
// (lib/planning-core.mjs + wrapper.mjs) AHEAD of this file's body and strips the
// imports below — so `runPlanningBrain`, `ANGLES`, etc. are already in scope in
// the generated bundle. We still write them as real imports here so this source
// resolves and `node --check`s on its own.
//
// Runtime globals assumed present in the Workflow VM (NOT imported — the bundle
// strips imports, and these are provided by the runtime):
//   - agent(prompt, opts)  -> dispatch a sub-agent; returns its structured output
//                             (null if it never called StructuredOutput)
//   - parallel(tasks)      -> NATIVE bounded fan-out (no hand-rolled limiter —
//                             the runtime owns the worker pool)
//   - phase(name, fn?)     -> demarcate a workflow phase for the run log
//   - log(msg)             -> structured run log
//
// LEAN-SCHEMA DISCIPLINE (baked in — this session a planning brain FAILED because
// planners used a ~14-field nested schema with a hyphenated key and never called
// StructuredOutput, returning null). The schemas below are deliberately:
//   - LEAN + flat-ish: few required fields, shallow nesting;
//   - snake_case ONLY: never a hyphenated key (a hyphenated key cannot be a bare
//     object property and was a direct cause of the null-return failure);
//   - manifest-friendly: a planner writes the heavy plan body to a file under
//     plansDir and returns a LEAN manifest (plan_path + a short summary + the
//     load-bearing fields), so the structured payload stays small;
//   - salvage-aware downstream: the critic + judge schemas are lean and the judge
//     is explicitly told some planners may have returned nothing.

import { runPlanningBrain } from '../wrapper.mjs';
import { ANGLES } from '../lib/planning-core.mjs';

// `meta` MUST be a pure literal and MUST be emitted FIRST in the bundle — the
// Workflow tool reads it to discover the entrypoint + declared inputs before
// executing anything.
export const meta = {
  name: 'planning-brain',
  version: 1,
  entry: 'main',
  description:
    'Planning brain: parallel ground scouts -> parallel angled planners -> one ' +
    'adversarial critic -> a judge that synthesizes ONE master plan and surfaces ' +
    'open_decisions_for_human. Run as a Workflow over the tested planning-core kernel.',
  inputs: {
    task: { type: 'string', required: true },
    facts: { type: 'string', required: false },
    plansDir: { type: 'string', required: false },
    ground: { type: 'boolean', required: false, default: true },
    scouts: { type: 'number', required: false, default: 2 },
  },
};

// ---------------------------------------------------------------------------
// LEAN per-stage schemas. snake_case keys only; few required fields; manifest-
// style (heavy content -> disk, lean manifest -> StructuredOutput).
// ---------------------------------------------------------------------------

// A scout's brief: lean + flat. The scout reads repo/task state and returns a
// short structured brief — NOT a wall of prose.
const SCOUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['area', 'summary'],
  properties: {
    area: { type: 'string' },
    summary: { type: 'string' },
    facts: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
};

// A planner's output: LEAN MANIFEST. The heavy plan body is written to
// `plan_path` under plansDir; the structured payload carries only the manifest
// + the few load-bearing fields. Flat, snake_case, 5 fields, 3 required.
const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['angle', 'summary', 'plan_path'],
  properties: {
    angle: { type: 'string' },
    summary: { type: 'string' },
    plan_path: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
};

// The adversarial critic's output: lean. Hunts gaps / edge-cases / gaming across
// ALL plans; surfaces the things that genuinely need the human.
const CRITIQUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['gaps', 'cross_cutting_risks', 'must_resolve'],
  properties: {
    gaps: { type: 'array', items: { type: 'string' } },
    cross_cutting_risks: { type: 'array', items: { type: 'string' } },
    gaming_or_shortcuts: { type: 'array', items: { type: 'string' } },
    strongest_elements: { type: 'array', items: { type: 'string' } },
    must_resolve: { type: 'array', items: { type: 'string' } },
  },
};

// The judge's output: ONE synthesized master plan + open_decisions_for_human as
// {decision, options, recommendation} triples (the human gate consumes these).
// Manifest-style for the heavy plan body via master_plan_path; lean otherwise.
const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['master_plan_path', 'summary', 'steps', 'open_decisions_for_human'],
  properties: {
    master_plan_path: { type: 'string' },
    summary: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    incorporated_critic_fixes: { type: 'array', items: { type: 'string' } },
    open_decisions_for_human: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['decision', 'options', 'recommendation'],
        properties: {
          decision: { type: 'string' },
          options: { type: 'string' },
          recommendation: { type: 'string' },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Injected effectful steps (the ONLY agent()/parallel() callers).
// ---------------------------------------------------------------------------

/**
 * GROUND — fan out N scout agents via NATIVE parallel() to read repo/task state
 * into structured briefs. Returns the RAW briefs (may contain null); the kernel
 * filters them. We do NOT hand-roll a concurrency limiter — parallel() owns it.
 */
function makeRunScouts({ scouts }) {
  const n = Number.isFinite(scouts) && scouts > 0 ? Math.floor(scouts) : 2;
  return async function runScouts({ task, facts }) {
    const briefs = await parallel(
      Array.from({ length: n }, (_unused, i) => () =>
        agent(
          `You are scout #${i + 1} of ${n} grounding a planning task. ` +
            `TASK:\n${task}\n\nKNOWN FACTS:\n${facts || '(none provided)'}\n\n` +
            'Read the relevant repo/task state and return a LEAN structured brief ' +
            'for your area: a short summary, the load-bearing facts, and the risks ' +
            'you see. Do NOT dump prose — keep it tight.',
          { label: `ground:scout-${i + 1}`, phase: 'Ground', schema: SCOUT_SCHEMA },
        ),
      ),
    );
    log(`ground: dispatched ${n} scout(s)`);
    return briefs;
  };
}

/**
 * PLAN — run the per-angle planner specs in parallel via NATIVE parallel(). Each
 * planner writes its heavy plan body to plansDir and returns a LEAN manifest
 * (PLAN_SCHEMA). A planner that fails to call StructuredOutput returns null; the
 * kernel's salvagePlans() drops it — the critic + judge still run.
 */
async function runPlanners({ specs, groundBriefs }) {
  const briefsText = Array.isArray(groundBriefs)
    ? JSON.stringify(groundBriefs)
    : '(no ground briefs)';
  const plans = await parallel(
    specs.map((spec) => () =>
      agent(
        `You are a planner producing ONE complete plan through a specific LENS.\n` +
          `LENS (${spec.key}): ${spec.lens}\n\nTASK:\n${spec.task}\n\n` +
          `GROUND FACTS:\n${spec.facts || '(none)'}\n\nGROUND BRIEFS:\n${briefsText}\n\n` +
          'Produce a COMPLETE, concrete plan for your lens. Write the FULL plan ' +
          `body to a file under ${spec.plansDir || '(plansDir)'} and return a LEAN ` +
          'manifest: angle, a one-paragraph summary, the plan_path you wrote, the ' +
          'ordered steps, and the risks. Keep the structured payload SMALL.',
        { label: spec.label, phase: 'Plan', schema: PLAN_SCHEMA },
      ),
    ),
  );
  log(`plan: dispatched ${specs.length} planner(s) over ${ANGLES.length} angle(s)`);
  return plans;
}

/**
 * CRITIQUE — one adversarial critic reads ALL surviving plans (the lean critic
 * input the kernel assembled) and hunts gaps / edge-cases / gaming. Told when
 * some planners returned nothing so it does not assume a full set.
 */
async function runCritic(criticInput) {
  const note = criticInput.some_planners_returned_nothing
    ? 'NOTE: some planners returned nothing — critique only the plans present.\n\n'
    : '';
  return agent(
    `You are an ADVERSARIAL critic. Be skeptical; default to finding problems.\n${note}` +
      `TASK:\n${criticInput.task}\n\nGROUND FACTS:\n${criticInput.facts || '(none)'}\n\n` +
      `THE ${criticInput.plan_count} PLAN(S):\n${JSON.stringify(criticInput.plans, null, 2)}\n\n` +
      'Hunt for: gaps (what every plan misses), cross_cutting_risks, ' +
      'gaming_or_shortcuts (any plan that games the task or cuts a corner), the ' +
      'strongest_elements worth keeping, and must_resolve (decisions that ' +
      'genuinely need the human vs ones the judge can settle).',
    { label: 'critique:adversarial', phase: 'Critique', schema: CRITIQUE_SCHEMA },
  );
}

/**
 * JUDGE — synthesize ONE master plan from the surviving plans + the critique,
 * incorporating the critic's fixes, and surface open_decisions_for_human as
 * {decision, options, recommendation} triples for the human gate. EXPLICITLY
 * told some planners may have returned nothing (synthesize from what survives).
 */
async function runJudge(judgeInput) {
  const note = judgeInput.some_planners_returned_nothing
    ? 'NOTE: some planners returned nothing — synthesize from whatever plans are ' +
      'present; do NOT block on a missing angle.\n\n'
    : '';
  return agent(
    `You are the JUDGE. Synthesize the single best plan from the proposals + the ` +
      `adversarial critique.\n${note}` +
      `TASK:\n${judgeInput.task}\n\nGROUND FACTS:\n${judgeInput.facts || '(none)'}\n\n` +
      `THE ${judgeInput.plan_count} PLAN(S):\n${JSON.stringify(judgeInput.plans, null, 2)}\n\n` +
      `THE CRITIQUE:\n${JSON.stringify(judgeInput.critique, null, 2)}\n\n` +
      'Write the FULL synthesized master plan to a file and return a LEAN ' +
      'manifest: master_plan_path, a summary, the ordered steps, the ' +
      'incorporated_critic_fixes, and open_decisions_for_human — each a ' +
      '{decision, options, recommendation} triple naming a decision that ' +
      'genuinely needs the human (the orchestrator approves at the gate).',
    { label: 'judge:synthesize', phase: 'Judge', schema: JUDGE_SCHEMA },
  );
}

// ---------------------------------------------------------------------------
// Entrypoint — bind the runtime globals + inputs and run the wrapper.
// ---------------------------------------------------------------------------

export async function main(inputs = {}) {
  const {
    task,
    facts,
    plansDir,
    ground = true,
    scouts = 2,
  } = inputs;

  return phase('planning-brain', async () => {
    log(`task=${task ? String(task).slice(0, 80) : '(none)'} ground=${ground} scouts=${scouts}`);
    const result = await runPlanningBrain({
      task,
      facts,
      plansDir,
      // GROUND is opt-out: pass the scout runner only when `ground` is on.
      runScouts: ground ? makeRunScouts({ scouts }) : undefined,
      runPlanners,
      runCritic,
      runJudge,
      log,
    });
    log(
      `done: ${result.angled_plans.length} angled plan(s), ` +
        `critique=${result.critique ? 'yes' : 'no'}, ` +
        `master_plan=${result.master_plan ? 'yes' : 'no'}, ` +
        `scouts=${result.scout_count}`,
    );
    return result;
  });
}
