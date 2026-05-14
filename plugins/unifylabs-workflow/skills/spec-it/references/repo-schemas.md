# Repo schemas — reference data for Phase 0 detection

`/spec-it` adapts at runtime to the target repo's spec conventions. Phase 0 builds a `repo_schema` object by detecting which of the documented styles is in use. This file is the catalog of known styles.

The skill prefers reading the repo's actual `_template.md` files over consulting this catalog — but when templates are missing or ambiguous, this reference fills the gap and provides bootstrap content.

---

## optics-style (behavioral, dual-axis)

**Signal:** `docs/specs/modules/` AND `docs/specs/journeys/` both exist as directories.

**Origin:** `unifylabs-dev/optics-management` (Next.js + Postgres staff portal).

**Structure:**
- `docs/specs/README.md` — index of modules + journeys with last-reviewed dates
- `docs/specs/modules/<name>.md` — one file per module (auth, orders, inventory, …). 200–500 lines.
- `docs/specs/modules/_template.md` — template with `type: template` frontmatter
- `docs/specs/journeys/<slug>.md` — one file per cross-module user flow. 100–300 lines.
- `docs/specs/journeys/_template.md` — template

**Module frontmatter:**
```yaml
---
name: <module-name>
type: module
last_reviewed: YYYY-MM-DD
related_issues: []
related_journeys: []
code_anchors:
  - src/lib/actions/<file>.ts
  - src/lib/validations/<file>.ts
  - src/app/<route>/page.tsx
---
```

**Module sections (in order):**
1. `# <Module Name>`
2. `## Purpose` — 1–3 sentences. Why this module exists.
3. `## Behavior` — numbered list of `"When <trigger>, the system <effect>."` statements. Longest section (50–250 lines). Sub-headings allowed (`### State transitions`, `### Validation rules`) when >30 bullets.
4. `## Data Model` — entities + relationships. Link to `prisma/schema.prisma`; never copy.
5. `## Permissions` — per-role matrix table (VIEWER / STAFF / ADMIN / client).
6. `## Edge Cases & Constraints` — `"When <unusual condition>, then <how>."` Format.
7. `## Compliance Notes` — PHIPA/PIPEDA-relevant audit + retention. If no PHI: `"No PHI or PII handled — no compliance constraints apply."`
8. `## Integration Points` — what reads/writes this module; cron triggers; notifications emitted.
9. `## Open Questions / Known Limitations`
10. `## Changelog` — terse one-line-per-change with PR link.

**Journey frontmatter:**
```yaml
---
name: <journey-slug>
type: journey
tier: 1
last_reviewed: YYYY-MM-DD
related_issues: []
related_modules: []
verifying_e2e_test: e2e/suites/<file>.spec.ts
code_anchors:
  - e2e/suites/<file>.spec.ts
  - src/app/<route>/page.tsx
---
```

**Journey sections:**
1. `# <Journey Name>`
2. `## Purpose` — what user-recognizable flow this describes
3. `## Verifying e2e test` — markdown link to the Playwright spec; brief description of coverage vs. underlying module unit tests
4. `## Steps` — numbered Given/When/Then list. Each step maps 1:1 to a `test()` case under a `Journey: <slug>` describe block.
5. `## Modules touched` — links to module specs; one-line role per module.
6. `## Edge Cases & Constraints` — cross-module edge cases.
7. `## Open Questions / Known Limitations`
8. `## Changelog`

**Hard rules in this style:**
- Specs describe **behavior**, not implementation. No quoted Zod schemas or function signatures. Link via `code_anchors`.
- Specs ship in the **same PR** as the code that implements them. Never separate PRs.
- Module specs: 200–500 lines. Journey specs: 100–300 lines. Over = documenting implementation.
- Drift fixes don't update specs. Behavior changes do. `/work-issue` Phase 0 forces the choice.
- New `@daily` e2e tests use Given/When/Then naming and live under a `Journey: <slug>` describe block.

**Methodology pointer:** `docs/methodology.md`

**Issue template pointer:** `.github/ISSUE_TEMPLATE/feature_request.yml` (required field: "Spec sections affected")

---

## unify-kit-style (numbered, structural, pre-implementation)

**Signal:** `specs/NN-*.md` (zero-padded numeric prefix) at repo root.

**Origin:** `unifylabs-dev/unify-kit` (starter kit for Claude Code workflow).

