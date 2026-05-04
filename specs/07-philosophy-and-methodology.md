# Spec 07 — Philosophy & Methodology

> Status: Draft / awaiting review
> Depends on: 00 (glossary), 01 (filename canon)
> Related: 02 (`templates/cheatsheet.md.template` is the source of truth for command vocabulary and reviewer-agent mapping), 06 (curriculum teaches this canon), 08 (decision log records changes to this canon)

## Purpose

Codify the *why* behind every other component. This becomes `docs/philosophy.md`
and `docs/methodology.md` once approved.

## Sourcing mode

`pattern-only`. Concepts from the Ultimate Guide (Five Golden Rules, MCP 5-step
vetting, context-discipline thresholds) are inherited as patterns; the prose is
ours.

## Why two files

- **Philosophy** — principles that guide *how we think* about working with AI.
  Stable. Changes rarely.
- **Methodology** — the specific techniques, workflows, and gates we apply. Less
  stable. Evolves as practice evolves.

A reader should be able to read `philosophy.md` once and orient permanently;
`methodology.md` they re-read after meaningful kit updates.

---

## Hierarchy of authority (a stated rule, not a decision)

When guidance conflicts:

```
project's <consumer>/CLAUDE.md        ← always wins for project-specific rules
  > kit's docs/methodology.md         ← wins over plugin defaults for shared workflows
  > superpowers / compound-engineering skill defaults
  > Claude Code defaults
```

A consumer override in `<consumer>/CLAUDE.md` always wins. The kit's methodology is
advisory but uniform; plugin defaults are uniform but generic; Claude Code defaults
are last-resort.

---

## `docs/philosophy.md` — Core principles (5 only)

Cut from the prior 8 to remove restatements. Reviewers flagged "no magic thinking
about AI" as a restatement of "verification before assertion," and "public
legibility" as a styling note rather than a principle.

### 1. Verification before assertion

Don't claim work is done until you've shown evidence. AI plus undisciplined claims
ships broken work that looks fine. Tools that encode this:
`verification-before-completion` skill (superpowers), `/work-issue` Phase 5,
`claude-code-review.yml`.

### 2. Methodology amplifies — both ways

TDD, brainstorming, planning, phasing aren't friction. They're the discipline that
makes AI assistance compound. Skipping them in the name of speed makes the work
look fast and *be* worse. AI amplifies whatever discipline you have, including the
bad.

### 3. Living documents over frozen specs

`<consumer>/CLAUDE.md`, the team's onboarding doc, this kit itself — all evolve.
The cost of a stale doc is higher than the cost of an updated one, because stale
docs *teach* errors. Hard rule: docs update with the code, in the same commit.

### 4. Plain text, plain markdown, no magic

Templates use `{{NAME}}` placeholders (one syntax, mandatory). Hooks are readable
shell scripts. Configs are plain JSON. A consumer should never have to debug a
templating engine to ship.

### 5. Security as default, not afterthought

Hooks block destructive actions and credential leaks **before** anyone has to
remember to be careful. Onboarding installs them. The team's `settings.json` has
them registered on day one. Default-on > opt-in.

---

## `docs/methodology.md` — The canon

### A. Brainstorming-then-planning (default for new features)

```
ambiguous request
  → /brainstorm  (one question at a time, multiple choice, narrow scope)
  → writing-plans (plan doc with concrete files and verification)
  → user reviews plan
  → executing-plans (carry out, with hard gates)
```

**Skip when:** single-file changes, refactors with no new logic, typos, "just do it."

**Source:** superpowers `brainstorming`, `writing-plans`, `executing-plans` skills.

### B. Test-Driven Development (default for new behavior)

```
RED   → write a failing test that captures the AC
GREEN → write the minimal implementation that passes
REFACTOR → clean up while keeping tests green
```

**Hard rules:**

- Don't modify existing passing tests to accommodate new code.
- If existing tests break, fix the implementation, not the tests.
- If GREEN fails 3 times for any AC, stop and ask for help.

**Source:** superpowers `test-driven-development` skill (enforced).

### C. Issue-driven development (`/work-issue <N>`)

The 8-phase gated workflow for any issue with acceptance criteria. Phases:
analysis → branch → planning → implementation (TDD) → verification → review prep
→ review → PR. Every issue must have ACs in checkbox format.

### D. Phasing (`/phase`)

For cross-cutting work that touches >8 files, spans >2 subsystems, has >12 task
bullets, or naturally breaks into milestones — invoke `/phase`. Master plan +
per-phase specs + handoffs + verification gates per phase. The kit's user-level
phasing skill (`~/.claude/skills/phasing`) handles GitHub-issue tracking
automatically when GitHub mode is selected.

