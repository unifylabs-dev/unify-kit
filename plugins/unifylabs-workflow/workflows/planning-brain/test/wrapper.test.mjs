// wrapper.test.mjs — drives runPlanningBrain with STUB injected callbacks (no
// agent() / no Workflow runtime). These tests guard WIRING + salvage +
// determinism only — CI cannot test planning QUALITY (that needs a live model;
// it is the human/live eval).
//
// Covered:
//   (a) planner-spec construction from ANGLES flows into runPlanners;
//   (b) SALVAGE — inject planners where some return null -> the wrapper still
//       runs critic + judge on the FILTERED set and does not crash (the
//       lean-schema-failure lesson encoded as a real test);
//   (c) the judge receives ALL surviving plans + the critic output;
//   (d) PLANTED-GAP WIRING — a critic stub flags a specific gap -> assert the
//       judge stub receives that finding (critic findings flow to the judge);
//   (e) the Ground stage is optional + scout briefs surface in the result;
//   (f) the result is frozen with the documented key set.
//
// Zero-dep: node:test + node:assert only. NO wall-clock, NO random.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runPlanningBrain } from '../wrapper.mjs';
import { ANGLES } from '../lib/planning-core.mjs';

// ---------------------------------------------------------------------------
// (a) Planner specs from ANGLES flow into runPlanners.
// ---------------------------------------------------------------------------

test('planner specs are built from ANGLES and passed to runPlanners', async () => {
  let seenSpecs = null;
  const result = await runPlanningBrain({
    task: 'plan the thing',
    facts: 'a fact',
    runPlanners: async ({ specs }) => {
      seenSpecs = specs;
      return specs.map((s) => ({ angle: s.key, summary: `plan for ${s.key}` }));
    },
    runCritic: async () => ({ gaps: [], cross_cutting_risks: [], must_resolve: [] }),
    runJudge: async () => ({ summary: 'master', steps: [], open_decisions_for_human: [] }),
  });
  assert.ok(seenSpecs, 'runPlanners received the specs');
  assert.deepEqual(
    seenSpecs.map((s) => s.key),
    ANGLES.map((a) => a.key),
    'one spec per ANGLE, in order',
  );
  assert.equal(result.angled_plans.length, ANGLES.length);
});

// ---------------------------------------------------------------------------
// (b) SALVAGE — some planners return null; critic + judge still run; no crash.
// ---------------------------------------------------------------------------

test('SALVAGE: a null-returning planner does not crash; critic+judge run on the filtered set', async () => {
  let criticRan = false;
  let judgeRan = false;
  let judgePlanCount = null;

  const result = await runPlanningBrain({
    task: 'plan with a dead planner',
    // 3 angles -> return [plan, null, plan] so the middle planner "returned
    // nothing" (the lean-schema-failure: never called StructuredOutput).
    runPlanners: async ({ specs }) =>
      specs.map((s, i) => (i === 1 ? null : { angle: s.key, summary: `plan ${i}` })),
    runCritic: async (input) => {
      criticRan = true;
      // The critic must be told some planners returned nothing AND only see the
      // surviving plans.
      assert.equal(input.some_planners_returned_nothing, true);
      assert.equal(input.plan_count, 2, 'critic sees only the 2 surviving plans');
      return { gaps: [], cross_cutting_risks: [], must_resolve: [] };
    },
    runJudge: async (input) => {
      judgeRan = true;
      judgePlanCount = input.plan_count;
      assert.equal(
        input.some_planners_returned_nothing,
        true,
        'judge is told some planners returned nothing',
      );
      return { summary: 'synthesized from survivors', steps: [], open_decisions_for_human: [] };
    },
  });

  assert.ok(criticRan, 'critic ran despite a dead planner');
  assert.ok(judgeRan, 'judge ran despite a dead planner');
  assert.equal(judgePlanCount, 2, 'judge synthesized from the 2 surviving plans');
  assert.equal(result.angled_plans.length, 2, 'result carries only the survivors');
  assert.ok(result.master_plan, 'a master plan was produced from the survivors');
});

test('SALVAGE: ALL planners return null -> critic+judge still run, empty plan set, no crash', async () => {
  let criticPlanCount = null;
  const result = await runPlanningBrain({
    task: 'everyone died',
    runPlanners: async ({ specs }) => specs.map(() => null),
    runCritic: async (input) => {
      criticPlanCount = input.plan_count;
      return { gaps: ['no plans to work with'], cross_cutting_risks: [], must_resolve: [] };
    },
    runJudge: async (input) => {
      assert.equal(input.plan_count, 0);
      assert.equal(input.some_planners_returned_nothing, true);
      return { summary: 'no viable plan', steps: [], open_decisions_for_human: [] };
    },
  });
  assert.equal(criticPlanCount, 0);
  assert.deepEqual(result.angled_plans, []);
  assert.ok(Object.isFrozen(result));
});

// ---------------------------------------------------------------------------
// (c) The judge receives ALL surviving plans + the critic output.
// ---------------------------------------------------------------------------

