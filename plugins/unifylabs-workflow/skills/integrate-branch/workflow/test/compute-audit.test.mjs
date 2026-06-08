// compute-audit.test.mjs — exhaustive, RED-capable unit tests for the pure
// scoring reduce. Pins the verbatim SKILL.md formulas, the OD3a renorm, the
// OD3b rounding/boundary rule, the floors, and the FAIL-CLOSED Discard>Rebuild
// override precedence. The weight-pinning test (`composite pins the exact
// SKILL.md weights`) is the RED self-test target: the P5 CI job mutates a weight
// in compute-audit.mjs and asserts this suite turns red.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreD1, scoreD2, scoreD3, scoreD4, scoreD5, scoreD6,
  composite, displayScore, bandRoute, blockingOverride, computeAudit, WEIGHTS,
} from '../compute-audit.mjs';

// --- per-dimension formulas + floors ---------------------------------------

test('scoreD1: 100 − 20·crit − 10·imp, floor 0', () => {
  assert.equal(scoreD1({}), 100);
  assert.equal(scoreD1({ critical: 1, important: 2 }), 100 - 20 - 20);
  assert.equal(scoreD1({ critical: 10 }), 0); // floor
});

test('scoreD2: 100 − 40·build − 30·tsc − 20·test − 5·untested(max 30), floor 0', () => {
  assert.equal(scoreD2({}), 100);
  assert.equal(scoreD2({ tsc_fail: 1 }), 70);
  assert.equal(scoreD2({ build_fail: 1, tsc_fail: 1, tests_fail: 1 }), 10);
  assert.equal(scoreD2({ untested_new: 4 }), 100 - 20); // 5·4 = 20, under cap
  assert.equal(scoreD2({ untested_new: 100 }), 70); // 5·100 capped at 30
  assert.equal(scoreD2({ build_fail: 1, tsc_fail: 1, tests_fail: 1, untested_new: 100 }), 0); // floor
});

test('scoreD3: 100 − 20·drift − 15·missing, floor 0', () => {
  assert.equal(scoreD3({ drift: 1, missing_update: 1 }), 65);
  assert.equal(scoreD3({ drift: 6 }), 0); // floor
});

test('scoreD4: 100 − 10·crit − 4·imp, floor 0', () => {
  assert.equal(scoreD4({ critical: 2, important: 3 }), 100 - 20 - 12);
  assert.equal(scoreD4({ critical: 11 }), 0); // floor
});

test('scoreD5: 100 − 15·found − 5·shared(max 30) − 15·adjacent − 40·migration, floor 0', () => {
  assert.equal(scoreD5({}), 100);
  assert.equal(scoreD5({ shared: 4 }), 80); // 5·4 = 20 under cap
  assert.equal(scoreD5({ shared: 100 }), 70); // capped at 30
  assert.equal(scoreD5({ migration_conflict: 1 }), 60);
  assert.equal(scoreD5({ foundational: 2, adjacent_drift: 1 }), 100 - 30 - 15);
  assert.equal(scoreD5({ foundational: 10 }), 0); // floor
});

test('scoreD6: 100 − 10·drift, floor 0', () => {
  assert.equal(scoreD6({ drift: 3 }), 70);
  assert.equal(scoreD6({ drift: 11 }), 0); // floor
});

// --- composite + OD3a renormalization --------------------------------------

test('composite pins the exact SKILL.md weights (RED self-test target)', () => {
  // distinct scores so EVERY weight is load-bearing — mutate any weight and this fails.
  const c = composite({ d1: 50, d2: 60, d3: 70, d4: 80, d5: 90, d6: 100 }, { d6Applicable: true });
  assert.equal(c, 0.3 * 50 + 0.2 * 60 + 0.15 * 70 + 0.1 * 80 + 0.2 * 90 + 0.05 * 100); // 68.5
  assert.equal(c, 68.5);
});

test('composite: all-dims-100 ⇒ exactly 100 (with D6)', () => {
  assert.equal(composite({ d1: 100, d2: 100, d3: 100, d4: 100, d5: 100, d6: 100 }, { d6Applicable: true }), 100);
});

test('composite: all-dims-100 ⇒ exactly 100 (D6 omitted, ÷0.95 renorm — OD3a)', () => {
  assert.equal(composite({ d1: 100, d2: 100, d3: 100, d4: 100, d5: 100 }, { d6Applicable: false }), 100);
});

test('composite: renorm divides the remaining weighted sum by 0.95', () => {
  const sansD6 = 0.3 * 50 + 0.2 * 60 + 0.15 * 70 + 0.1 * 80 + 0.2 * 90; // 63.5
  assert.equal(composite({ d1: 50, d2: 60, d3: 70, d4: 80, d5: 90 }, { d6Applicable: false }), sansD6 / 0.95);
});

test('WEIGHTS sum to 1.0 (with D6) and 0.95 (without)', () => {
  const { d1, d2, d3, d4, d5, d6 } = WEIGHTS;
  assert.equal(d1 + d2 + d3 + d4 + d5 + d6, 1);
  assert.ok(Math.abs(d1 + d2 + d3 + d4 + d5 - 0.95) < 1e-12);
});

