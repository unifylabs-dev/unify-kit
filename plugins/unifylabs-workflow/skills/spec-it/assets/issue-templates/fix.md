<!--
  Fix issue body template — used when type = fix (bug).

  Difference vs feature template: adds Reproduction Steps + Expected Behavior;
  Spec sections affected is often "None — fixing drift from spec".
-->

## Description

<!--
  2–3 sentences describing the bug: what's broken, observable impact, suspected
  cause if known. Not the fix approach — that goes in Design Notes.
-->

## Reproduction Steps

<!--
  Numbered list. Reader should be able to reproduce in a fresh checkout.

  1. Open <route>
  2. Click <element>
  3. Observe <bad behavior>
-->

1. <step>
2. <step>
3. <observed bad behavior>

## Expected Behavior

<!--
  What should happen instead. One paragraph or a short list.
-->

## Acceptance Criteria

- [ ] <fix criterion — reproducible scenario above no longer triggers the bad behavior>
- [ ] <regression test added covering the scenario>
- [ ] <any related edge cases also handled>

## Spec sections affected

<!--
  Most common for fixes: "None — fixing drift from spec." Include verification
  that the spec is still accurate.

  If the fix REQUIRES a spec change (existing behavior was wrong and we're
  changing both code AND spec to reflect new correct behavior), list the spec
  paths normally.
-->

None — fixing drift from spec.
Verifying spec still accurate: `<path-to-spec>.md`

## Design Notes

<!--
  Root cause analysis. What was the actual bug? What was the fix approach?
  Any related code that should NOT be touched (scope guard hint).

  If trivial, write: "Straightforward — <one-line>."
-->

## Research notes

<!--
  If the bug was security/compliance-relevant and Phase 2e research was done,
  include findings here. Otherwise often skipped for simple fixes.
-->

## Doc updates for the same PR

<!--
  Fixes usually don't update guide docs, but flag any that should be touched:
    - `CHANGELOG.md` — entry under `[Unreleased]`
    - `docs/<x>.md` — if the bug exposed an inaccuracy in docs

  If none: "None."
-->

## Priority

<!-- One of: Low | Medium | High | Critical -->

Medium

<!--
  Fixes usually don't include a Proposed Spec Draft because spec sections affected
  is "None — fixing drift". If the fix DOES involve spec changes, include the
  same <details>-wrapped draft block as in feature.md.
-->
