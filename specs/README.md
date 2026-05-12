# Specs Index

Pre-implementation specs for `unify-kit`. Each spec describes one component of the
final repo. **The build phase begins after specs are approved.**

> **Status:** All 14 specs (00–13) implemented as of v0.2.x (2026-05-11). See
> per-spec frontmatter for the version each landed in. Originally hardened
> (revision 2, 2026-05-03) as 9 specs + this index; the v0.2.x absorption arc
> added specs 10–13 (SDD layer, GitHub templates, test discipline, CLAUDE.md
> enrichment).

---

## Specs (read in order)

| # | Spec | Topic |
|---|------|-------|
| 00 | [`00-vision-and-license.md`](00-vision-and-license.md) | Naming, audience, scope, license, glossary, sourcing modes |
| 01 | [`01-repo-structure.md`](01-repo-structure.md) | Filename canon + final directory tree |
| 02 | [`02-templates.md`](02-templates.md) | All template files (claude.md, llms.txt, charter, mcp-policy, security-checklist, team-onboarding, cheatsheet) |
| 03 | [`03-hooks.md`](03-hooks.md) | Six security hooks, install paths, settings registration, manual-test recipes |
| 04 | [`04-github-actions.md`](04-github-actions.md) | Comment-triggered PR-review workflow shipped to consumers |
| 05 | [`05-scripts.md`](05-scripts.md) | Bootstrap script + settings-merge algorithm + audit-scan + test fixtures |
| 06 | [`06-onboarding-curriculum.md`](06-onboarding-curriculum.md) | Day-1 / week-1 / day-30 with verifiable gates |
| 07 | [`07-philosophy-and-methodology.md`](07-philosophy-and-methodology.md) | Core philosophy (5 principles) + methodology canon (§A–J) |
| 08 | [`08-living-docs-and-decision-log.md`](08-living-docs-and-decision-log.md) | CHANGELOG, ADRs, upgrade-flow contract, public-readiness checklist |
| 09 | [`09-kit-ci.md`](09-kit-ci.md) | The kit's own CI: lint, scrub, bootstrap-fixture, changelog-check |
| 10 | [`10-sdd-layer.md`](10-sdd-layer.md) | Specification-Driven Development layer (module + journey + specs-README templates, methodology §B, BDD-Lite snippet, 2 new placeholders) |
| 11 | [`11-github-templates.md`](11-github-templates.md) | GitHub repo scaffolding (PR template + feature-request + bug-report issue templates) |
| 12 | [`12-test-discipline.md`](12-test-discipline.md) | Smart CI test-split + four-tier pyramid + workflow templates (`ci-pr-fast.yml.template`, `ci-nightly.yml.template`) |
| 13 | [`13-claude-md-enrichment.md`](13-claude-md-enrichment.md) | Consumer `CLAUDE.md` enrichment (Branch Naming + Spec Discipline + PR Merge Process + Living Doc Triggers), methodology-retro template, 4-week onboarding ramp |

---

## Decisions resolved during hardening

The hardening pass (per `docs/audit/spec-review-2026-05-03.md`) closed every
foundational and component-level fork. Key resolutions:

| Decision | Resolution |
|---|---|
| Project name | `unify-kit` |
| Audience | Scrubbed for public adoption (binary — no tier abstraction) |
| License | MIT (code) + CC0 (templates) + CC BY-SA 4.0 (narrative docs) |
| Stack flavor | Stack-agnostic core in `claude.md.template` + opt-in `templates/snippets/` |
| `examples/` | Deferred to v1.1 |
| Placeholder syntax | `{{NAME}}` — single mandatory convention |
| Filename canon | lowercase-hyphenated, `.md.template` for editable, plain `.md` for lift-as-is |
| Sourcing modes | `verbatim` / `verbatim-with-light-edit` / `customization` / `pattern-only` |
| Hook bundle | Six hooks, all `verbatim` lifts from Ultimate Guide CC0 |
| Hook disable | `CLAUDE_HOOKS_DISABLE=<name>` env var |
| PR-review mode | Comment-trigger only; auto-on-PR variants in BACKLOG |
| Bootstrap script | Prompt-then-overwrite, mandatory backups, `--dry-run` and `--force` only |
| ADR format | Lightweight (one file per decision) |
| CHANGELOG cadence | Per-PR `[Unreleased]` flow, CI-enforced |
| v1.0.0 trigger | Specs implemented + one project bootstrapped successfully |
| Cross-platform | Bash + macOS/Linux only for v1 |

A handful of items remain open *by design*:

- The kit's actual one-line tagline (spec 00 #5) — non-blocking, finalized at
  implementation
- Specific aggregators to submit to at v1.0.0 (spec 08) — optional, author's call
- The exact contents of `.gitignore` (spec 01 #4) — implementation detail

These are the only forks a `/phase` master-plan run will need to confirm; nothing
load-bearing remains undefined.

---

## After approval

Once specs are approved, top-level component directories get built per spec 01's
layout. Spec docs themselves stay in `specs/` as the historical record of what was
agreed; revisions land via in-place edits with a `Revisions` footer citing the
addressed `R-NNN` IDs.

The findings report from the hardening pass is preserved at
[`../docs/audit/spec-review-2026-05-03.md`](../docs/audit/spec-review-2026-05-03.md)
as permanent record of what was flagged and how each item was resolved.

---

## Spec format

Every spec follows this shape:

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

Drafts are short by design — reviewable in a single pass; implementation detail
lives in the implementations themselves once specs are approved.