// --- OD3b rounding + boundary ----------------------------------------------

test('displayScore is round-half-up (OD3b display)', () => {
  assert.equal(displayScore(79.5), 80);
  assert.equal(displayScore(79.4), 79);
  assert.equal(displayScore(40.5), 41);
  assert.equal(displayScore(100), 100);
});

test('bandRoute compares the RAW float (OD3b): ≥80 salvage / 40-79 user-decides / <40 rebuild', () => {
  assert.equal(bandRoute(100), 'salvage');
  assert.equal(bandRoute(80), 'salvage');
  assert.equal(bandRoute(79.9999), 'user-decides');
  assert.equal(bandRoute(79.5), 'user-decides'); // the OD3b quirk: displays 80, routes as <80
  assert.equal(bandRoute(40), 'user-decides');
  assert.equal(bandRoute(39.9999), 'rebuild');
  assert.equal(bandRoute(0), 'rebuild');
});

// --- blocking overrides (FAIL-CLOSED, Discard > Rebuild) -------------------

test('blockingOverride: each Discard signal routes discard', () => {
  for (const s of ['secrets', 'unprotected_public_mutation', 'foundational_auth_broken']) {
    assert.deepEqual(blockingOverride({ [s]: true }), { route: 'discard', signals: [s] });
  }
});

test('blockingOverride: each Rebuild signal routes rebuild', () => {
  for (const s of ['phi_in_logs', 'tests_majority_fail', 'migration_conflict', 'build_fails_no_fix']) {
    assert.deepEqual(blockingOverride({ [s]: true }), { route: 'rebuild', signals: [s] });
  }
});

test('blockingOverride: Discard takes precedence over Rebuild', () => {
  const o = blockingOverride({ secrets: true, phi_in_logs: true });
  assert.equal(o.route, 'discard');
  assert.deepEqual(o.signals, ['secrets']);
});

test('blockingOverride: no signals ⇒ no override', () => {
  assert.deepEqual(blockingOverride({}), { route: null, signals: [] });
  assert.deepEqual(blockingOverride(), { route: null, signals: [] });
});

// --- computeAudit integration ----------------------------------------------

test('computeAudit: clean branch ⇒ composite 100, salvage, composite basis', () => {
  const r = computeAudit({
    d1: {}, d2: {}, d3: {}, d4: {}, d5: {}, d6: { applicable: false }, override_signals: {},
  });
  assert.equal(r.composite, 100);
  assert.equal(r.composite_display, 100);
  assert.equal(r.route, 'salvage');
  assert.equal(r.route_basis, 'composite');
  assert.equal(r.d6_applicable, false);
  assert.equal(r.scores.d6, null);
});

test('computeAudit: a Discard override beats a perfect composite', () => {
  const r = computeAudit({
    d1: {}, d2: {}, d3: {}, d4: {}, d5: {}, d6: { applicable: false },
    override_signals: { secrets: true },
  });
  assert.equal(r.composite, 100);
  assert.equal(r.route, 'discard');
  assert.equal(r.route_basis, 'override-discard');
  assert.deepEqual(r.override.signals, ['secrets']);
});

test('computeAudit: PHI-in-logs forces rebuild regardless of composite', () => {
  const r = computeAudit({
    d1: {}, d2: {}, d3: {}, d4: {}, d5: {}, d6: { applicable: false },
    override_signals: { phi_in_logs: true },
  });
  assert.equal(r.route, 'rebuild');
  assert.equal(r.route_basis, 'override-rebuild');
});

test('computeAudit: low composite with no override ⇒ rebuild on composite basis', () => {
  const r = computeAudit({
    d1: { critical: 5 }, d2: { build_fail: 1, tsc_fail: 1, tests_fail: 1 }, d3: { drift: 5 },
    d4: { critical: 10 }, d5: { migration_conflict: 1 }, d6: { applicable: false }, override_signals: {},
  });
  assert.ok(r.composite < 40, `composite ${r.composite} should be <40`);
  assert.equal(r.route, 'rebuild');
  assert.equal(r.route_basis, 'composite');
});

test('computeAudit: D6 applicable includes the 5% term', () => {
  const r = computeAudit({
    d1: { critical: 0 }, d2: {}, d3: {}, d4: {}, d5: {}, d6: { applicable: true, drift: 10 },
    override_signals: {},
  });
  // d6 drift 10 ⇒ scoreD6 0; composite = 0.95·100 + 0.05·0 = 95
  assert.equal(r.scores.d6, 0);
  assert.equal(r.composite, 95);
  assert.equal(r.route, 'salvage');
});

test('computeAudit: result is frozen (immutable reduce output)', () => {
  const r = computeAudit({ d1: {}, d2: {}, d3: {}, d4: {}, d5: {}, d6: { applicable: false }, override_signals: {} });
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.scores));
  assert.ok(Object.isFrozen(r.override));
});
