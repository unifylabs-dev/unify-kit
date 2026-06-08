// compute-audit.mjs — the single AUTHORITATIVE scoring reduce for the
// integrate-branch Phase-2 audit seed (M3 adoption, skill 1 of 3). PURE: no
// agent(), no i/o, no wall-clock, no random, ZERO imports. Every per-dimension
// formula, the composite, the blocking overrides, and the route matrix are
// lifted VERBATIM from plugins/unifylabs-workflow/skills/integrate-branch/
// SKILL.md Phase 2/3 (cited inline). The agent-backed glue (src/audit-glue.mjs)
// gathers the deterministic per-dimension SIGNALS and feeds them here; this
// module owns the arithmetic. Locking parity on THIS reduce over a frozen
// fixture is the M3 acceptance bar (OD1 — reduce-parity, two-gate).
//
// Decisions baked in (resolved at the P0 gate, run m3-integrate-branch-2026-06-06):
//   OD3a renorm  : when D6 is omitted, divide the remaining weights by 0.95
//                  (so they sum to 1.0). The ONLY scheme where all-dims-100
//                  yields exactly 100 on both the with-D6 and without-D6 paths.
//   OD3b rounding: the route matrix compares the RAW float composite (so 79.5
//                  routes as <80); the displayed <N>/100 is round-half-up.
//   overrides    : FAIL-CLOSED, fire regardless of composite; Discard takes
//                  precedence over Rebuild (Discard = unsafe; do not rebuild).

/** Floor a score at 0 (SKILL.md: every dimension says "Floor 0"). */
const clamp0 = (n) => (n > 0 ? n : 0);

// --- per-dimension scores (SKILL.md Phase 2, verbatim) ---------------------

/** D1 CLAUDE.md non-negotiables (SKILL.md:141): 100 − 20·crit − 10·imp. */
export function scoreD1({ critical = 0, important = 0 } = {}) {
  return clamp0(100 - 20 * critical - 10 * important);
}

/** D2 test bar (SKILL.md:169): 100 − 40·build − 30·tsc − 20·test − 5·untested (max 30). */
export function scoreD2({ build_fail = 0, tsc_fail = 0, tests_fail = 0, untested_new = 0 } = {}) {
  return clamp0(100 - 40 * build_fail - 30 * tsc_fail - 20 * tests_fail - Math.min(5 * untested_new, 30));
}

/** D3 spec sync (SKILL.md:185): 100 − 20·drift − 15·missing. */
export function scoreD3({ drift = 0, missing_update = 0 } = {}) {
  return clamp0(100 - 20 * drift - 15 * missing_update);
}

/** D4 code quality (SKILL.md:202): 100 − 10·crit − 4·imp. Counts are derived by the
 *  glue from the consensus-aggregated reviewer findings (critVotes=1 ⇒ dedup-only). */
export function scoreD4({ critical = 0, important = 0 } = {}) {
  return clamp0(100 - 10 * critical - 4 * important);
}

/** D5 cross-cutting (SKILL.md:236): 100 − 15·found − 5·shared (max 30) − 15·adjacent − 40·migration. */
export function scoreD5({ foundational = 0, shared = 0, adjacent_drift = 0, migration_conflict = 0 } = {}) {
  return clamp0(
    100 - 15 * foundational - Math.min(5 * shared, 30) - 15 * adjacent_drift - 40 * migration_conflict,
  );
}

/** D6 visual fidelity (SKILL.md:248): 100 − 10·drift. Conditional (see `composite` renorm). */
export function scoreD6({ drift = 0 } = {}) {
  return clamp0(100 - 10 * drift);
}

// --- composite (SKILL.md:126) + OD3a renormalization -----------------------

export const WEIGHTS = Object.freeze({ d1: 0.3, d2: 0.2, d3: 0.15, d4: 0.1, d5: 0.2, d6: 0.05 });
const WEIGHT_SANS_D6 = 0.95; // 0.30 + 0.20 + 0.15 + 0.10 + 0.20 — the OD3a divisor.

