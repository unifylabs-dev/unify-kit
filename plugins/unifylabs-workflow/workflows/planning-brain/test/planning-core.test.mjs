// planning-core.test.mjs — node:test for the PURE planning-core kernel.
//
// Covers: the ANGLES table shape, planner-spec construction from ANGLES, the
// SALVAGE .filter(Boolean) (the lean-schema-failure lesson), the lean
// critic/judge input assembly with the some_planners_returned_nothing flag, the
// ground-brief aggregation, and the frozen result shape.
//
// Zero-dep: node:test + node:assert only. NO wall-clock, NO random.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
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
} from '../lib/planning-core.mjs';

// ---------------------------------------------------------------------------
// ANGLES table.
// ---------------------------------------------------------------------------

test('ANGLES: 3 frozen angles with snake_case keys (never hyphenated)', () => {
  assert.equal(ANGLES.length, 3, 'three planner lenses, copying the dogfooded shape');
  assert.ok(Object.isFrozen(ANGLES), 'ANGLES table is frozen');
  for (const a of ANGLES) {
    assert.ok(Object.isFrozen(a), 'each angle is frozen');
    assert.match(a.key, /^[a-z][a-z0-9_]*$/, `key "${a.key}" is snake_case, no hyphen`);
    assert.ok(a.lens.length > 0, 'each angle carries a non-empty lens');
  }
  const keys = angleKeys();
  assert.equal(new Set(keys).size, keys.length, 'angle keys are unique');
});

// ---------------------------------------------------------------------------
// Planner-spec construction from ANGLES.
// ---------------------------------------------------------------------------

test('plannerSpecFromAngle: builds a pure data spec carrying the lens + brief', () => {
  const schema = { type: 'object', properties: { angle: { type: 'string' } } };
  const spec = plannerSpecFromAngle(ANGLES[0], {
    task: 'do the thing',
    facts: 'fact one',
    plansDir: '/tmp/plans',
    schema,
  });
  assert.equal(spec.key, ANGLES[0].key);
  assert.equal(spec.label, `plan:${ANGLES[0].key}`);
  assert.equal(spec.lens, ANGLES[0].lens);
  assert.equal(spec.task, 'do the thing');
  assert.equal(spec.facts, 'fact one');
  assert.equal(spec.plansDir, '/tmp/plans');
  assert.equal(spec.schema, schema, 'schema threaded through verbatim');
});

test('plannerSpecsFromAngles: one spec per angle, in frozen ANGLES order', () => {
  const specs = plannerSpecsFromAngles({ task: 'T', facts: 'F' });
  assert.equal(specs.length, ANGLES.length);
  assert.deepEqual(
    specs.map((s) => s.key),
    ANGLES.map((a) => a.key),
    'spec order matches the ANGLES order (deterministic)',
  );
  for (const s of specs) {
    assert.equal(s.task, 'T');
    assert.equal(s.facts, 'F');
  }
});

test('plannerSpecsFromAngles: tolerates a missing brief (pure, no throw)', () => {
  const specs = plannerSpecsFromAngles();
  assert.equal(specs.length, ANGLES.length);
  for (const s of specs) {
    assert.equal(s.task, '');
    assert.equal(s.facts, '');
    assert.equal(s.schema, null);
  }
});

// ---------------------------------------------------------------------------
// SALVAGE — the .filter(Boolean) lesson (planners may return null).
// ---------------------------------------------------------------------------

test('isSurvivingPlan: only non-null non-array objects survive', () => {
  assert.equal(isSurvivingPlan({ a: 1 }), true);
  assert.equal(isSurvivingPlan(null), false);
  assert.equal(isSurvivingPlan(undefined), false);
  assert.equal(isSurvivingPlan('str'), false);
  assert.equal(isSurvivingPlan(42), false);
  assert.equal(isSurvivingPlan([1, 2]), false, 'an array is not a plan object');
});

test('salvagePlans: drops nulls; reports survived/dropped/some_dropped', () => {
  const raw = [{ angle: 'a' }, null, { angle: 'b' }, undefined];
  const s = salvagePlans(raw);
  assert.equal(s.total, 4);
  assert.equal(s.survived, 2);
  assert.equal(s.dropped, 2);
  assert.equal(s.some_dropped, true);
  assert.deepEqual(s.plans.map((p) => p.angle), ['a', 'b']);
});

test('salvagePlans: all-null input yields an empty surviving set, no throw', () => {
  const s = salvagePlans([null, null, null]);
  assert.equal(s.survived, 0);
  assert.equal(s.dropped, 3);
  assert.equal(s.some_dropped, true);
  assert.deepEqual(s.plans, []);
});

