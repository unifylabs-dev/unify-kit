<!--
templates/snippets/testing/bdd-lite-test-naming.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Stack-leaning toward Playwright since that is the canonical e2e tool
referenced in the kit's methodology. The convention itself (Journey
describe + Given/When/Then test names + scope rule for new tests only)
is portable to any test runner that supports nested describe blocks
(Vitest, Jest, Mocha, Cypress, etc.).

Canonical source for the rules: `docs/methodology.md` §B "Specification-
Driven Development" → BDD-Lite naming convention. This file is the copy-
paste fragment.

Authored: 2026-05-06
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# BDD-Lite test naming convention

For **new e2e tests** and **new behavior-flavored unit/integration tests**
that exercise multi-step flows, use the BDD-Lite naming convention. New
tests only — never rewrite existing passing assertion-style tests to fit
this shape.

## Example (Playwright)

```ts
import { test } from "@playwright/test";

test.describe("Journey: <journey-slug>", () => {
  test("Given <preconditions>, When <user action>, Then <expected outcome>", async ({ page }) => {
    // …
  });

  test("Given <next preconditions>, When <next user action>, Then <next outcome>", async ({ page }) => {
    // …
  });

  test("Given <final preconditions>, When <final user action>, Then <final outcome>", async ({ page }) => {
    // …
  });
});
```

## Rules

- **Top-level describe is `Journey: <slug>`.** The slug matches the
  journey-spec filename (without `.md`) under `<consumer>/docs/specs/journeys/`.
- **Each `test()` body is named with a Given / When / Then sentence.** Each
  G/W/T sentence corresponds 1:1 to one numbered step in the journey spec's
  `## Steps` section.
- **At least one test per Tier-1 journey carries the `@daily` tag** so it
  runs in the daily-e2e CI workflow:
  ```ts
  test.describe("Journey: <journey-slug> @daily", () => { … });
  ```
  Or per-test: `test("Given … @daily", ...)`. The exact tag mechanism is
  test-runner-specific; the convention is the tag string `@daily`.
- **Convention applies to NEW tests only.** Existing assertion-style unit
  tests stay as they are. Never rewrite a passing test to fit the
  convention; that risks breaking coverage to chase aesthetics.
- **"Behavior-flavored unit test" is a narrow category** — a unit-runner
  test that simulates a multi-step user-observable flow (e.g., an action
  chain that exercises CSV import → validation → DB write → notification
  emit). Most unit tests are `function does X when called with Y`; those
  stay assertion-style.

## Adapting to other test runners

The convention is naming-only — no DSL, no `.feature` files, no Cucumber.
Any test runner that supports nested describe blocks supports it:

- **Vitest / Jest:** `describe("Journey: <slug>", () => { it("Given …", …) })`
- **Mocha:** `describe("Journey: <slug>", () => { it("Given …", …) })`
- **Cypress:** `describe("Journey: <slug>", () => { it("Given …", …) })`

Adapt helper imports to your runner; the describe-name + Given/When/Then
sentence + 1:1 mapping to the journey spec's `## Steps` are the load-
bearing pieces.
