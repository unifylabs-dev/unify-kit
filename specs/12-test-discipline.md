# Spec 12 — Test Discipline (CI Test-Split + Pyramid Canon + Workflow Templates)

> Status: Draft / awaiting review
> Depends on: 00 (vision + sourcing modes), 01 (filename canon), 02 (placeholder vocabulary), 07 (philosophy + methodology canon), 08 (CHANGELOG discipline), 09 (kit's own CI), 10 (SDD layer — BDD-Lite naming used here)
> Related: 11 (PR template's Verification Checklist references the per-PR test command)

## Purpose

Add the kit's test-scheduling layer: a smart CI test-split shell
snippet that keeps PR-time CI fast, a methodology canon block that
documents the cost/feedback rationale, and two CI workflow templates
(`ci-pr-fast.yml.template` bundling Tier-1 PR-fast + Tier-2 daily-E2E,
plus `ci-nightly.yml.template` for Tier-4) that show consumers the
canonical *shape* of a multi-tier test schedule.

This spec lands the kit-side artifacts. Consumers `cp` what they need
into `<consumer>/scripts/` and `<consumer>/.github/workflows/` and adapt
to their stack. The kit does not enforce any of these tiers — it
documents the pattern.

## Why this exists

Spec 10's SDD layer + spec 11's GitHub scaffolding give consumers a
spec-as-contract layer and the templates that enforce it. What's
missing is the *test-cost* discipline that makes the contract
practical at speed: PR feedback in 2–3 minutes, not 20.

The source project ships a smart `scripts/test-ci.sh` that always runs
core infrastructure tests + dynamically detects changed action files
and runs only their test counterparts (with a full-suite fallback on
master push). Combined with a 4-tier pyramid (CI fast / E2E daily /
local pre-PR / nightly full), it keeps PR CI under ~3 minutes while
maintaining coverage. The full `npm run test:run` (5–8 min) is the
local gate before opening a PR.

Without these tiers documented in the kit's canon, a consumer either
runs the full suite on every PR (slow and expensive) or runs no e2e
in CI (fast but blind). The 4-tier pattern is the working compromise,
and it's worth absorbing.

## What lands in this spec

Three artifacts plus one canon block plus the standard CHANGELOG
update.

### Batch A — Smart CI test-split snippet

#### A1. `templates/snippets/ci-test-split-bash.sh`

Sourcing mode: `customization`.

A bash script that runs in CI to split unit tests:

- **Always run** the core infrastructure subset (configurable; default
  pattern lists `lib/` `utils/` `api/` test dirs).
- **Conditionally run** action / handler test files matching changed
  source files in the current PR. Detects via `git diff --name-only`
  against the merge-base of `origin/$DEFAULT_BRANCH` (the bash
  variable defined at the top of the script; defaults to `main`).
- **Fall back to full suite** on push to default branch (so the
  default branch always has full-suite signal) or when `git diff` is
  unavailable (e.g., shallow checkout).

Stack-leaning toward Node + Vitest because that's the source project's
runner, but the *shape* (always-run subset + diff-driven additions +
fallback) is portable. Stack-specific bits are exposed as **bash
variables at the top of the script** with explanatory comments and
defaults — not as templating placeholders. Consumer adapts by editing
the values in place (or by overriding via env vars at invocation):

```bash
# CHANGE ME: paths whose tests always run (core infrastructure).
ALWAYS_RUN_GLOBS="${ALWAYS_RUN_GLOBS:-src/__tests__/lib/ src/__tests__/utils/ src/__tests__/api/}"

# CHANGE ME: source directory whose changes trigger test-file inclusion.
ACTION_DIR="${ACTION_DIR:-src/lib/actions/}"

# CHANGE ME: corresponding test directory.
TEST_DIR="${TEST_DIR:-src/__tests__/actions/}"

# CHANGE ME: test runner invocation.
RUNNER_CMD="${RUNNER_CMD:-npx vitest run}"

# CHANGE ME: default branch (main or master).
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
```

The shell-variable approach (rather than `<...>` or `{{...}}`
placeholders) is required because:

- Spec 02 §"Common conventions" explicitly reserves `<...>` for *prose*
  conventions (e.g., `/work-issue <N>`); using it as a literal
  placeholder syntax would conflict.
- The `{{...}}` vocabulary is for markdown templates whose CI
  validates placeholder usage; bash files are not in that scope.
- `${VAR:-default}` is the bash-native idiom for "configurable with
  a sensible default" — the script runs out-of-the-box on the
  source-project shape and consumers override piece by piece.

Header comment cites `docs/methodology.md` §C "Test scheduling" (added
in Batch B) as canonical source. Header also lists the bash variables
above so a consumer reading the file sees the override surface
immediately.

### Batch B — Test scheduling canon

#### B1. `docs/methodology.md` §C — new "Test scheduling" sub-section

Sourcing mode: `pattern-only`.

§C (Test-Driven Development) gains a sub-section after the Red-Green-
Refactor rules, titled "Test scheduling: match cost to feedback urgency."
Carries:

- **The principle.** "Match test cost to feedback urgency. Not every
  test needs to run on every push — fast feedback on the change in
  hand, slower feedback on integration concerns, slowest feedback on
  cross-cutting regressions."
- **The four-tier table** (stack-agnostic):

  | Tier | When | What runs | Typical time |
  |---|---|---|---|
  | **CI (fast)** | Every push/PR | Core infrastructure tests + tests for changed code paths. The gate for PR review. | 2–3 min |
  | **E2E daily** | Daily cron, NOT on PRs | `@daily`-tagged e2e tests covering critical read-only paths (auth, nav, list pages, route guards). | 5–8 min |
  | **Local (pre-PR)** | Before opening a PR | Full unit suite. The author's gate before requesting review. | 5–8 min |
  | **Nightly** | Daily cron, late hours | Full e2e suite + full unit suite. Catches cross-cutting regressions. | 60–75 min |

- **Tagging convention.** `@daily` = read-only tests on critical
  paths (no DB writes, no destructive actions). Untagged = nightly-
  only. Cross-references the BDD-Lite naming in `docs/methodology.md`
  §B for the `Journey: <slug>` describe-block convention.
- **Anti-pattern call-outs.** "Running the full suite on every PR
  when CI takes >5 min" (slow PR feedback degrades author behavior);
  "running only the unit suite in CI" (no integration coverage); "no
  nightly" (regressions accumulate silently).

Pointer to `templates/snippets/ci-test-split-bash.sh` for a working
implementation of the CI-fast tier.

### Batch C — CI workflow templates

#### C1. `templates/snippets/ci-pr-fast.yml.template`

Sourcing mode: `customization`.

A GitHub Actions workflow shape covering Tier 1 (CI fast) + Tier 2
(daily E2E) in a single file, matching the source project's pattern.
Two jobs:

- **`test`** — runs on every push/PR. Type-check + unit tests via
  `{{TYPECHECK_CMD}}` + `{{TEST_CI_CMD}}`.
- **`e2e-daily`** — runs only on `schedule` events
  (`if: github.event_name == 'schedule'`). Builds + seeds + runs
  `@daily`-tagged e2e tests.

Workflow-level parameterization:

- `{{TYPECHECK_CMD}}` (existing vocab).
- `{{TEST_CI_CMD}}` (existing vocab) — pointer to the script in
  Batch A or to the consumer's own runner invocation.
- `{{BUILD_CMD}}` (existing vocab).
- The workflow's `on.push.branches` and `on.pull_request.branches`
  arrays are hardcoded to `[main]` with a YAML comment instructing
  the consumer to change it to `[master]` (or whatever) if needed.
  No template placeholder for branch names — keeping it inline
  avoids vocabulary expansion for a one-off value.
- Setup steps (Node version, Python version, Ruby version, etc.) are
  stack-specific and left as commented-out blocks the consumer
  uncomments / adapts. The template's YAML `#` comment header notes
  this explicitly.

The e2e-daily job carries a "secrets gate" pattern: an early step
checks whether the e2e secret env vars are configured and skips the
job's later steps gracefully if not. This pattern is specifically
called out as the load-bearing optics-management innovation that
saves CI minutes when secrets aren't set up yet.

#### C2. `templates/snippets/ci-nightly.yml.template`

Sourcing mode: `customization`.

Separate workflow for Tier 4 (nightly full). Single job that runs the
full unit suite + full e2e suite on a `schedule` cron (recommend 2–3
AM UTC) + manual trigger via `workflow_dispatch`. Same secrets-gate
pattern as the daily-e2e job in C1.

Parameterized via existing `{{TEST_FULL_CMD}}` for the full-unit run.
The full-e2e command (e.g., `npx playwright test`, `bundle exec rspec
spec/e2e`) is left as a TODO comment in the workflow's e2e step with
a sentence explaining what to fill in — *not* a markdown placeholder,
because the kit has no canonical "full e2e" concept distinct from
`{{TEST_FULL_CMD}}` and adding one for a single template is over-
engineering.

#### C3. No standalone `ci-daily-e2e.yml.template`

Per Decision #2 below, the daily-e2e job lives inside `ci-pr-fast.yml.template`
(matching the source project's bundling). A standalone file is not
shipped. The original gap-analysis plan listed it as a separate file;
this spec consolidates.

### Batch D — Cross-cutting

- **`templates/README.md`** — table-row entries for the three new
  snippets (`ci-test-split-bash.sh` + `ci-pr-fast.yml.template` +
  `ci-nightly.yml.template`) under the existing `## Templates` table.
  No new vocabulary placeholders, so the placeholder table doesn't
  grow.
- **`CHANGELOG.md`** `[Unreleased]` — Added bullets for the three
  snippets and the methodology §C sub-section; Changed bullet for
  the README row additions.

## What does NOT land in this spec

- **A `{{INSTALL_CMD}}` placeholder** (e.g., `npm ci`, `bundle install`).
  Considered. Rejected: install steps in CI workflows are highly
  stack-specific and the templates already require commented-out
  setup blocks; one more placeholder doesn't reduce that work
  meaningfully. Consumers edit the install step directly.
- **Stack-specific flavors of the workflow templates** (Rails CI,
  Django CI, Go CI). Same deferral as `templates/claude.md.template`
  multi-stack flavors — wait until at least two consuming teams have
  hit a real limitation with the Next.js-shaped templates plus
  per-consumer adaptation.
- **A test-coverage workflow** (uploading coverage to Codecov, etc.).
  Out of scope; cost-discipline orthogonal.
- **A monorepo-aware variant** of the smart test-split (path-based
  workspace detection, conditional package builds). Single-repo
  shape only in this spec.
- **Renaming `{{TEST_CI_CMD}}` or `{{TEST_FULL_CMD}}`** to clarify
  semantics. They're the kit's standard names; the new methodology
  sub-section explains the distinction (CI = fast subset; FULL =
  pre-PR gate). Kept stable.
- **Changes to the kit's *own* CI** (`.github/workflows/`). The
  kit's CI is governed by spec 09 and serves a different purpose
  (validating kit artifacts). The CI workflow templates here are
  *consumer-facing* and ship under `templates/`.

## Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Where does the test-scheduling canon live? | Sub-section under §C (Test-Driven Development). Test scheduling is adjacent to TDD (how you write tests) — it's how you *run* them. A separate top-level §K would orphan the relationship. Rejected: standalone §F-bis between Verification and Living docs (test scheduling is upstream of those). |
| 2 | One CI workflow file or three? | Two files: `ci-pr-fast.yml.template` (bundles Tier-1 PR-fast + Tier-2 daily-E2E) + `ci-nightly.yml.template` (Tier-4 standalone). Matches source project (`ci.yml` + `nightly.yml`). One file would mix push-triggered and schedule-only triggers awkwardly; three files is over-fragmented for CI workflows that consumers typically read end-to-end. |
| 3 | Add `{{INSTALL_CMD}}` to vocabulary? | No. Install steps are stack-specific enough that templates already require commented-out setup blocks; another placeholder doesn't reduce that work meaningfully. The vocabulary stays at 18. |
| 4 | Placeholder convention in `ci-test-split-bash.sh`? | Bash variables with `${VAR:-default}` defaults at the top of the script — *not* `<...>` (which spec 02 reserves for prose convention) and *not* `{{...}}` (markdown-template-only). The script runs out-of-the-box on the source-project shape; consumers override the variable values in place (or via env vars at invocation). Resolves a collision with spec 02 §"Common conventions" that the original draft did not. |
| 5 | Does the daily-e2e job include a secrets-gate? | Yes. The source project's e2e-daily job's `if: secrets configured` step is the load-bearing pattern that lets consumers land the workflow before configuring DB/Supabase/etc. secrets. Without it, the workflow fails on every cron until secrets land. Worth absorbing. |
| 6 | Default schedule times? | Daily-e2e: 8 AM UTC (matches source project; out of US peak hours but covers EU mornings). Nightly: 2 AM UTC. Both parameterized as YAML cron strings the consumer adjusts. |

## Out of scope

- A consumer-facing `scripts/README.md` documenting the test-split
  script's invocation. The script's header comment is sufficient;
  consumers' own `scripts/` directory tends to have its own README.
- A retroactive rename of `{{TEST_CI_CMD}}` and `{{TEST_FULL_CMD}}`
  to be more semantically self-describing. Vocabulary stability
  beats marginal naming clarity at this point.
- Auto-generation of the `@daily` tag list from journey-spec
  `tier:` frontmatter. Considered; rejected as too much machinery
  for the value. Consumers maintain the tag list manually.
- A per-AC scoped test-runner pattern. The smart test-split runs
  per-changed-file, which is already path-based; per-AC requires
  AC-tagging in tests, which is more invasive than the value.

## Acceptance criteria

This spec's PR is acceptable when all of the following are
demonstrably true:

- **A1 — Smart test-split snippet exists.**
  `templates/snippets/ci-test-split-bash.sh` is valid bash (passes
  shellcheck — see "Lint scope expansion" below), declares
  `customization` sourcing mode in its header comment, has the
  three-branch logic (always-run + diff-driven + fallback), exposes
  stack-specific bits as bash variables with `${VAR:-default}` at
  the top of the script (not `<...>` or `{{...}}` placeholders), and
  cites methodology §C "Test scheduling" as canonical source.
- **B1 — Methodology §C "Test scheduling" sub-section exists.**
  `docs/methodology.md` §C contains a named sub-section "Test
  scheduling: match cost to feedback urgency" with the four-tier
  table, the principle statement, the tagging convention, and at
  least three anti-pattern call-outs. The §C heading itself
  (Test-Driven Development) is unchanged; the sub-section is
  additive.
- **C1 — `ci-pr-fast.yml.template` exists.** Valid GitHub Actions
  YAML (parses via `yaml.safe_load`), declares sourcing mode in a
  YAML `#` comment header, contains both `test` and `e2e-daily`
  jobs with the secrets-gate on the daily job, parameterizes via
  existing `{{TYPECHECK_CMD}}`, `{{TEST_CI_CMD}}`, `{{BUILD_CMD}}`,
  and leaves stack-specific setup as commented-out blocks.
- **C2 — `ci-nightly.yml.template` exists.** Valid YAML, declares
  sourcing mode, has a single nightly job with the secrets-gate
  pattern, parameterizes via `{{TEST_FULL_CMD}}`, and includes a
  TODO-with-explanation comment at the e2e step where the consumer
  fills in their stack's full-e2e command.
- **D1 — `templates/README.md` template-table rows added.** Three
  new rows: `ci-test-split-bash.sh`, `ci-pr-fast.yml.template`,
  `ci-nightly.yml.template`. No new placeholders introduced.
- **Mechanical placeholder check.** `scrub-check.yml`'s
  placeholder-vocab job passes — every `{{...}}` in the new
  templates is in the existing 18-placeholder vocabulary; no
  vocabulary expansion this round.
- **Forbidden-strings check.** `scrub-check.yml`'s forbidden-strings
  job passes — no `optics-management`, `optics_boutique`, `mvo_*`,
  `Mint Vision`, PHIPA-flavored prose, or domain-specific strings
  (e.g., "staff portal" from the source project) leak into the new
  artifacts.
- **YAML validation.** Both `*.yml.template` files parse via
  `python3 -c "import yaml; yaml.safe_load(open('<file>'))"`. This is
  the only YAML check the implementing PR runs against the new
  files — actionlint does *not* run against `templates/snippets/`
  (its scope is `.github/workflows/*.yml github-actions/*.yml`,
  per `.github/workflows/lint.yml`). The `{{...}}` literals in the
  workflow templates would otherwise break actionlint anyway, so
  scope exclusion is correct, not a gap.
- **Lint scope expansion.** The implementing PR amends
  `.github/workflows/lint.yml` to include `templates/snippets/*.sh`
  in the shellcheck scope (currently `hooks/*.sh scripts/*.sh
  scripts/ci/*.sh`). This makes the new bash snippet a CI-gated
  shellcheck target. Justification: spec 09's principle "the kit
  dogfoods quality gates on its own scripts" — shipping a bash
  snippet without dogfooding shellcheck on it would be a credibility
  hit.
- **Lint-clean.** `lint.yml` passes after the scope expansion above:
  shellcheck on `hooks/*.sh scripts/*.sh scripts/ci/*.sh
  templates/snippets/*.sh`, actionlint unchanged, markdownlint clean
  on the methodology updates and README, lychee clean.
- **CHANGELOG entry.** `[Unreleased]` carries Added bullets for
  the three snippets and the methodology §C sub-section; Changed
  bullet for the README updates. Per spec 08 CHANGELOG-discipline
  rules.

## Post-merge validation

Not gated by CI. Carried out by the maintainer after the
implementing PR merges:

- **End-to-end install + run.** Copy `ci-test-split-bash.sh` into a
  consumer repo, adapt the placeholders to the consumer's runner +
  paths, run it locally with a known-changed source file, confirm
  the script picks up the corresponding test file. Then commit and
  push to a PR branch and confirm the workflow runs in <3 min.
- **Daily-e2e dry run.** Manually trigger the daily-e2e workflow
  via `workflow_dispatch` on a fresh consumer install. Confirm the
  secrets-gate behavior: with no secrets, the job logs a skip and
  exits cleanly; with secrets, the job runs the e2e tests.
- **Methodology §C readability.** Read the new sub-section
  end-to-end as if onboarding to the kit. Confirm the four-tier
  table reads as a recipe and the anti-pattern call-outs are
  unambiguous.

## Implementation notes (non-binding)

The implementing PR (separate branch, `templates/test-discipline`
or similar) should land all three artifacts (1 bash + 2 YAML) plus
the methodology sub-section plus the `lint.yml` scope expansion plus
the README + CHANGELOG updates atomically in one PR.

**Local checks before push:**

- `shellcheck templates/snippets/ci-test-split-bash.sh` — must pass
  before pushing (the implementing PR also lands the `lint.yml`
  scope expansion that makes this CI-gated, but the local pass is
  the first signal).
- `python3 -c "import yaml; yaml.safe_load(open('<f>'))"` for both
  `*.yml.template` files.
- Optional: `actionlint <file>` locally on each YAML template to
  spot-check shape — accept that the `{{...}}` literals will produce
  warnings; treat them as informational. CI does not actionlint
  these files.

**Why actionlint can't lint the templates:**

Two reasons. (1) Scope: `lint.yml`'s actionlint job runs against
`.github/workflows/*.yml github-actions/*.yml` — `templates/snippets/`
is intentionally excluded. (2) Content: the templates contain
`{{TYPECHECK_CMD}}` etc. as literal strings inside `run:` blocks,
which actionlint treats as suspicious shell. If we wanted to
actionlint the templates, we'd have to substitute placeholders
first — out of scope for v0.2.x.

**Smart test-split: the git-diff fallback is load-bearing.** When
`origin/$DEFAULT_BRANCH` is unavailable (shallow checkout, detached
HEAD, missing remote), the script must fall back to the full suite
*not* to the always-run subset. Otherwise the script silently runs
a tiny test set on shallow checkouts and hides regressions. The
fallback shape (test for merge-base availability, full-suite if
not) is in the source-project script and ports cleanly.

## Revisions

**v2 revision (2026-05-07, in PR #14 self-review pass):**

- Fixed Purpose section's "three CI workflow templates" → "two CI
  workflow templates" (Decision #2 consolidates daily-E2E into
  `ci-pr-fast.yml.template`; only two YAML templates ship).
- Fixed Implementation notes's "all four artifacts" → "all three
  artifacts (1 bash + 2 YAML)". Counting was off; canon block is
  separate.
- Resolved the `<...>`-as-placeholder collision with spec 02 §"Common
  conventions" (spec 02 reserves `<...>` for *prose*, not literal
  placeholder syntax). Switched the bash snippet's parameterization
  to **bash variables with `${VAR:-default}` defaults** at the top
  of the script. Updated A1, Decision #4, and the parameterization
  list. Same fix applied to C2's full-e2e command (now a TODO comment,
  not `<E2E_FULL_CMD>`).
- Fixed the AC's "shellcheck on the new bash snippet" claim. The
  existing `lint.yml` shellcheck scope is `hooks/*.sh scripts/*.sh
  scripts/ci/*.sh` only — `templates/snippets/*.sh` is not covered.
  Added a new "Lint scope expansion" AC requiring the implementing
  PR to amend `lint.yml` to include `templates/snippets/*.sh`. This
  closes a credibility gap (per spec 09: kit dogfoods quality gates
  on its own scripts).
- Fixed the AC's "actionlint on workflow YAMLs" claim. Actionlint's
  scope (`.github/workflows/*.yml github-actions/*.yml`) doesn't
  include `templates/snippets/`, and the `{{...}}` literals would
  break actionlint anyway. Updated AC to clarify YAML-parse is the
  only CI check and explained the scope-exclusion rationale.

**Forward references.** Spec 13 (consumer CLAUDE.md enrichment + retro
template) is sequenced after this spec with no commitment date.