test('salvagePlans: a full set reports some_dropped=false', () => {
  const s = salvagePlans([{ angle: 'a' }, { angle: 'b' }, { angle: 'c' }]);
  assert.equal(s.survived, 3);
  assert.equal(s.dropped, 0);
  assert.equal(s.some_dropped, false);
});

test('salvagePlans: non-array input is treated as empty (defensive)', () => {
  const s = salvagePlans(null);
  assert.equal(s.total, 0);
  assert.equal(s.survived, 0);
});

// ---------------------------------------------------------------------------
// Lean downstream-input assembly (defensive accessors + the flag).
// ---------------------------------------------------------------------------

test('assembleCriticInput: lean, carries surviving plans + the dropped flag', () => {
  const salvage = salvagePlans([{ angle: 'a' }, null]);
  const input = assembleCriticInput({ task: 'T', facts: 'F', salvage });
  assert.equal(input.task, 'T');
  assert.equal(input.facts, 'F');
  assert.equal(input.plan_count, 1);
  assert.equal(input.some_planners_returned_nothing, true);
  assert.deepEqual(input.plans.map((p) => p.angle), ['a']);
});

test('assembleJudgeInput: carries ALL surviving plans + the critique + the flag', () => {
  const salvage = salvagePlans([{ angle: 'a' }, { angle: 'b' }, null]);
  const critique = { gaps: ['missing X'], must_resolve: ['fork Y'] };
  const input = assembleJudgeInput({ task: 'T', facts: 'F', salvage, critique });
  assert.equal(input.plan_count, 2, 'judge sees both surviving plans');
  assert.deepEqual(input.plans.map((p) => p.angle), ['a', 'b']);
  assert.deepEqual(input.critique, critique, 'judge receives the critic output');
  assert.equal(
    input.some_planners_returned_nothing,
    true,
    'judge is told some planners returned nothing',
  );
});

test('assembleJudgeInput: a null critique becomes {} (defensive, no throw)', () => {
  const salvage = salvagePlans([{ angle: 'a' }]);
  const input = assembleJudgeInput({ task: 'T', salvage, critique: null });
  assert.deepEqual(input.critique, {});
  assert.equal(input.some_planners_returned_nothing, false);
});

test('assembleJudgeInput: a missing salvage arg yields an empty plan list', () => {
  const input = assembleJudgeInput({ task: 'T' });
  assert.deepEqual(input.plans, []);
  assert.equal(input.plan_count, 0);
});

// ---------------------------------------------------------------------------
// Ground-brief aggregation.
// ---------------------------------------------------------------------------

test('aggregateGroundBriefs: drops dead scouts, counts survivors', () => {
  const g = aggregateGroundBriefs([{ area: 'repo' }, null, { area: 'task' }]);
  assert.equal(g.scout_count, 2);
  assert.deepEqual(g.briefs.map((b) => b.area), ['repo', 'task']);
});

test('aggregateGroundBriefs: non-array input -> zero scouts', () => {
  const g = aggregateGroundBriefs(undefined);
  assert.equal(g.scout_count, 0);
  assert.deepEqual(g.briefs, []);
});

// ---------------------------------------------------------------------------
// Frozen result shape.
// ---------------------------------------------------------------------------

test('assemblePlanningResult: frozen, documented key set, ground_briefs optional', () => {
  const withGround = assemblePlanningResult({
    masterPlan: { summary: 's' },
    critique: { gaps: [] },
    angledPlans: [{ angle: 'a' }],
    groundBriefs: [{ area: 'repo' }],
    scoutCount: 1,
  });
  assert.ok(Object.isFrozen(withGround), 'result is frozen');
  assert.deepEqual(
    Object.keys(withGround).sort(),
    ['angled_plans', 'critique', 'ground_briefs', 'master_plan', 'scout_count'],
    'full result key set',
  );
  assert.equal(withGround.scout_count, 1);

  const noGround = assemblePlanningResult({
    masterPlan: { summary: 's' },
    critique: null,
    angledPlans: [],
  });
  assert.deepEqual(
    Object.keys(noGround).sort(),
    ['angled_plans', 'critique', 'master_plan', 'scout_count'],
    'ground_briefs is omitted when the Ground stage did not run',
  );
  assert.equal(noGround.scout_count, 0);
  assert.equal(noGround.critique, null);
});

test('assemblePlanningResult: a null master plan stays null (no throw)', () => {
  const r = assemblePlanningResult({ masterPlan: null, angledPlans: [{ angle: 'a' }] });
  assert.equal(r.master_plan, null);
  assert.equal(r.angled_plans.length, 1);
});