**Structure:**
- `specs/README.md` — numbered index, "decisions resolved" table
- `specs/00-vision-and-license.md` through `specs/NN-<topic>.md` — one file per component being built
- No `_template.md` (the README documents the shape)

**Spec sections (per `specs/README.md`):**
```
# Spec NN — Title

> Status: Draft / awaiting review
> Depends on: <list of prerequisite specs>
> Related: <other relevant specs>

## Purpose
## Sourcing mode (where applicable)
## ... per-spec content sections ...
## Decisions needed
## Out of scope
## Acceptance criteria
## Revisions
```

**Hard rules in this style:**
- Pre-implementation: specs land on master BEFORE code. Code follows in `/phase` runs.
- Drafts are short — reviewable in a single pass; implementation detail lives in the implementations themselves once specs are approved.
- Revisions land via in-place edits with a `Revisions` footer citing addressed finding IDs (`R-NNN`).
- Sourcing modes (when external content is being lifted): `verbatim` / `verbatim-with-light-edit` / `customization` / `pattern-only`.

**`/spec-it` adaptation when inside unify-kit (`is_kit_repo == true`):**
- Phase 9 does NOT file an issue; it creates a `spec/<slug>` branch, writes `specs/NN-<topic>.md`, commits, opens a PR
- "NN" is the next available number after scanning existing `specs/NN-*.md` files
- The PR description includes the same fields a `/work-issue`-ready issue would have (ACs, design notes, research notes)

---

## adr-style (one decision per file, lightweight)

**Signal:** `docs/adr/` or `docs/decisions/` exists with `NNNN-<topic>.md` files.

**Origin:** Many open-source projects. See [adr.github.io](https://adr.github.io/) for the broader pattern.

**Recommended lightweight shape (per Michael Nygard's original ADR format):**
```
# NNNN. <Decision title>

Date: YYYY-MM-DD

## Status

Proposed | Accepted | Deprecated | Superseded by [NNNN](NNNN-...md)

## Context

The issue motivating this decision, and any context that influences or constrains it.

## Decision

The change we're proposing or have agreed to implement.

## Consequences

What becomes easier or more difficult because of this change.
```

Length target: 50–150 lines.

**`/spec-it` adaptation:** ADRs are often non-code deliverables (decision records). The skill produces an ADR file embedded in the issue body, then `/work-issue` writes it to `docs/adr/` as the first commit.

---

## none (no spec convention detected)

**Signal:** None of the above directories exist; no `_template.md` files found.

**`/spec-it` adaptation:**

1. Phase 6 offers to bootstrap. Options:
   - Adopt optics-style (modules + journeys) — useful for app projects
   - Adopt unify-kit-style (numbered specs) — useful for component/kit projects
   - Adopt adr-style (decision records) — useful for projects that document decisions but not behavior
   - Skip — just file an issue without a spec; `/work-issue` Phase 0 will treat as "None — no spec needed"

2. If user adopts a style, the skill:
   - Creates the target directory (`docs/specs/modules/` + `docs/specs/journeys/`, or `specs/`, or `docs/adr/`)
   - Copies the matching `_template.md` from `assets/spec-templates/` into the target dir
   - Adds a `README.md` to the spec dir (copying the structure from unify-kit's `specs/README.md` or optics' `docs/specs/README.md`)
   - Continues with the normal Phase 6 draft using the newly-adopted style

3. Bootstrap is a **separate commit** from the spec draft itself — clean history.

---

## Issue-template detection

Independent of spec style, Phase 0 also reads `.github/ISSUE_TEMPLATE/*.yml`:

- **Required fields** — populate every field marked `validations.required: true`. The issue body must not be missing any required field, or `/work-issue` Phase 1 will reject the issue.
- **Spec impact field** — many template files have a `"Spec sections affected"` (or similar) field. This is the single most important field — it drives `/work-issue` Phase 0's spec sync.
- **Field IDs** — when posting via `gh issue create --body-file`, the body must use the field labels as section headings (`## <Field label>`) so the rendered issue matches the template's structure.

If `.github/ISSUE_TEMPLATE/` is missing entirely:
- `/spec-it` uses `assets/issue-templates/<type>.md` directly
- Surfaces a propagation hint: "This repo has no issue templates. Want to propose adding them via unify-kit?"