test('judge receives ALL surviving plans AND the critic output', async () => {
  const critiqueOut = {
    gaps: ['edge-case Z unhandled'],
    cross_cutting_risks: ['shared-state race'],
    must_resolve: ['pick storage backend'],
  };
  let judgeSawPlans = null;
  let judgeSawCritique = null;

  await runPlanningBrain({
    task: 'full set',
    runPlanners: async ({ specs }) =>
      specs.map((s) => ({ angle: s.key, summary: `plan ${s.key}` })),
    runCritic: async () => critiqueOut,
    runJudge: async (input) => {
      judgeSawPlans = input.plans;
      judgeSawCritique = input.critique;
      return { summary: 'm', steps: [], open_decisions_for_human: [] };
    },
  });

  assert.equal(judgeSawPlans.length, ANGLES.length, 'judge got every surviving plan');
  assert.deepEqual(
    judgeSawPlans.map((p) => p.angle).sort(),
    ANGLES.map((a) => a.key).sort(),
  );
  assert.deepEqual(judgeSawCritique, critiqueOut, 'judge got the full critic output');
});

// ---------------------------------------------------------------------------
// (d) PLANTED-GAP WIRING — a critic-flagged gap reaches the judge input.
// ---------------------------------------------------------------------------

test('PLANTED-GAP WIRING: a critic-flagged gap appears in the judge input', async () => {
  const PLANTED_GAP = 'PLANTED: no rollback path for partial failure';
  let judgeInput = null;

  await runPlanningBrain({
    task: 'wiring proof',
    runPlanners: async ({ specs }) =>
      specs.map((s) => ({ angle: s.key, summary: `plan ${s.key}` })),
    // The critic plants a specific, identifiable gap.
    runCritic: async () => ({
      gaps: [PLANTED_GAP],
      cross_cutting_risks: [],
      must_resolve: ['gate this decision with the human'],
    }),
    runJudge: async (input) => {
      judgeInput = input;
      return { summary: 'm', steps: [], open_decisions_for_human: [] };
    },
  });

  assert.ok(judgeInput, 'judge was invoked');
  // The planted critic finding must be structurally present in what the judge
  // receives — proving critic findings flow through to the judge.
  assert.ok(
    Array.isArray(judgeInput.critique.gaps) &&
      judgeInput.critique.gaps.includes(PLANTED_GAP),
    'the planted gap flowed from the critic into the judge input',
  );
  assert.ok(
    JSON.stringify(judgeInput.critique).includes(PLANTED_GAP),
    'the planted finding is present in the assembled judge input critique',
  );
});

// ---------------------------------------------------------------------------
// (e) Ground stage is optional; scout briefs surface in the result.
// ---------------------------------------------------------------------------

test('Ground stage: scouts run when injected and surface in the result', async () => {
  let plannersSawBriefs = null;
  const result = await runPlanningBrain({
    task: 'grounded plan',
    runScouts: async () => [{ area: 'repo', summary: 'r' }, null, { area: 'task', summary: 't' }],
    runPlanners: async ({ specs, groundBriefs }) => {
      plannersSawBriefs = groundBriefs;
      return specs.map((s) => ({ angle: s.key, summary: 's' }));
    },
    runCritic: async () => ({ gaps: [], cross_cutting_risks: [], must_resolve: [] }),
    runJudge: async () => ({ summary: 'm', steps: [], open_decisions_for_human: [] }),
  });
  assert.equal(result.scout_count, 2, 'one dead scout dropped; 2 survive');
  assert.ok(Array.isArray(result.ground_briefs), 'ground_briefs present when scouts ran');
  assert.equal(result.ground_briefs.length, 2);
  assert.ok(plannersSawBriefs, 'planners received the surviving ground briefs');
  assert.equal(plannersSawBriefs.length, 2);
});

test('Ground stage: omitted when no runScouts is injected (ground_briefs absent)', async () => {
  const result = await runPlanningBrain({
    task: 'ungrounded plan',
    runPlanners: async ({ specs }) => specs.map((s) => ({ angle: s.key })),
    runCritic: async () => ({ gaps: [], cross_cutting_risks: [], must_resolve: [] }),
    runJudge: async () => ({ summary: 'm', steps: [], open_decisions_for_human: [] }),
  });
  assert.equal(result.scout_count, 0);
  assert.ok(!('ground_briefs' in result), 'ground_briefs omitted with no Ground stage');
});

// ---------------------------------------------------------------------------
// (f) Frozen result shape + required-callback guards.
// ---------------------------------------------------------------------------

test('result is frozen with the documented key set', async () => {
  const result = await runPlanningBrain({
    task: 't',
    runPlanners: async ({ specs }) => specs.map((s) => ({ angle: s.key })),
    runCritic: async () => ({ gaps: [], cross_cutting_risks: [], must_resolve: [] }),
    runJudge: async () => ({ summary: 'm', steps: [], open_decisions_for_human: [] }),
  });
  assert.ok(Object.isFrozen(result), 'result is frozen');
  assert.deepEqual(
    Object.keys(result).sort(),
    ['angled_plans', 'critique', 'master_plan', 'scout_count'],
    'result key set drifted',
  );
});

test('missing required callbacks throw a clear error', async () => {
  await assert.rejects(
    () => runPlanningBrain({ task: 't' }),
    /runPlanners callback is required/,
  );
  await assert.rejects(
    () => runPlanningBrain({ task: 't', runPlanners: async () => [] }),
    /runCritic callback is required/,
  );
  await assert.rejects(
    () =>
      runPlanningBrain({
        task: 't',
        runPlanners: async () => [],
        runCritic: async () => ({}),
      }),
    /runJudge callback is required/,
  );
});
