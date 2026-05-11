<!--
templates/pull-request-template.md.template
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Stack-agnostic PR template; structurally inspired by a real consumer
project's pull_request_template.md, no expression lifted. Test/build
commands parameterized via gh workflow run bootstrap-fixture.yml and .

When you adopt this template, save it as `<consumer>/.github/pull_request_template.md`
(strip the `.template` suffix; lowercase filename per GitHub's convention)
and search-and-replace the `{{...}}` tokens.

Authored: 2026-05-07
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

## Summary

<!-- 1-3 sentences: what this PR does and why. -->

Closes #<!-- issue number -->

## Acceptance Criteria

<!-- Mirror the issue's ACs. Tick each box when the AC is satisfied. -->

- [ ] AC1
- [ ] AC2

## Spec Changes

<!--
Tick exactly one of the two boxes below. The reviewer will challenge a
"drift fix" claim if the spec doesn't actually document the behavior in
question — see <consumer>/docs/methodology.md §B.
-->

- [ ] This PR updates `docs/specs/` to reflect new behavior, OR
- [ ] This PR fixes drift from existing spec (no spec change needed), AND I've verified the spec is still accurate.

Spec files modified:

- `docs/specs/modules/<name>.md` (sections: Behavior, Edge Cases)

<!-- Omit the "Spec files modified" sub-list if this is a drift fix. -->

## Changes

| File | Change |
|------|--------|
| `<path>` | Created \| Modified — <one-line purpose> |

## Test Coverage

- N new tests in `<test-dir>/...`
- All existing tests pass.

## Verification Checklist

- [ ] `gh workflow run bootstrap-fixture.yml` — all tests pass.
- [ ] `shellcheck scripts/*.sh hooks/*.sh` + `actionlint .github/workflows/*.yml` — no warnings.
- [ ] Feature verification: scripts behave as documented; fixture sets regenerated + committed if output shape changed.
- [ ] Scope guard: all changed files map to acceptance criteria.

## Design Decisions

<!-- Non-obvious choices, or "None — straightforward implementation." -->

## Test Plan

<!-- Manual-verification steps the reviewer can re-run. -->

- [ ] Manual verification step 1
- [ ] Manual verification step 2
