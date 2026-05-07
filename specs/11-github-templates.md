# Spec 11 — GitHub Repo Scaffolding (PR + Issue Templates)

> Status: Draft / awaiting review
> Depends on: 00 (vision + sourcing modes), 01 (filename canon), 02 (placeholder vocabulary), 08 (CHANGELOG discipline + ADR format), 09 (kit's own CI), 10 (SDD layer — these templates encode SDD discipline)
> Related: forthcoming 12 (test discipline), 13 (consumer CLAUDE.md enrichment)

## Purpose

Add the consumer-facing GitHub repo scaffolding that encodes the SDD
discipline shipped in spec 10: a pull-request template that gates the
"spec updated vs drift fix" decision, and two issue templates (feature
request + bug report) that enforce the "Spec sections affected" field
that `/work-issue` Phase 0 reads.

This spec lands the kit-side templates. The `.github/` directory in a
consumer's repo is populated by manual `cp` (per the originating
gap-analysis plan's resolved decision §4 — bootstrap-installer
extension defers to v1.0.0). `templates/README.md` documents the
manual install commands.

## Why this exists

Spec 10 added the durable spec layer (module + journey templates,
methodology §B SDD, drift-fix decision tree, lazy-bootstrap rule). The
discipline is documented in canon and the templates exist — but a
consumer's repo has no enforcement points yet. Without PR/issue
templates that *require* the "Spec sections affected" field and force
the "spec updated vs drift fix" decision, the SDD discipline relies on
contributor discipline alone, which doesn't scale across teams or
across agent sessions.

The source project's PR/issue templates are the load-bearing
enforcement mechanism for SDD: the issue template's required field
gates `/work-issue` Phase 0; the PR template's checkbox forces an
explicit decision the reviewer can challenge. unify-kit absorbs this
mechanism so consumers get it on day one of adoption.

`BACKLOG.md` already lists `.github/ISSUE_TEMPLATE/` and
`.github/PULL_REQUEST_TEMPLATE.md` under "v1.0.0 release prep" as
formality items. This spec brings them forward and gives them content
that earns their keep.

## What lands in this spec

Three artifacts plus two cross-cutting updates.

### Batch A — Templates

#### A1. `templates/pull-request-template.md.template`

Sourcing mode: `customization`.

