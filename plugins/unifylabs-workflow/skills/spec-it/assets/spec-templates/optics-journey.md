---
name: <journey-slug>
type: template
tier: 1
last_reviewed: YYYY-MM-DD
related_issues: []
related_modules: []
verifying_e2e_test: e2e/suites/<file>.spec.ts
code_anchors:
  - e2e/suites/<file>.spec.ts
  - src/app/<route>/page.tsx
---

<!--
  When you duplicate this file:
    1. Rename the file to `<journey-slug>.md` (kebab-case, matches e2e describe block).
    2. Change `type: template` above to `type: journey`.
    3. Set `tier: 1` (pre-emptive spec + @daily e2e) or `tier: 2` (spec on first touch).
    4. Replace every `<placeholder>` with real content.
    5. Set `last_reviewed:` to today's date (YYYY-MM-DD).
    6. Fill `related_issues:` and `related_modules:` (the module specs this journey
       crosses, e.g. `[orders, inventory, invoices]`).
    7. Set `verifying_e2e_test:` to the Playwright file that covers this journey.
       The test file's top-level describe is `Journey: <journey-slug>`.
    8. Add a row to `docs/specs/README.md` under "Journey specs".
    9. Aim for 100–300 total lines.
-->

# <Journey Name>

## Purpose

<!--
  Why this journey matters. 1–3 sentences. The user-recognizable flow it
  describes (e.g. "A new patient walks in and ends up with glasses ordered").
-->

## Verifying e2e test

<!--
  Markdown link to the Playwright spec file that exercises this journey.
  Brief description (1-2 sentences) of what the e2e covers vs. what's left to
  unit tests in the underlying modules.

  Example:
    [`e2e/suites/new-patient.spec.ts`](../../e2e/suites/new-patient.spec.ts)
    covers the full new-patient flow under a `Journey: new-patient-end-to-end`
    describe block. Each test() in that block corresponds 1:1 to one numbered
    step in the `## Steps` section below.
-->

[`<verifying_e2e_test>`](../../<verifying_e2e_test>)

## Steps

<!--
  Numbered list. Each step is one Given/When/Then sentence. Each step
  corresponds 1:1 to one `test()` case under the `Journey: <slug>` describe
  block in the verifying e2e test.

  Format:
    1. **Given** <preconditions>, **When** <user action>, **Then** <expected outcome>.
    2. ...

  At least one step in a Tier-1 journey carries the @daily tag in its e2e
  counterpart (so it runs in the daily CI workflow).
-->

1. **Given** <preconditions>, **When** <user action>, **Then** <expected outcome>.
2. ...

## Modules touched

<!--
  Links to the module specs this journey crosses. The journey spec describes
  the user-observable sequence; the module specs describe the per-module
  rules. The journey spec should NOT re-document module behavior — link out.

  Format:
    - [`<module-name>`](../modules/<module-name>.md) — <one-line role in this journey>
-->

- [`<module-name>`](../modules/<module-name>.md) — <role in this journey>

## Edge Cases & Constraints

<!--
  Cross-module edge cases. Behavior under partial completion (user abandons
  mid-flow). Recovery paths. Concurrency considerations specific to the
  journey (e.g. two staff members touching the same record).
-->

- When ...

## Open Questions / Known Limitations

<!--
  Cross-module concerns we know are imperfect but haven't resolved. Product
  decisions deferred. UX gaps.
-->

## Changelog

<!--
  Terse history. One line per significant change with PR link.
  Format: `- YYYY-MM-DD: <change description>. (#<PR-number>)`
-->

- YYYY-MM-DD: Initial spec captured. (#<PR>)
