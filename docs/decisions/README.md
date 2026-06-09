<!--
docs/decisions/README.md
Format: lightweight ADR per specs/08-living-docs-and-decision-log.md §2.
This README is net-new (no upstream pattern); the format itself comes from spec 08.
License: CC BY-SA 4.0 (narrative docs ship CC BY-SA 4.0 per specs/00-vision-and-license.md §"License")
Authored: 2026-05-04
-->

# Architecture Decision Records (ADRs)

## Overview

ADRs are one-decision-per-file Markdown documents that capture the *why* behind a non-trivial choice the kit has made. The format is **lightweight** per `specs/08-living-docs-and-decision-log.md` §2 — seven fields, no boilerplate, immutable once accepted.

## Format

Every ADR lives at `docs/decisions/NNNN-<lowercase-hyphenated-slug>.md` and follows this template:

```markdown
# NNNN — <Decision title>

- Status: accepted | superseded | deprecated
- Date: YYYY-MM-DD
- Decision: <one paragraph stating what was decided>
- Context: <what motivated this — the constraint, the trade-off, the conflict>
- Consequences: <what changes because of this; downstream effects>
- Alternatives considered: <bullets — each with the reason for rejection>
- Supersedes / superseded by: <link if applicable, otherwise "none">
```

ADRs are immutable history. When a decision is reversed, the new ADR cites the old one in `Supersedes`, and the old one's `Status` flips to `superseded` with a `superseded by:` link added — the old file is never deleted or rewritten. The full historical trail is part of the value.

## When to write an ADR

Write one when the decision is one of:

- Naming or license decisions
- Adding or removing a v1 component
- Changing a template format (e.g., switching placeholder syntax)
- Public release timing or scope
- Style rewrites of `verbatim`-mode lifts (per `specs/03-hooks.md`)
- Any decision a future maintainer will ask "why did we…?" about

## When NOT to write an ADR

Skip the ADR for:

- Bug fixes
- Content tweaks within existing components
- Bumping plugin or dependency versions
- Routine refactors that preserve behavior

The `CHANGELOG.md` covers these — a one-line entry under `[Unreleased]` is sufficient.

## Filename canon

ADR filenames follow the kit's filename canon (`specs/01-repo-structure.md` §"Naming conventions"):

```
NNNN-<lowercase-hyphenated-slug>.md
```

- `NNNN` — zero-padded 4-digit prefix, monotonically increasing. The next ADR's number is one greater than the largest existing number.
- `<lowercase-hyphenated-slug>` — kebab-case, no underscores, no SCREAMING_SNAKE_CASE.

Examples: `0001-hook-bundle-licensing.md`, `0002-some-future-decision.md`.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-hook-bundle-licensing.md) | Hook bundle, audit-scan, GH Actions workflow, and security-checklist reclassified from `verbatim` / `verbatim-with-light-edit` to `customization` | accepted | 2026-05-04 |
| [0002](0002-consensus-critical-aggregation.md) | Multi-reviewer Critical findings aggregate by consensus (≥2 votes), not max-over-reviewers | accepted | 2026-06-04 |
| [0003](0003-workflow-scriptpath-contract.md) | Committed Workflow seeds follow the proven scriptPath body-execution contract (not a node-check-clean exported-entry module) | accepted | 2026-06-04 |
| [0004](0004-phasing-flow-execution-engine.md) | The phasing-flow execution-engine seed: frozen-vocabulary reuse, copied-lib byte-identity, deterministic-first verification, and no fixed-point ceiling in M2 | accepted | 2026-06-05 |
| [0005](0005-integrate-branch-audit-seed.md) | The integrate-branch Phase-2 audit seed: reduce-parity acceptance, copy-3-libs, consensus dedup-only for distinct lenses, a synthetic-tsc D2 fallback, and transitive engine adoption | accepted | 2026-06-06 |
| [0006](0006-work-issue-phasing-flow-rewire.md) | The work-issue phasing-flow rewire: a SKILL-rewire driving the existing seeds (no new kernel), Mode-B Phase-4 engine-gating, S/M/L-conditional host, Phase-3.5 deletion, a 10-block frozen-region guard, and the ADR-0004 fixed-point discharge | accepted | 2026-06-06 |
| [0007](0007-spec-it-planning-brain-wire-declined.md) | spec-it stays unwired: the planning-brain wire DECLINED by a pre-registered blind probe (2/5 dims, redundant with Phase-7 iterative-review); the matrix:67 engine→planning-brain divergence ratified; floor stale-ref fixes only | accepted | 2026-06-08 |
| [0008](0008-m4-new-capabilities-recipe-and-routine.md) | M4 new capabilities: a read-only `/workflow-library` reference recipe (seed+docs, not a command) + a detect-only `doc-freshness` routine pilot; cloud `RemoteTrigger` 401 → registration is a consumer step; recipe-local consensus (no copied lib) + the FP-heavy citation signal moved to the routine's LLM layer | accepted | 2026-06-08 |
| [0009](0009-phasing-phasing-flow-coexistence.md) | M5 migrate + coexist: a soft, per-use-case `phasing` ↔ `phasing-flow` routing pointer (à-la-carte-by-primitive; deprecate-or-keep deferred per-use-case), NOT a wholesale deprecation; count-neutral + no version bump | accepted | 2026-06-09 |

When you add an ADR, append a row here — keep ADRs in numeric order.

## Example ADR scaffold (illustrative — not a real decision)

> **EXAMPLE — not an actual decision in this repo.** Real ADRs live as separate files at `docs/decisions/NNNN-<slug>.md`. This scaffold demonstrates the format applied to a plausible-but-fictional decision; it is not in the index above and there is no `0099-` file in this directory. The number `0099` is intentionally well outside the active range so it cannot be mistaken for a real decision.

```markdown
# 0099 — Use {{NAME}} placeholder syntax over Mustache `${...}`

- Status: accepted
- Date: 2026-05-04
- Decision: All kit templates use `{{NAME}}` placeholders only. No alternative syntaxes (Mustache `${...}`, Jinja `{% %}`, custom tokens) are accepted in v1.
- Context: Spec 02 froze the placeholder vocabulary at 16 names. A consumer asked whether their existing Mustache-based pipeline could be supported by accepting `${NAME}` in addition to `{{NAME}}`. Allowing alternative syntaxes would force every spec, scrub-check, and link-check to recognize multiple grammars; the placeholder-vocabulary scan in `scrub-check.yml` would have to enumerate every accepted form.
- Consequences: Consumers running Mustache pipelines pre-process the kit's templates with a one-line `sed` substitution (`sed 's/{{/${/g; s/}}/}/g'`) at fork time. The kit's CI continues to enforce `{{NAME}}` only. The trade-off is documented explicitly in `templates/README.md`.
- Alternatives considered:
  - Accept both `{{NAME}}` and `${NAME}`. Rejected — doubles the scrub-check surface and creates ambiguity ("which form is canonical?") that costs more than the one-line `sed` costs the Mustache consumer.
  - Switch the kit to `${NAME}` entirely. Rejected — `${...}` collides with shell-variable syntax in `hooks/*.sh` and breaks shellcheck.
  - Document support for Mustache without enforcing it in CI. Rejected — that's "scrub-check fails will be confusing" with extra steps.
- Supersedes / superseded by: none.
```
