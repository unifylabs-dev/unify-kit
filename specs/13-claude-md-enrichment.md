# Spec 13 — Consumer CLAUDE.md Enrichment + Retro Template + Onboarding Ramp

> Status: Draft / awaiting review
> Depends on: 00 (vision + sourcing modes), 01 (filename canon), 02 (placeholder vocabulary + claude.md.template's 8-section shape), 06 (onboarding curriculum), 07 (philosophy + methodology canon), 08 (CHANGELOG discipline), 10 (SDD layer — referenced by claude.md.template's spec-discipline expansion), 11 (PR template referenced by claude.md.template's PR Merge Process), 12 (test-discipline layer)
> Related: closes the v0.2.x absorption-from-source-project arc; v1.0.0 follow-ups remain (CODE_OF_CONDUCT, SECURITY, branch protection).

## Purpose

Land the final wave of living-docs polish from the originating
gap-analysis plan: enrich the consumer `templates/claude.md.template`
with four practices from a real consumer project's CLAUDE.md (Living
Document Triggers, PR Merge Process, Branch Naming with `gh issue
develop`, Specification Discipline pointer); add a methodology-retro
template that supports the §G self-improving canon; expand
`templates/team-onboarding.md.template` with a 4-week onboarding ramp;
and surface branch-naming + post-/ship checklist conventions in
`templates/cheatsheet.md.template`.

This is the last spec in the v0.2.x absorption arc that started with
spec 10. After this lands, v1.0.0 follow-ups (`CODE_OF_CONDUCT.md`,
`SECURITY.md`, branch protection) are the remaining release-prep
items per `BACKLOG.md`.

## Why this exists

Specs 10 + 11 + 12 ship the structural pieces (durable specs +
GitHub scaffolding + test-discipline canon). Each is referenced by
canonical pointers — but the consumer's CLAUDE.md is what *threads*
those references into a daily working contract.