A `.md.template` rather than `.md` so the consumer can substitute
project-specific commands. After substitution and rename, the consumer
saves it as `<consumer>/.github/pull_request_template.md` (no
`.template` suffix; lowercase filename per GitHub's convention).

Body sections (in order):

1. **Summary** — 1–3 sentences on what and why.
2. **Closes** — `Closes #<issue-number>`.
3. **Acceptance Criteria** — checkbox list mirroring the issue's ACs.
4. **Spec Changes** — two-mutually-exclusive checkboxes:
   - `[ ] This PR updates docs/specs/ to reflect new behavior, OR`
   - `[ ] This PR fixes drift from existing spec (no spec change needed), AND I've verified the spec is still accurate.`
   Plus a "Spec files modified:" sub-list (omit on drift fix).
5. **Changes** — table of `File | Change` rows.
6. **Test Coverage** — bullets describing new tests + "All existing tests pass."
7. **Verification Checklist** — checkboxes:
   - `[ ] {{TEST_FULL_CMD}}` — all tests pass.
   - `[ ] {{BUILD_CMD}}` — no errors.
   - `[ ] Feature verification: code paths traced, auth checks confirmed`
   - `[ ] Scope guard: all changed files map to acceptance criteria`
8. **Design Decisions** — non-obvious choices, or "None — straightforward implementation."
9. **Test Plan** — manual-verification steps as checkboxes.

Placeholders used: `{{TEST_FULL_CMD}}` and `{{BUILD_CMD}}` (both
already in the vocabulary). No new placeholders introduced.

#### A2. `templates/issue-templates/feature-request.yml.template`

Sourcing mode: `customization`.

GitHub issue-template format (YAML schema). Stack-agnostic. After
substitution, the consumer saves it as
`<consumer>/.github/ISSUE_TEMPLATE/feature_request.yml`.

Required form fields (in order):

1. **Description** (textarea, required) — what feature, what problem.
2. **Acceptance Criteria** (textarea, required) — checkbox-format ACs.
   Note in the description: "This section is required — the
   `/work-issue` skill depends on it."
3. **Spec sections affected** (textarea, required) — placeholder
   examples reference `<consumer>/docs/specs/modules/<name>.md` and
   `<consumer>/docs/specs/journeys/<slug>.md`. Description references
   `<consumer>/docs/methodology.md` §B SDD for the workflow context.
4. **Design Notes** (textarea, optional) — UI mockups, architecture
   ideas, constraints.
5. **Priority** (dropdown, optional) — Low / Medium / High / Critical.

Title prefix: `[Feature]: `. Default labels: `enhancement`.

#### A3. `templates/issue-templates/bug-report.yml.template`

Sourcing mode: `customization`.

Same schema, different shape. Stack-agnostic. Consumer saves as
`<consumer>/.github/ISSUE_TEMPLATE/bug_report.yml`.

Required form fields (in order):

1. **Bug Description** (textarea, required) — what happened, what was
   expected.
2. **Steps to Reproduce** (textarea, required) — numbered.
3. **Acceptance Criteria / Fix Verification** (textarea, required) —
   checkbox-format conditions confirming the bug is fixed.
4. **Spec sections affected** (textarea, required) — explicitly
   describes the drift-fix vs behavior-change decision per
   methodology §B (drift fix → "None — fixing drift from spec";
   behavior change → list spec(s) and section(s)).
5. **Environment** (textarea, optional) — browser/OS/context.

Title prefix: `[Bug]: `. Default labels: `bug`.

### Batch B — Manual install instructions

#### B1. `templates/README.md` — new section

A `## GitHub repo scaffolding` section is added to `templates/README.md`
documenting the manual-install procedure for the three templates above.
Worked-example commands using `cp`:

```bash
# From the consumer repo's root, with unify-kit cloned alongside as ../unify-kit:
mkdir -p .github/ISSUE_TEMPLATE
cp ../unify-kit/templates/pull-request-template.md.template .github/pull_request_template.md
cp ../unify-kit/templates/issue-templates/feature-request.yml.template .github/ISSUE_TEMPLATE/feature_request.yml
cp ../unify-kit/templates/issue-templates/bug-report.yml.template .github/ISSUE_TEMPLATE/bug_report.yml
# Then search-and-replace {{...}} placeholders in pull_request_template.md.
```

The README section also lists which templates contain placeholders
(only the PR template) and which are lift-as-rename (both issue
templates).

### Batch C — BACKLOG update

#### C1. `BACKLOG.md` — remove obsolete bullets

The "v1.0.0 release prep" section currently lists
`.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE.md` as
deferred. With Batch A landing them earlier, those two bullets are
removed from BACKLOG.md. The remaining release-prep items
(`CODE_OF_CONDUCT.md`, `SECURITY.md`, branch protection on `main`)
stay.

## What does NOT land in this spec

- **An ADR-proposal issue template.** Considered (BACKLOG mentions
  it). Rejected for v0.2.0 because the ADR format is already documented
  in `docs/decisions/README.md` and a wrapper template adds little
  value over the existing process. Revisit if/when contributor volume
  warrants it.
- **Bootstrap-installer extension** for `.github/` templates. Defers
  to v1.0.0 per the originating gap-analysis plan's resolved decision
  §4. Manual `cp` is the install path for now.
- **CODEOWNERS, dependabot.yml, branch-protection scaffolding.** Out
  of scope; these aren't related to the SDD discipline and have their
  own design considerations.
- **Auto-on-PR review workflow** (`claude-pr-auto-review.yml`).
  Already in BACKLOG under "Stretch GitHub Actions"; not part of
  this spec.

## Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | PR template format — `.md` lift-as-is or `.md.template` with placeholders | `.md.template`. The verification checklist references `{{TEST_FULL_CMD}}` and `{{BUILD_CMD}}`; without parameterization the kit would have to choose `npm run test:run` (Next.js bias) or leave the checklist content-free. Parameterization keeps the template stack-agnostic and forces the consumer to declare their commands once. |
| 2 | Issue templates — YAML form schema (`*.yml`) or markdown (`*.md`) | YAML form schema. GitHub renders `*.yml` issue templates as a guided form (better field validation, required-field enforcement, dropdown support). Markdown templates render as a free-text body. The required-field enforcement is the load-bearing piece for "Spec sections affected." |
| 3 | Issue-template directory layout in the kit | `templates/issue-templates/`. Mirrors `templates/specs/` (subdirectory for grouped templates) per the v0.1.x layout precedent for related templates. Consumer copies them into `.github/ISSUE_TEMPLATE/` (note: GitHub's directory uses `ISSUE_TEMPLATE`, not `issue-templates` — the kit follows kebab-case in its own filesystem and lets the install step rename). |
| 4 | Bootstrap installer extension | Defers per gap-analysis plan §4 (Decisions taken). |
| 5 | ADR-proposal issue template | Not adopted in v0.2.0 (low value vs effort). |
| 6 | Drop `[Bug]:` / `[Feature]:` title prefixes? | Keep. The prefixes survive label-based filtering when the issue is referenced by URL elsewhere; cost is one click of friction for the issue author. |

## Out of scope

- Wrapping the install step in a script (e.g., a sub-flag on
  `bootstrap-claude-config.sh`). Defers to v1.0.0 per Decision #4.
- Pre-filled example issues / PRs. The templates ship empty; an
  `examples/` directory of filled-in samples is deferred to v1.1.0
  per `specs/00-vision-and-license.md`.
- Project-board automation (`project-auto-add.yml`-style workflow
  that the source project also ships). Project-board layout is
  consumer-specific; out of scope for the kit.
- A separate "chore" or "refactor" issue template. Bug + feature
  cover the two main flows; chores can use the feature template
  (the AC field accepts "no behavior change — see PR" prose).

## Acceptance criteria

This spec's PR is acceptable when all of the following are
demonstrably true:

- **A1 — PR template exists.** `templates/pull-request-template.md.template`
  renders as valid markdown, declares `customization` sourcing mode in
  its HTML comment header, uses only `{{TEST_FULL_CMD}}` and
  `{{BUILD_CMD}}` placeholders (both already in vocabulary), contains
  the 9 named body sections in order, and has the Spec Changes
  section's two-checkbox shape.
- **A2 — Feature-request issue template exists.**
  `templates/issue-templates/feature-request.yml.template` is valid
  YAML matching GitHub's issue-template schema (`name`, `description`,
  `title`, `labels`, `body` with the 5 required fields), declares
  `customization` sourcing mode in its HTML comment header (top of
  file before YAML), and references `<consumer>/docs/methodology.md`
  in the "Spec sections affected" field's description.
- **A3 — Bug-report issue template exists.**
  `templates/issue-templates/bug-report.yml.template` is valid YAML,
  declares sourcing mode, and contains the 5 required fields with
  the drift-fix vs behavior-change decision documented in the
  "Spec sections affected" description.
- **B1 — Manual install instructions in `templates/README.md`.**
  A new `## GitHub repo scaffolding` section appears with worked-example
  `cp` commands and a note distinguishing placeholder-bearing from
  lift-as-rename templates.
- **C1 — BACKLOG bullets removed.** `.github/ISSUE_TEMPLATE/` and
  `.github/PULL_REQUEST_TEMPLATE.md` no longer appear under
  `BACKLOG.md` "v1.0.0 release prep." The other release-prep items
  (`CODE_OF_CONDUCT.md`, `SECURITY.md`, branch protection) remain.
- **Mechanical placeholder check.** `scrub-check.yml`'s
  placeholder-vocab job passes against the new PR template — only
  `{{TEST_FULL_CMD}}` and `{{BUILD_CMD}}` appear; no new placeholders
  introduced.
- **Forbidden-strings check.** `scrub-check.yml`'s forbidden-strings
  job passes — no `optics-management`, `optics_boutique`, `mvo_*`,
  `Mint Vision`, or PHIPA-flavored prose leaks into the new templates.
  Discussion of these patterns is allowed in this spec file (specs/
  is exempt).
- **YAML validation.** `actionlint` doesn't apply here (it lints
  workflow YAMLs, not issue-template YAMLs), but the YAML must parse
  via standard YAML validators. Manual eye-check is acceptable; the
  CI doesn't currently lint issue-template schemas. Acceptance:
  `python3 -c "import yaml; yaml.safe_load(open('<file>'))"` succeeds
  on each `*.yml.template`.
