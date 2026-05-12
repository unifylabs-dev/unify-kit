# Spec 00 — Vision, Naming, License, Glossary

> Status: Implemented in v0.2.x
> Depends on: (none — foundational)
> Related: 01 (structure), 07 (philosophy), 08 (living docs)

## Purpose

Pin down what `unify-kit` is, who it serves, what it isn't, how it's licensed, what
its terms mean. Foundational — every other spec inherits from it.

---

## Vision

A reusable, opinionated kickstarter for any new Claude Code project. Compose existing
plugins (`superpowers`, `compound-engineering`, etc.) with a curated set of templates,
hooks, GitHub Actions, scripts, and onboarding docs that encode mature practice.

**The Ultimate Guide teaches; this kit ships.** The Ultimate Guide is reference
material; this kit is what you copy into a new repo on day one. We lift CC0 artifacts,
leave the narrative behind, and add the bootstrap glue that turns "here's a buffet of
templates" into "this is a working starter."

The goal is **time-to-productivity**: clone the repo, run a bootstrap script, and a
new project (or a new dev on an existing project) lands on day one with:

- A team-ready `CLAUDE.md`
- Security/safety hooks installed and registered
- A PR-review GitHub Action wired up
- A short onboarding curriculum
- A clear AI usage charter and MCP vetting policy

It is **not** a methodology framework, a Claude Code replacement, or a build tool. It
is a starter kit that *uses* Claude Code well.

---

## Naming

**Project name: `unify-kit`.** (User-decided; closes the foundational fork.)

The name appears in: directory name (`unify-kit/`), README hero line, scripts that
self-reference, package metadata. Cross-spec references use the literal string
`unify-kit`. Alternatives considered and rejected: `claude-kickstart`, `cc-kit`,
`cadence`, `forge`, `keel`, `engineering-kit` — all surrendered to `unify-kit`.

---

## Audience and scrubbing decision

`unify-kit` v1 is built for **two concentric audiences**:

1. The author's own future projects + team
2. Public OSS users who clone it cold

There is one binary scrubbing decision: **does v1 ship scrubbed for public adoption,
or stay internal?** The recommended default is **ship scrubbed for public adoption**.

"Scrubbed" means: zero references to `optics-management`, `mvo_*`, `Mint Vision`,
internal team names, internal infrastructure, or any production credentials. Specs
that allow stack-specific examples must clearly label them as "Next.js + Postgres
example" callouts and provide placeholder forms for reuse. The
[Public-readiness checklist in spec 08](08-living-docs-and-decision-log.md#public-readiness)
codifies the scrub gates required at v1.0.0 release.

There is no "tier 1 / tier 2 / tier 3" abstraction. Two states only: **scrubbed** or
**internal**. Specs that previously referenced tiers all reduce to scrubbed/internal.

---

## In scope

- Templates (CLAUDE.md, llms.txt, charter, MCP policy, security checklist, onboarding,
  cheatsheet)
- Hooks (the six security hooks + install harness)
- GitHub Actions workflows (PR review)
- Scripts (bootstrap, audit-scan)
- Onboarding curriculum (day-1, week-1, day-30 outlines + checklists)
- Philosophy and methodology docs (the *why*)
- The kit's own CI (shellcheck, yamllint, markdownlint, link-check, fixture tests)
- Decision log + changelog (the meta-process)
- Upgrade-flow contract (how consumers pull future versions)
- Public-readiness checklist (gates the v1.0.0 scrub)

## Out of scope

- Application scaffold code (no Next.js boilerplate, no Rails generator). Templates
  *describe* conventions; they don't ship runnable app code.
- A custom plugin or skill. We compose existing plugins; we don't ship our own as
  part of v1.
- A custom MCP server. The Ultimate Guide ships one; we don't need to.
- The Ultimate Guide's quiz, learning path content, or 16 deep-dive guides — those
  are reference material, not artifacts to copy.
- Filled-in example outputs (`examples/`) — deferred to v1.1. Confirmed answer to
  the formerly-floating decision in specs 01 and 02. Once the kit has been used to
  bootstrap one real project, the sanitized output of that bootstrapping becomes
  the v1.1 examples.

---

## Glossary (canonical terms — every other spec uses exactly these)

| Term | Meaning |
|---|---|
| **`<consumer>/CLAUDE.md`** | The consumer project's own CLAUDE.md (project memory). Lives at the consumer's repo root. |
| **`templates/CLAUDE.md.template`** | The kit's *template* file that consumers copy and customize to produce their `<consumer>/CLAUDE.md`. |
| **`docs/methodology.md`** | The kit's own methodology canon (lives in this repo). Cross-referenced from spec 07 and the consumer-facing onboarding curriculum. |
| **`docs/philosophy.md`** | The kit's own philosophy doc (lives in this repo). Stable principles. |
| **The kit / `unify-kit`** | This repo. The thing being specified. |
| **The consumer** | Someone who clones `unify-kit` into a new project (or whose project adopts it). |
| **The kit's own CI** | GitHub Actions workflows that run *against* this repo (lint, test fixtures, scrub check). Not to be confused with the PR-review workflow we ship *to* consumers (`github-actions/claude-code-review.yml`). |

Banned synonyms (do not use these in any spec): "team CLAUDE.md", "project
CLAUDE.md", "the CLAUDE.md template" without the `templates/` prefix.

---

## Sourcing modes (how the kit reuses Ultimate Guide content)

Every artifact lifted or derived from the Ultimate Guide gets one of these four mode
labels. The label appears next to the artifact name in any spec that mentions it.

| Mode | Definition | Examples |
|---|---|---|
| **`verbatim`** | Lifted byte-for-byte. Header comment cites the source path. No edits beyond inserting attribution. | All six security hooks (spec 03), `audit-scan.sh` (spec 05) |
| **`verbatim-with-light-edit`** | Lifted, then edited only to remove framework-specific items the kit doesn't ship and add a clearly-labeled stack-specific example block. The diff against upstream stays small enough that upstream changes can be merged manually. | `templates/security-checklist.md` (spec 02) |
| **`customization`** | Used as a starting point; substantially rewritten or extended. Header notes what was lifted vs. authored. | `templates/ai-usage-charter.md.template` (spec 02) |
| **`pattern-only`** | Conceptual inheritance only; no prose, structure, or named items lifted. Cite the upstream concept by name. | The MCP 5-step vetting workflow concept (spec 02), the learning-path module shape (spec 06), the Five Golden Rules concept (spec 07) |

Phase-execution agents can batch artifacts by mode: `verbatim` and
`verbatim-with-light-edit` items run in fast-lift phases; `customization` and
`pattern-only` items go in author-led phases.

---

## License

Mirror the Ultimate Guide's split (we lift their CC0 templates and reuse some of
their narrative under CC BY-SA, so our license must compose with theirs):

