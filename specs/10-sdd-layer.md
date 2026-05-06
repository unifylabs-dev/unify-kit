# Spec 10 — Specification-Driven Development (SDD) Layer

> Status: Draft / awaiting review
> Depends on: 00 (vision + sourcing modes + glossary), 01 (filename canon), 02 (placeholder vocabulary), 07 (philosophy + methodology canon), 08 (CHANGELOG discipline + ADR format), 09 (kit's own CI)
> Related: 06 (onboarding curriculum), forthcoming spec 11 (GitHub repo scaffolding consumes spec paths from this spec), 13 (consumer CLAUDE.md enrichment references this layer)

## Purpose

Add a **Specification-Driven Development (SDD) layer** to the kit: durable
markdown specs that document *behavior* (not implementation) and serve as the
contract between issues and code. The layer comprises (a) two new templates for
consumer use (module spec + journey spec), (b) a methodology rewrite that
positions SDD alongside TDD as a core discipline, (c) a stack-agnostic snippet
for BDD-Lite e2e test naming, and (d) two new placeholders in the vocabulary.

This spec lands the *kit-side* surface area. Consumer-side rollout is
documented in the methodology rewrite (lazy-bootstrap rule) and the
forthcoming spec 11 (GitHub PR/issue templates that reference spec paths).

## Why this exists

The kit's current methodology canon (`docs/methodology.md` v0.1) lists TDD,
issue-driven dev, phasing, verification, and living-docs discipline — but
treats *what specs are* and *how they relate to issues* as out of scope.
Consumers reading the canon today cannot infer the contributor's full
workflow: the spec-as-contract layer (durable behavior docs that issues
amend, never replace) is missing.

A real working project (the optometry boutique staff portal that runs on the
same author's machine) has matured this layer over several months and one
formal retro: durable module + journey specs, mandatory PR/issue templates
that gate `/work-issue` Phase 0, and the seven specification-discipline hard
rules. The retro also surfaced a known failure mode (early PR review missing
spec-compliance issues) and the rule that resolved it (Rule 7: review-driven
spec changes ship in the same PR as the code change).

The kit absorbs this layer now, before its next consumer adoption, so the
contract is explicit and the templates exist.

## What lands in this spec

Six artifacts, grouped into three batches.

### Batch A — Templates (consumer-facing)

#### A1. `templates/specs/module.md.template`

Sourcing mode: `customization`.

Stack-agnostic version of the optometry project's module-spec template.
Frontmatter shape: `name`, `type: module`, `last_reviewed: YYYY-MM-DD`,
`related_issues: []`, `related_journeys: []`, `code_anchors: [...]`. Body
sections (in order): Purpose / Behavior / Data Model / Permissions / Edge
Cases & Constraints / Compliance Notes / Integration Points / Open Questions
& Known Limitations / Changelog. Uses `{{DATA_MODEL_PATH}}` placeholder where
the source template named a Prisma schema directly.

The template carries the duplicate-this-file checklist as an HTML comment at
the top of the file (rename, set `type: module`, set `last_reviewed`, fill
`related_issues` + `related_journeys`, replace `code_anchors`, register in
the spec README, target 200–500 lines).

#### A2. `templates/specs/journey.md.template`

Sourcing mode: `customization`.

Stack-agnostic version of the journey-spec template. Frontmatter adds
`tier: 1` (or `2`), `verifying_e2e_test: <path>`, and `related_modules: []`.
Body sections: Purpose / Verifying e2e test / Steps (numbered Given/When/Then)
/ Modules touched / Edge Cases & Constraints / Open Questions / Changelog.
Uses `{{TEST_E2E_DIR}}` placeholder where the source named an e2e/suites/
path directly.

The template explicitly states the 1:1 rule between numbered Steps and
`test()` cases under a `Journey: <slug>` describe block (see A4 below).

#### A3. `templates/specs/README.md.template`

Sourcing mode: `customization`.

Index file for `<consumer>/docs/specs/`. Two tables (Module specs + Journey
specs), each row showing name + tier (journey only) + last_reviewed + status
+ link. Pointer to `<consumer>/docs/methodology.md` for the methodology
canon. The template instructs the consumer to add a row for each new spec
they create (the same instruction is in the duplicate-this-file checklists
in A1 and A2).

### Batch B — Methodology canon rewrite

#### A4. `docs/methodology.md` — new §B "Specification-Driven Development"

Inserted before the existing TDD section; the existing §B–I renumber to §C–J.

The new §B carries the durable-spec layer's mental model (three layers: SDD
+ BDD-Lite + TDD), the vocabulary (spec / module spec / journey spec / drift
fix / behavior change / lazy bootstrap), the seven specification-discipline
hard rules (condensed, generalized, no PHIPA examples), the bug-fix decision
tree (drift fix vs behavior change with two stack-agnostic worked examples),
the lazy-bootstrap rule (Tier 1 / Tier 2 designation with a 3-criterion
rubric), and the BDD-Lite naming convention (Journey describe block +
Given/When/Then test names + scope rule).

Cross-references added:
- §C (Issue-driven dev, formerly §C) gains a one-line note that `/work-issue`
  Phase 0 enforces Spec Sync against the durable specs.
- §F (Living documents on every ship, formerly §F) gains a note that *specs*
  are the highest-priority living doc — drift in a spec teaches the wrong
  thing on the next read.
- §H (Multi-agent review, formerly §H) gains a note that PR review challenges
  drift-fix claims when the spec doesn't actually document the behavior.

Sourcing mode: `pattern-only`. Prose authored; structure inspired by the
optometry-project methodology document, no expression lifted.

#### A5. `docs/methodology.md` — `/work-issue` 8-phase contract documented

§C (Issue-driven dev) is expanded from one paragraph to a sub-sectioned
breakdown of all nine phases (Phase 0 — Spec Sync — through Phase 7 — PR).
The skill at `~/.claude/skills/work-issue` remains the executable contract;
the canon documents the *contract the consumer can rely on*: which gates are
mandatory, what each phase produces, and which artifacts (specs, branch
worktree, plan file, ACs) flow between phases.

The cheatsheet's `/work-issue` row (`templates/cheatsheet.md.template`) is
updated to mention Phase 0 explicitly.

### Batch C — Snippet + vocabulary additions

#### A6. `templates/snippets/bdd-lite-test-naming.md`

Sourcing mode: `customization`. Stack-leaning toward Playwright since that
is the canonical e2e tool referenced in the methodology, but the convention
itself (Journey describe + Given/When/Then test names + scope rule for new
tests only) is portable to any test runner that supports nested describe
blocks.

A single fenced-code example showing a `Journey: <slug>` describe block with
three Given/When/Then test cases. Below the example, a short rules block:
top-level describe = `Journey: <slug>` matching the journey-spec filename;
each `test()` body uses Given/When/Then sentence; 1:1 mapping to journey
spec Steps; `@daily` tag for at least one test per Tier-1 journey;
convention applies only to NEW tests.

The snippet's HTML comment header cites the methodology §B BDD-Lite
sub-section as the canonical source for the rule-set; the snippet is the
copy-paste fragment.

#### Vocabulary additions

Two new placeholders enter the supported vocabulary defined in spec 02 and
enforced by `.github/workflows/scrub-check.yml`:

| Placeholder | Meaning |
|---|---|
| `{{DATA_MODEL_PATH}}` | Path to the project's data-model source of truth (e.g., `prisma/schema.prisma`, `db/schema.rb`, `migrations/`). Used in `templates/specs/module.md.template`'s Data Model section. |
| `{{TEST_E2E_DIR}}` | Directory where end-to-end tests live (e.g., `e2e/suites/`, `tests/e2e/`, `cypress/integration/`). Used in `templates/specs/journey.md.template`'s `verifying_e2e_test` frontmatter and Verifying e2e test section. |

Both are landed in the same PR as the templates that use them so the
placeholder-vocab CI job stays green (every supported placeholder must
appear in ≥1 template, every used placeholder must be supported).

`templates/README.md` placeholder table grows from 16 to 18 rows.

`specs/02-templates.md` §"Common conventions" placeholder list grows from 16
to 18 entries (this spec's revisions footer flags the deferred update; the
PR landing this spec includes it).

## What does NOT land in this spec

These are deliberately excluded — either because they live in a sibling
upcoming spec, or because they remain bespoke to the source project:

- **GitHub PR template, issue templates, or any `.github/` scaffolding.**
  Lands in spec 11.
- **CI workflow templates for consumers (PR-fast / nightly / daily-E2E).**
  Lands in spec 12.
- **`templates/claude.md.template` enrichment** (Living-Doc Triggers, PR
  Merge Process, Branch Naming, Spec Discipline section). Lands in spec 13.
- **`templates/methodology-retro.md.template`.** Lands in spec 13.
- **A canon rule mandating audit logging for mutating actions.** Stays
  snippet-only (`templates/snippets/audit-logging-nextjs.md`); the kit's
  stack-agnostic posture does not impose compliance constraints. Decision
  resolved at planning time (2026-05-06) per the open-question table that
  framed this spec; recorded again in §"Decisions" #6 below.
- **Bootstrap-installer extension for repo-side templates.** Defers to v1.0.0
  per the same plan-resolution. `bootstrap-claude-config.sh`'s contract
  stays focused on `~/.claude/` only.
- **The 18-module / 15-journey list itself.** That is a per-project artifact.
  The kit ships *templates* and the *lazy-bootstrap rule*; the consumer
  fills in their own list.
- **PHIPA / PIPEDA / CASL compliance language** and **the 17-action audit
  enum**. Bespoke to the source project's healthcare-compliance domain;
  consumer-side concern.

## Decisions

All open SDD-level decisions resolved as defaults at planning time
(`/Users/tomerkurman/.claude/plans/can-you-review-optics-management-abundant-tulip.md`,
§"Decisions taken", resolved 2026-05-06):

| # | Decision | Resolution |
|---|---|---|
| 1 | Spec template layout | Subdirectory `templates/specs/` (matches consumer's `docs/specs/` shape; sets up future spec-related templates). Rejected: flat `spec-module.md.template` at templates/ root. |
| 2 | Lazy-bootstrap rule canon vs separate template | Canon-only. Methodology §B includes the 3-criterion Tier-1 rubric; no `templates/specs/adoption-roadmap.md.template`. Consumers list their own Tier-1/Tier-2 picks in their CLAUDE.md or spec README. |
| 3 | BDD-Lite snippet placement | `templates/snippets/`. Snippet-style for opt-in copy. Canon section in §B documents the rules; snippet is the fragment. |
| 4 | Sourcing mode for the methodology rewrite | `pattern-only`. Structure inspired by the source project's `docs/methodology.md`; no prose lifted. The seven specification-discipline rules are condensed and generalized. |
| 5 | Renumber existing methodology sections vs add §B' inline | Renumber: existing §B–I become §C–J; new SDD section claims §B. The renumber is a one-time cost; inline §B' would persist as a structural oddity. |
| 6 | Audit-logging canon rule | **Not adopted.** Stays in `templates/snippets/audit-logging-nextjs.md` as opt-in. Methodology canon does not mandate audit logging. |

## Out of scope

- A `templates/specs/adoption-roadmap.md.template` for consumers to fill in
  Tier-1/Tier-2 picks. Considered and rejected (Decision #2 above) — small
  added value vs. consumer simply listing modules in their CLAUDE.md.
- A `methodology-faq.md` sidebar containing the source project's FAQs.
  Considered and rejected — the FAQs that survive generalization (Why no
  Cucumber? / Module vs journey? / Drift fix vs behavior change?) are
  absorbed into §B's prose; standalone FAQ doc would invite drift.
- An ADR documenting "we adopted SDD." The methodology canon is the durable
  record; ADRs document narrow decisions, not whole methodology adoptions.
  An ADR may follow if the methodology evolves in a contested way (e.g., a
  later decision to require Cucumber would warrant one).
- Multi-stack snippet flavors of `bdd-lite-test-naming.md` (Cypress, Vitest,
  Jest, Mocha). Deferred until at least one consumer asks; the Playwright
  example is generalizable enough that a careful reader can adapt it.
- Changes to onboarding curriculum (`onboarding/day-1.md`, etc.). Spec
  discipline appears in week-1 reading per the existing curriculum's
  reading-order; no curriculum file edits required for this spec.

## Acceptance criteria

This spec's PR is acceptable when all of the following are demonstrably true:

- **A1 — Module spec template exists.** `templates/specs/module.md.template`
  renders as valid markdown, declares `customization` sourcing mode in its
  HTML comment header, uses only supported placeholders (`{{DATA_MODEL_PATH}}`
  and any others from the vocabulary), and contains the 9 named body
  sections in order.
- **A2 — Journey spec template exists.** `templates/specs/journey.md.template`
  renders as valid markdown, has frontmatter shape including `tier:`,
  `verifying_e2e_test:`, `related_modules:`, uses only supported placeholders
  (`{{TEST_E2E_DIR}}` and any others), and contains the 7 named body sections.
- **A3 — Specs README template exists.** `templates/specs/README.md.template`
  has two named tables (Module specs / Journey specs) and a methodology
  pointer.
- **A4 — Methodology §B SDD section is in `docs/methodology.md`.** The
  document's table of contents lists §B as "Specification-Driven
  Development" with sub-sections covering: three-layer mental model,
  vocabulary, seven hard rules, bug-fix decision tree, lazy-bootstrap rule,
  BDD-Lite naming. The previously §B–I sections renumber consistently to
  §C–J. No section header is left orphaned.
- **A5 — `/work-issue` 8-phase contract is canonized.** Methodology §C
  (formerly §C, now expanded) contains a sub-section per phase 0 through 7.
  The cheatsheet template's `/work-issue` row mentions Phase 0.
- **A6 — BDD-Lite snippet exists.** `templates/snippets/bdd-lite-test-naming.md`
  contains a fenced-code Playwright example with a `Journey: <slug>` describe
  block plus the rules block. Snippet header cites methodology §B as
  canonical source.
- **Vocabulary additions.** `specs/02-templates.md` §"Common conventions"
  placeholder list contains `{{DATA_MODEL_PATH}}` and `{{TEST_E2E_DIR}}`.
  `templates/README.md` placeholder table contains both with their meanings.
  `.github/workflows/scrub-check.yml`'s `SUPPORTED` set contains both.
- **Mechanical placeholder check.** `scrub-check.yml`'s placeholder-vocab
  job passes against the new templates: every `{{...}}` token in
  `templates/specs/*.template` is in the supported vocabulary; every newly-
  added supported placeholder appears in ≥1 template.
- **Forbidden-strings check.** `scrub-check.yml`'s forbidden-strings job
  passes: no `optics-management`, `optics_boutique`, `mvo_*`, `Mint Vision`,
  or PHIPA-flavored prose leaks into shipped artifacts (templates/, hooks/,
  github-actions/, scripts/, README.md, CHANGELOG.md, CONTRIBUTING.md,
  llms.txt, docs/philosophy.md, docs/methodology.md). Discussion of these
  patterns is allowed in this spec file (specs/ is exempt).
- **Lint-clean.** `lint.yml` passes: actionlint clean (no workflow changes
  here, but vocab update is in scrub-check.yml), markdownlint clean on the
  new templates and methodology file, lychee internal-link check clean for
  any new cross-references.
- **CHANGELOG entry.** `## [Unreleased]` in `CHANGELOG.md` carries one
  bullet under `### Added` (templates + methodology section + snippet) and
  one under `### Changed` (vocabulary expansion); per spec 08 §6
  CHANGELOG-discipline rules and per `changelog-check.yml`.
- **End-to-end smoke test (manual).** Take a real issue from the
  consumer's project backlog and produce a stub spec using the new
  `templates/specs/module.md.template`. Confirm: file copies cleanly into a
  consumer's `docs/specs/modules/`, frontmatter parses (manual eye-check),
  `markdownlint` passes, `{{DATA_MODEL_PATH}}` substitutes to the consumer's
  actual schema path. This is post-merge validation; not gated by CI.

## Implementation notes (non-binding guidance for the implementing PR)

The implementing PR (separate branch, `templates/specs-and-canon` or similar)
should land all six artifacts in **one PR** rather than splitting across
several. Reasons:

- The methodology rewrite (A4) and the templates (A1–A3) reference each
  other — landing one without the other leaves dangling pointers.
- `scrub-check.yml`'s placeholder-vocab job is atomic across `templates/`:
  it would fail mid-merge if `{{DATA_MODEL_PATH}}` were declared in
  `SUPPORTED` but the template using it hadn't landed yet (or vice versa).
  Atomic landing avoids the half-state.
- The CHANGELOG entry is one logical entry per the methodology, not six.

The implementing PR's commit shape is at the implementer's discretion:
either one commit that lands everything together, or commit-per-batch (A
templates / A4-A5 canon / A6 snippet + vocab) with the final commit being
the CHANGELOG update. CI runs against the final tree, not per-commit.

The implementing PR is **not** the place to start iterating on which exact
words go in §B. That belongs in this spec PR's review. By the time the
implementing PR opens, the methodology section's structure (sub-section
headings, vocabulary terms, decision tree shape) is locked.

## Revisions

n/a — first draft.

This spec is the first new spec added to `unify-kit` post-v0.1.3 and the
first to absorb practice from a real consumer project. Future revisions
captured here.