- **Lint-clean.** `lint.yml` passes: shellcheck N/A (no shell),
  actionlint clean, markdownlint clean on PR template + README,
  lychee clean.
- **CHANGELOG entry.** `## [Unreleased]` carries entries per spec 08
  CHANGELOG discipline: `### Added` for the three new templates and
  the README section; `### Removed` (or `### Changed`) for the
  BACKLOG cleanup. Placement follows spec 10's precedent: net-new
  files go in Added; modifications to existing files go in Changed.

## Post-merge validation

Not gated by CI. Carried out by the maintainer after the
implementing PR merges, before tagging any v0.x.x release that
contains the GitHub-scaffolding layer:

- **End-to-end install test.** Run the worked-example `cp` commands
  from `templates/README.md` against a fresh consumer repo. Confirm
  the resulting `.github/pull_request_template.md` and
  `.github/ISSUE_TEMPLATE/{feature_request,bug_report}.yml` render
  correctly on GitHub (issue-template form fields appear as a guided
  UI; PR template populates the new-PR body).
- **One real issue + one real PR.** Open a synthetic issue using the
  feature-request template; confirm "Spec sections affected" is
  required. Open a PR using the PR template; confirm the Spec Changes
  section's two checkboxes work as expected.

## Implementation notes (non-binding)

The implementing PR (separate branch, `templates/github-scaffolding`
or similar) should land all three templates plus the README update
plus the BACKLOG cleanup in one PR. CI is fast (no new workflow
changes, just `templates/` additions) so atomicity costs little.

The PR template's `## Spec Changes` section should match the source
project's checkbox phrasing closely (the discipline is well-tested
there) but generalized — drop any mention of `npm run test:run` /
`npm run build` in the prose; those land in the Verification
Checklist section as parameterized commands.

The issue templates' YAML must use the GitHub form-schema variant
(`name:` + `body:` with typed form elements), not the legacy
markdown-issue-template format. The form schema is what enforces
required fields server-side.

## Revisions

n/a — first draft.