The source project's CLAUDE.md (423 lines) carries four sections that
materially shape the working contract: a "Living Document" trigger
table that specifies *when* to update CLAUDE.md (not just "keep it
current"), a non-negotiable PR Merge Process checklist that gates
the merge button, a Branch Naming section that wires `gh issue
develop <N>` into the canonical issue-to-branch flow, and a
Specification Discipline section that pulls the SDD rules into
hand's reach. unify-kit's current `claude.md.template` (90 lines)
has the 8-section minimal shape but doesn't carry these. Without
them, a consumer adopting the kit gets the *templates* for SDD/CI/
issues but not the *threading* that makes them a working contract.

The methodology-retro template supports the §G "self-improving
canon" rule — the source project ran one retro after its first
methodology trial (the same retro that surfaced the audit-logging
gap that became spec discipline rule 7). Future consumers should
have a retro template waiting.

The 4-week onboarding ramp absorbs the source project's `docs/
onboarding.md` ramp pattern (week 1 = setup + docs / week 2 =
`/work-issue` on a P3 issue with founder pair-review / week 3 = solo
P2 / week 4 = real backlog) into `templates/team-onboarding.md.template`,
filling out the Day-1/Week-1/Day-30 curriculum with concrete weekly
milestones beyond the kit's existing soft-milestone structure.

## What lands in this spec

Four artifacts (three template edits, one new template) plus the
standard cross-cutting README + CHANGELOG. No methodology canon
edits this round — claude.md.template is where the new content
lands; methodology.md §G's universal living-docs rule already
covers the principle.

### Batch A — `templates/claude.md.template` enrichment (D1)

Sourcing mode: `customization`.

The claude.md.template stays at **8 sections** per spec 02. New
content lands as named sub-sections inside existing sections, not
as new top-level sections. This avoids amending spec 02's
"8-section minimal shape" rule and keeps the consumer-facing shape
familiar.

#### A1. §3 Conventions — add "Branch Naming" sub-section

Adds a `### Branch Naming` block inside §3:

```markdown
### Branch Naming

`<type>/<issue-number>-<kebab-description>` where type is one of
`feature/`, `fix/`, `chore/`, `refactor/`. Created via:

    gh issue develop <N> --name <branch> --checkout --base main

The `gh issue develop` command is the canonical issue-to-branch
hop — it wires the new branch back to the GitHub issue
automatically, closing the issue when the resulting PR merges.
Example: `feature/83-staff-management`.
```

The `<type>` and `<N>` here are prose convention per spec 02
§"Common conventions" (`<...>` reads as "an integer issue number" /
"a slug type" in human English).

#### A2. §4 Issue-Driven Development — add "Specification Discipline" sub-section

Adds a `### Specification Discipline` block inside §4 with a
condensed reference to `docs/methodology.md` §B's seven hard rules:

```markdown
### Specification Discipline

`/work-issue` Phase 0 reads `docs/specs/` before any code work
begins. Hard rules (full discipline in `docs/methodology.md` §B):

- Every issue with non-trivial behavior change lists "Spec sections
  affected" in its body.
- Specs ship in the same PR as the code that implements them.
- Module specs 200–500 lines; journey specs 100–300 lines.
- Bug-fix-only PRs (drift fix, no behavior change) tick the "no
  spec changes needed" box in the PR template.

See `templates/specs/{module,journey,README}.md.template` for the
spec scaffolding.
```

#### A3. §7 Documentation Requirements — add "PR Merge Process" sub-section

Adds a `### PR Merge Process` block inside §7 (since it ends with
"post-merge documentation"). Generalized from the source project's
non-negotiable checklist:

```markdown
### PR Merge Process

Before merging any PR, complete this checklist:

1. Run the full test suite (`{{TEST_FULL_CMD}}`) — all tests pass.
2. Run the production build (`{{BUILD_CMD}}`) — no errors.
3. Feature verification: trace the code path for each test-plan
   item; confirm authorization / session / data-isolation checks
   are in place.
4. Merge: `gh pr merge <number> --merge` (or your team's policy).
5. Pull updated default branch locally.
6. Update the project's living-doc set per the §"Documentation
   Requirements" section above. Same commit if the PR didn't
   already cover them.

This checklist is non-negotiable — never merge without running
tests and build first. The PR template's Verification Checklist
mirrors items 1–3.
```

#### A4. §8 Living Document Rules — replace prose with trigger-action table

Replaces the existing one-paragraph §8 with the structured
trigger-action table that's load-bearing in the source project's
CLAUDE.md:

```markdown
## 8. Living Document Rules

CLAUDE.md is a self-improving reference. Update it when:

| Trigger | Action |
|---------|--------|
| New pattern established | Add to the relevant section. |
| Bug caused by missing knowledge | Add a gotcha to prevent recurrence. |
| New env var or public route added | Update Environment Variables or Middleware section (if your project carries those). |
| Feature shipped | Update Version Status table (if your project carries one). |
| Outdated info found | Remove or correct — stale docs are worse than none. |

Any session that ships a feature or fixes a bug SHOULD update
CLAUDE.md in the same commit if the change introduces a pattern,
convention, or gotcha not already documented. See `docs/
methodology.md` §G for the universal living-docs rule.
```

The trigger column generalizes — the source project's "New env var
or public route" and "Feature shipped" entries explicitly note that
these apply *if your project carries those sections*, since
neither is mandated by the kit's 8-section shape.

### Batch B — Methodology retro template (D3)

#### B1. `templates/methodology-retro.md.template`

Sourcing mode: `customization`.

A new template under `templates/` (not `templates/specs/` — retros
are working artifacts, not durable contracts). Frontmatter:

- `date: YYYY-MM-DD`
- `participants: []`
- `methodology_version: <kit-version-or-tag>`

Body sections:

1. **What worked** — practices that paid back; keep as-is.
2. **What we tuned** — practices we adjusted (with a one-line
   rationale per tuning).
3. **Known gaps** — practices we know are imperfect; tracked but
   not addressed in this retro.
4. **New rules adopted** — rules added to the project's CLAUDE.md
   or methodology pointer as a result of this retro.
5. **Action items** — concrete follow-ups (issue refs preferred).

Cross-references: `docs/methodology.md` §G "Living documents"
(retros are themselves living docs) + a pointer to running the
retro every 4–6 features after methodology adoption.

### Batch C — Cheatsheet additions (D2)

#### C1. `templates/cheatsheet.md.template` — branch-naming row + post-/ship-checklist row

Two short additions to the existing cheatsheet:

- **Branch naming** under a new `## Conventions` section (placed
  between `## Build / test / lint / typecheck` and `## Context
  thresholds`):

  ```markdown
  ## Conventions

  | Convention | Rule |
  |---|---|
  | Branch name | `<type>/<issue-number>-<kebab-description>` (type ∈ feature/fix/chore/refactor) |
  | Branch creation | `gh issue develop <N> --name <branch> --checkout --base main` |
  | Spec discipline | Specs ship in the same PR as code. See `docs/methodology.md` §B. |
  ```

- **Post-/ship checklist** appended to the existing `## Daily
  slash-commands` table's `/ship` row, updating the Notes column:

  > Wraps up an end-of-task flow. After ship, update the project's
  > living-doc set per `<consumer>/CLAUDE.md` §"Documentation
  > Requirements" — see `docs/methodology.md` §G.

No new placeholders introduced. The cheatsheet's body still fits
one US-letter page when rendered (verified post-edit).

### Batch D — Team-onboarding 4-week ramp (D5)

#### D1. `templates/team-onboarding.md.template` — add "4-week ramp" sub-section inside §3

Sourcing mode: `customization`.

Adds a new `### 4-week ramp` sub-section inside the existing §3
"Day 1 / Week 1 / Day 30" section, after the three curriculum-file
bullets. Avoids renumbering the existing §4 (Bootstrap) and §5
(Who to ask). Carries a 4-week ramp pattern absorbed from the
source project's `docs/onboarding.md`:

- **Week 1 — Environment + docs.** Run the bootstrap script.
  Required reading per the curriculum (kit's `onboarding/day-1.md`
  + `docs/methodology.md` + the consumer's CLAUDE.md +
  architecture). One trivial PR opened for the day-1 hard gate.
- **Week 2 — `/work-issue` on a P3 issue, paired.** Pick a
  low-stakes P3 issue. Run `/work-issue <N>` end-to-end with
  founder/lead pair-review on each phase. Goal: feel the 8-phase
  flow without solo accountability for the AC interpretation.
- **Week 3 — Solo on a P2 issue.** Pick a P2 issue. Run
  `/work-issue <N>` solo through PR creation. Pair-review only on
  the open PR.
- **Week 4 — Real backlog.** Pick from the actual backlog. Solo
  through merge.

This is *guidance, not gates* — Week 4 doesn't auto-trigger
production access; it's a soft milestone. The kit's `onboarding/
day-30.md` already establishes the soft-milestone pattern; this
section gives Week 1–4 concrete shape.

### Batch E — Cross-cutting

- **`templates/README.md`** — table-row entry for
  `methodology-retro.md.template`. No new placeholders.
- **`CHANGELOG.md`** `[Unreleased]` — Added bullets for the retro
  template + onboarding ramp; Changed bullets for the
  claude.md.template enrichment + cheatsheet additions.

## What does NOT land in this spec

- **`templates/claude-config/phases-INDEX.md.template`** (D4 in
  the originating gap-analysis plan). Verifying whether the
  `phasing` skill at `~/.claude/skills/phasing` already manages a
  per-project phases index turned out to be an unbounded
  exploration (skill internals + state files); deferring until a
  consumer hits a real need or until the phasing skill is more
  fully documented. Tracked in BACKLOG.md.
- **A new top-level §9 or §10 in `claude.md.template`.** Spec 02
  defines an 8-section minimal shape; this spec keeps that
  invariant by absorbing new content into existing sections as
  named `###` sub-sections.
- **New vocabulary placeholders.** Considered: `{{LIVING_DOCS_LIST}}`
  for the cheatsheet's post-/ship checklist row. Rejected: the row
  points to the consumer's CLAUDE.md §"Documentation Requirements"
  for the actual list, avoiding vocabulary expansion. Vocabulary
  stays at 18.
- **Bootstrap installer extension** to copy the new templates.
  Same v1.0.0 deferral as prior specs. Manual `cp` per
  `templates/README.md`.
- **Restructuring `templates/team-onboarding.md.template`'s 5-section
  shape.** Per Decision #4, the 4-week ramp lands as a `###` sub-section
  inside §3, *not* as a new top-level section. The 5-section shape
  stays — no renumbering, no spec 02 amendment needed. (Spec 02
  doesn't pin team-onboarding's section count anyway; only
  claude.md.template's 8-section shape is tracked there.)
- **Backporting the trigger-action table to `docs/methodology.md`
  §G.** §G states the universal living-docs rule and lists the
  example doc-set; the trigger-action table is consumer-side
  (per-project triggers like "feature shipped" are project-shape
  decisions, not canon). Keeping the table in claude.md.template,
  not methodology.md.

## Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | claude.md.template — 8 sections or grow to 10? | **Stay at 8.** Absorb new content as `###` sub-sections inside existing top-level §3, §4, §7, §8. Avoids amending spec 02's "8-section minimal shape" rule and keeps the section count familiar to consumers reading the kit's docs. |
| 2 | Methodology retro template — `templates/` or `templates/specs/`? | **`templates/`.** Retros are working/ephemeral artifacts (one per retrospective event), not durable behavioral contracts. `templates/specs/` is reserved for durable specs. Naming follows the convention of `methodology-retro.md.template`. |
| 3 | New `{{LIVING_DOCS_LIST}}` placeholder for the cheatsheet? | **No.** The cheatsheet pointer references the consumer's CLAUDE.md §"Documentation Requirements" for the actual list, avoiding vocabulary expansion. Vocabulary stays at 18. |
| 4 | Onboarding ramp — Option α (update team-onboarding template) or Option β (extend kit's `onboarding/week-1.md`)? | **Option α.** The kit's `onboarding/` curriculum is the *kit's* meta-curriculum (how to use unify-kit). The 4-week ramp is the *consumer's* per-project onboarding. Right home is `templates/team-onboarding.md.template` (the consumer's onboarding stitcher). |
| 5 | Phases INDEX template (D4 in originating plan) | **Defer to v1.0.0+.** Verifying phasing-skill internals is unbounded; defer until a consumer hits a real need or until the phasing skill is documented. Tracked in BACKLOG. |
| 6 | Where in claude.md.template does each new sub-section land? | A1 Branch Naming → §3 Conventions. A2 Spec Discipline → §4 Issue-Driven Development. A3 PR Merge Process → §7 Documentation Requirements. A4 trigger-action table → §8 Living Document Rules (replaces existing prose). |

## Out of scope

- A retro process script that scaffolds new retros from the
  template (renaming, frontmatter dating, etc.). Templates are
  copy-and-fill artifacts; scripting is over-engineering.
- A "first-month retrospective" template variant. The single
  retro template generalizes; date frontmatter handles temporal
  scope.
- Refactoring `docs/methodology.md` §G to add a sub-section on
  retros. §G states the universal rule; project-shape decisions
  (which docs, which retro cadence) stay consumer-side per the
  same logic that keeps the doc-set list per-project.
- Auto-detection of post-/ship doc updates (linting `git diff`
  against the consumer's documentation-requirements list). Out of
  scope; could land in a later spec under a "ship-discipline"
  workflow.

## Acceptance criteria

This spec's PR is acceptable when all of the following are
demonstrably true:

- **A1 — Branch Naming sub-section in §3.** `templates/claude.md.template`
  §3 Conventions contains a `### Branch Naming` sub-section with
  the canonical format string + the `gh issue develop` invocation.
- **A2 — Specification Discipline sub-section in §4.**
  `templates/claude.md.template` §4 contains a
  `### Specification Discipline` sub-section with a condensed
  reference to `docs/methodology.md` §B's hard rules and a pointer
  to `templates/specs/`.
- **A3 — PR Merge Process sub-section in §7.**
  `templates/claude.md.template` §7 contains a
  `### PR Merge Process` sub-section with the 6-step non-negotiable
  checklist parameterized by `{{TEST_FULL_CMD}}` and `{{BUILD_CMD}}`.
- **A4 — Living Document trigger-action table in §8.**
  `templates/claude.md.template` §8 has the prose-paragraph form
  replaced by the trigger-action table (5 rows minimum) +
  same-commit update guidance.
- **B1 — Methodology retro template exists.**
  `templates/methodology-retro.md.template` declares `customization`
  sourcing mode in its HTML comment header, has frontmatter
  (`date`, `participants`, `methodology_version`), and contains the
  5 named body sections (What worked / What we tuned / Known gaps
  / New rules adopted / Action items).
- **C1 — Cheatsheet `## Conventions` section.**
  `templates/cheatsheet.md.template` has a new `## Conventions`
  section (table form) between Build/test and Context thresholds,
  carrying branch-name format + `gh issue develop` invocation +
  spec-discipline pointer.
- **C2 — Cheatsheet `/ship` row updated.**
  `templates/cheatsheet.md.template`'s `/ship` row in the Daily
  slash-commands table mentions the post-/ship doc-set update with
  a pointer to consumer CLAUDE.md §"Documentation Requirements"
  and `docs/methodology.md` §G.
- **D1 — Team-onboarding 4-week ramp.**
  `templates/team-onboarding.md.template` §3 "Day 1 / Week 1 /
  Day 30" gains a `### 4-week ramp` sub-section after the three
  curriculum bullets, carrying the 4-week ramp pattern (Week 1
  environment+docs / Week 2 paired `/work-issue` on a P3 issue /
  Week 3 solo P2 / Week 4 real backlog). Existing §4 (Bootstrap)
  and §5 (Who to ask) renumber unchanged.
- **E1 — `templates/README.md` row.** Template-table row added for
  `methodology-retro.md.template`. No new placeholders.
- **Mechanical placeholder check.** `scrub-check.yml`'s
  placeholder-vocab job passes — every `{{...}}` in the changed
  templates is in the existing 18-placeholder vocabulary; no
  vocabulary expansion this round.
- **Forbidden-strings check.** `scrub-check.yml`'s forbidden-strings
  job passes — no domain-specific strings (e.g., "staff portal",
  PHIPA-flavored prose, project-specific role names beyond
  generic VIEWER/STAFF/ADMIN if they appear at all) leak into the
  new content.
- **Cheatsheet one-page constraint.** The cheatsheet template's
  body (excluding Appendix A) still fits one US-letter page when
  rendered at 12pt. Manual eye-check; the existing acceptance
  criterion in spec 02 §"Acceptance criteria" still applies.
- **Lint-clean.** `lint.yml` passes: shellcheck unchanged
  (no new bash), actionlint unchanged (no new YAML), markdownlint
  clean on the changed templates and methodology, lychee clean.
- **CHANGELOG entry.** `[Unreleased]` carries Added bullets for
  the retro template + onboarding-ramp section; Changed bullets
  for the claude.md.template enrichment + cheatsheet additions +
  README row.

## Post-merge validation

Not gated by CI. Carried out by the maintainer after the
implementing PR merges:

- **End-to-end consumer dry-run.** Bootstrap a fresh project from
  unify-kit's complete v0.2.x state. Confirm: the consumer's
  filled-in CLAUDE.md (post-substitution) reads as a coherent
  working contract; the cheatsheet fits one page; the
  team-onboarding stitcher's 4-week ramp is actionable.
- **Retro template smoke test.** Pretend to run a retro using the
  template — fill in a synthetic retro for a hypothetical first
  month of methodology adoption. Confirm: the 5 sections are
  enough; nothing essential is missing; nothing redundant could
  be cut.

## Implementation notes (non-binding)

The implementing PR (separate branch, `templates/living-docs-polish`
or similar) should land all four artifacts plus README + CHANGELOG
atomically in one PR. No new bash or YAML, so the only CI
considerations are markdownlint + lychee + scrub-check +
changelog-check.

The claude.md.template's 8 → 8 (with sub-sections) preservation is
the load-bearing structural decision. Sub-section additions should
match the existing kit voice (terse, second-person, with concrete
examples) — reviewer checks during PR review.

The cheatsheet's one-page constraint is the only soft gate that
survives across edits. After this spec lands, the body is at risk
of overflowing; if it does, the implementing PR moves the
Conventions table to the `## Appendix A` slot (the only spillable
section per spec 02), or trims one of the existing rows.

## Revisions

n/a — first draft.