**Skip when:** single file, <5 task bullets, refactor with no new logic, "just do
it."

### E. Verification before completion

Before claiming done:

- Run the full test suite (not just changed-file tests)
- Run typecheck and build
- Re-read the diff
- Cross-reference each AC

**Source:** superpowers `verification-before-completion` skill.

### F. Living documents on every ship

After every `/ship`, update the project's living-doc set in the same commit. The
specific list of living docs is **defined per-project** in the project's
`<consumer>/CLAUDE.md` "Documentation Requirements" section — not in this canon
(this kit doesn't dictate which files a particular project owns).

> **Example block — Next.js project (illustrative; consumer's actual list lives in
> their CLAUDE.md):** CHANGELOG, project_status, setup_guide, architecture, PRD,
> reference_docs, README. Plus user-guide HTML if user-facing behavior changed.

### G. Context discipline

Threshold table — the reasoning behind the numbers comes from the prompt-cache
mechanics (5-minute TTL) and observed behavior under context pressure. Pinning at
70% gives time to `/compact` before quality degrades; mandatory `/clear` at 90%
prevents the long-tail behavior where the agent starts hallucinating from
truncated context.

| Context % | Action |
|---|---|
| 0–50% | Work freely |
| 50–70% | Pay attention; finish current focused work before adding new scope |
| 70–90% | `/compact` to summarize |
| 90%+ | `/clear` (mandatory) |

Plus: `/effort xhigh` for complex work; default to lower for routine work to
control cost.

### H. Multi-agent review — see `templates/cheatsheet.md.template` Appendix A

The canonical "which reviewer when" mapping is **owned by the cheatsheet** (spec
02). This methodology doc cites it, does not restate it. The mapping is updated
when compound-engineering's reviewer roster changes — that's a cheatsheet edit,
not a methodology rewrite.

In abstract terms: layered review for any non-trivial PR — author self-review →
`/claude-review` GH Action → one or more specialized reviewer agents (chosen by
change shape) → human reviewer signs off.

### I. MCP discipline — see `templates/mcp-policy.md.template`

The kit's MCP allowlist + 5-step vetting workflow live in
`templates/mcp-policy.md.template` and the `mcp-config-integrity.sh` hook (spec
03). This methodology doc does not restate them. (This section was previously
duplicated content per the spec review — collapsed to a one-line pointer.)

---

## Decisions needed

All philosophy/methodology decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | One file or two? | Two files: `docs/philosophy.md` (stable) + `docs/methodology.md` (evolving). |
| 2 | Tone | Crisp and declarative. Easier to onboard from. |
| 3 | Conflict hierarchy | Stated rule above (project CLAUDE.md > kit methodology > plugin defaults > Claude Code defaults). Not a decision; a rule. |
| 4 | Methodology versioning | Describe abstractly; cite skill names but not versions. (Section H was the last violator — moved to cheatsheet.) |
| 5 | Philosophy poster | Skip. (Cut entirely; was tongue-in-cheek and didn't earn its bullet.) |

## Out of scope

- A general AI ethics doc.
- A buyer's guide to Claude Code plugins.
- Replacing or superseding any plugin's own discipline.
- Restating content from `templates/cheatsheet.md.template` or
  `templates/mcp-policy.md.template`.

## Acceptance criteria

- `docs/philosophy.md` contains exactly 5 numbered principles (no more, no less).
- `docs/methodology.md` contains sections A–G in full plus H and I as one-line
  pointers to their actual sources of truth.
- Section §F's example block is clearly labeled as illustrative; no project-
  specific filenames appear outside that block.
- Section §G's context thresholds are accompanied by a one-paragraph rationale.
- Section §H contains zero named compound-engineering reviewer agents (the names
  live in `templates/cheatsheet.md.template` Appendix A).
- The hierarchy-of-authority rule appears verbatim at the top of
  `docs/methodology.md` (or in `docs/philosophy.md`'s "Hierarchy" section).
- Spec 09's link-check validates all anchors used in this doc.

## Revisions

Addressed: R-029 (philosophy cut from 8 to 5 principles; §H becomes a pointer to
cheatsheet, §I becomes a pointer to mcp-policy template), R-030 (named-reviewer
list cut from §H per the very recommendation in this spec's decision #4), R-031
(authority hierarchy promoted from "decision needed" to stated rule), R-032 (§F
abstracted; project-specific doc list moved to clearly-labeled illustrative example),
R-033 (§G thresholds get a paragraph of rationale referencing prompt-cache
mechanics and observed agent behavior), R-034 (decision #5 about philosophy poster
removed).