| File class | License | Reason |
|---|---|---|
| Code (scripts, hook scripts, GH Actions YAML) | **MIT** | Permissive, frictionless reuse, compatible with the CC0 templates we lift. |
| Templates (`templates/*`, JSON/YAML stubs) | **CC0 1.0** | Match Ultimate Guide template licensing. Public domain so consumers fork freely. |
| Narrative docs (`docs/*.md`, `README.md`, philosophy, methodology, onboarding) | **CC BY-SA 4.0** | Match Ultimate Guide for derived narrative content. Requires attribution + share-alike. |

A `LICENSE` file at the root names the default (MIT). Each non-default class has a
brief header noting its specific license.

### Attribution policy

- **`verbatim` and `verbatim-with-light-edit` lifts** from Ultimate Guide: include a
  header comment citing source path and license. No legal requirement; respectful
  and traceable.
- **`customization` reuses**: header comment notes "based on" + source path.
- **`pattern-only` inheritance**: cite the Ultimate Guide concept inline in prose.
- **Net-new work**: no attribution; copyright belongs to the author per the chosen
  license.

---

## Versioning

Semver. v0.x.y until the kit has been used to bootstrap one production project end-
to-end; bump to v1.0.0 then. CHANGELOG.md tracks every release per spec 08.

---

## Decisions needed

All foundational decisions are now resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | Project name | `unify-kit` (user-decided) |
| 2 | Audience scrubbing | Scrubbed for public adoption (binary, no tiers) |
| 3 | License | MIT (code) + CC0 (templates) + CC BY-SA 4.0 (narrative docs) |
| 4 | Stack flavor strategy | Stack-agnostic core. Stack-specific patterns live in clearly-labeled `templates/snippets/` (spec 02) and an `examples/` directory deferred to v1.1. The kit's CLAUDE.md.template ships minimal and stack-agnostic. |
| 5 | One-line tagline | "The Ultimate Guide teaches; this kit ships. Clone, bootstrap, work." (Confirm or replace at impl time — non-blocking.) |

Any future fork that touches a foundational decision requires an ADR (spec 08).

## Acceptance criteria

- A `LICENSE` file exists at the repo root naming the chosen license(s) per the
  table above.
- The string `unify-kit` appears in: `README.md` hero line, all scripts that
  self-reference, the directory name (post-rename).
- Zero references to `optics-management`, `mvo_*`, `Mint Vision`, or internal team
  names anywhere in the repo (gated by the kit's own CI scrub check — spec 09).
- The glossary terms are used verbatim in every spec; the banned synonyms appear
  zero times in any spec.
- Every artifact in specs 02 and 03 that lifts or inherits from Ultimate Guide is
  tagged with a sourcing mode (`verbatim`, `verbatim-with-light-edit`,
  `customization`, `pattern-only`).
- The `docs/audit/` files are preserved unchanged as historical record.

## Revisions

Addressed in this revision: R-001, R-002, R-003, R-007, R-013, R-040, R-046, R-047.

**v0.3 revision (2026-05-04):** clarified the license-compatibility precondition for `verbatim` lifts. When an upstream's license is incompatible with the kit's MIT-for-code policy (copyleft, share-alike, GPL-style), the kit authors from patterns under `customization` rather than lifts expression — see [`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md). The four sourcing modes themselves are unchanged; only the precondition for picking `verbatim` is tightened.