/**
 * Weighted composite. With D6 applicable: the full SKILL.md:126 weighted sum.
 * Without D6: drop the D6 term and divide the remaining weighted sum by 0.95
 * (OD3a) so the effective weights sum to 1.0 — all-dims-100 then yields exactly
 * 100 on BOTH paths.
 * @param {{d1,d2,d3,d4,d5,d6?}} scores  per-dimension scores (d6 ignored when !d6Applicable)
 */
export function composite(scores, { d6Applicable = true } = {}) {
  const { d1 = 0, d2 = 0, d3 = 0, d4 = 0, d5 = 0, d6 = 0 } = scores;
  const sansD6 = WEIGHTS.d1 * d1 + WEIGHTS.d2 * d2 + WEIGHTS.d3 * d3 + WEIGHTS.d4 * d4 + WEIGHTS.d5 * d5;
  return d6Applicable ? sansD6 + WEIGHTS.d6 * d6 : sansD6 / WEIGHT_SANS_D6;
}

/** Round-half-up for the displayed <N>/100 (OD3b). Route decisions use the RAW float, not this. */
export function displayScore(rawComposite) {
  return Math.round(rawComposite);
}

// --- blocking overrides (SKILL.md:234, 263-269) — FAIL-CLOSED --------------

// Deterministic blocking signals, computed by the glue and passed as explicit
// booleans on a SEPARATE fail-closed field (a degraded/unknown signal is the
// glue's responsibility to set true, never silently false). Discard > Rebuild.
export const DISCARD_SIGNALS = Object.freeze(['secrets', 'unprotected_public_mutation', 'foundational_auth_broken']);
export const REBUILD_SIGNALS = Object.freeze(['phi_in_logs', 'tests_majority_fail', 'migration_conflict', 'build_fails_no_fix']);

/**
 * Resolve the blocking override (if any). Fires regardless of composite.
 * @returns {{route: 'discard'|'rebuild'|null, signals: string[]}}
 */
export function blockingOverride(signals = {}) {
  const fired = (names) => names.filter((n) => signals[n] === true);
  const discard = fired(DISCARD_SIGNALS);
  if (discard.length) return { route: 'discard', signals: discard };
  const rebuild = fired(REBUILD_SIGNALS);
  if (rebuild.length) return { route: 'rebuild', signals: rebuild };
  return { route: null, signals: [] };
}

// --- route recommendation (SKILL.md:258-262) -------------------------------

/** Composite-band route on the RAW float (OD3b): ≥80 salvage / 40-79 user-decides / <40 rebuild. */
export function bandRoute(rawComposite) {
  if (rawComposite >= 80) return 'salvage';
  if (rawComposite >= 40) return 'user-decides';
  return 'rebuild';
}

// --- the full reduce -------------------------------------------------------

/**
 * The single authoritative reduce: per-dimension signals → scores → composite →
 * route. Blocking overrides fire regardless of composite (Discard > Rebuild).
 * @param {object} input  { d1, d2, d3, d4, d5, d6:{applicable,drift}, override_signals }
 * @returns {Readonly<object>} frozen { scores, d6_applicable, composite, composite_display, override, route, route_basis }
 */
export function computeAudit(input = {}) {
  const d6Applicable = !!(input.d6 && input.d6.applicable);
  const scores = {
    d1: scoreD1(input.d1),
    d2: scoreD2(input.d2),
    d3: scoreD3(input.d3),
    d4: scoreD4(input.d4),
    d5: scoreD5(input.d5),
    d6: d6Applicable ? scoreD6(input.d6) : null,
  };
  const raw = composite({ ...scores, d6: d6Applicable ? scores.d6 : 0 }, { d6Applicable });
  const override = blockingOverride(input.override_signals);

  let route;
  let route_basis;
  if (override.route === 'discard') {
    route = 'discard';
    route_basis = 'override-discard';
  } else if (override.route === 'rebuild') {
    route = 'rebuild';
    route_basis = 'override-rebuild';
  } else {
    route = bandRoute(raw);
    route_basis = 'composite';
  }

  return Object.freeze({
    scores: Object.freeze(scores),
    d6_applicable: d6Applicable,
    composite: raw,
    composite_display: displayScore(raw),
    override: Object.freeze({ route: override.route, signals: Object.freeze(override.signals) }),
    route,
    route_basis,
  });
}
