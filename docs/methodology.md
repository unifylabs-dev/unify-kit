<!--
docs/methodology.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Inherits MCP 5-step vetting + context-discipline threshold patterns from the
Ultimate Guide; prose is authored.
License: CC BY-SA 4.0 (narrative docs ship CC BY-SA 4.0 per specs/00-vision-and-license.md §"License")
Authored: 2026-05-04
-->

# Methodology

The operational canon. Less stable than `docs/philosophy.md` — re-read this after meaningful kit updates. Each section names one technique, the conditions under which to use it, and the skill or tool that encodes it. Sections A–G are the kit's whole canon; sections H and I are one-line pointers to authoritative sources of truth living elsewhere in the kit.

## Hierarchy of authority

When guidance conflicts:

```
<consumer>/CLAUDE.md          ← always wins for project-specific rules
  > docs/methodology.md       ← wins over plugin defaults for shared workflows
  > superpowers / compound-engineering skill defaults
  > Claude Code defaults
```

A consumer override in `<consumer>/CLAUDE.md` always wins. The kit's methodology is advisory but uniform; plugin defaults are uniform but generic; Claude Code defaults are last-resort. (This rule is intentionally repeated from `docs/philosophy.md` — readers who land on either doc should see it.)

## A. Brainstorming-then-planning

For any non-trivial new feature, design decision, or ambiguous request, the default is:

```
ambiguous request
  → /brainstorm   (one question at a time, multiple choice, narrow scope)
  → writing-plans (a plan doc with concrete files and verification steps)
  → user reviews plan
  → executing-plans (carry out, with hard gates between steps)
```

The brainstorming pass exists to surface intent and constraints *before* anyone touches code. The plan-writing pass exists to make implementation reviewable on paper, where changes are cheap. The execution pass exists to keep the work honest as it lands.

**Skip when**: single-file changes, refactors with no new logic, typos, "just do it" requests. Don't use brainstorming as ceremony — for trivially scoped work it adds friction without insight. The skip-list is short on purpose; when in doubt, brainstorm.

**Source skills**: `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:executing-plans`.

## B. Test-Driven Development

For any new behavior, the default is:

```
RED      → write a failing test that captures the AC
GREEN    → write the minimal implementation that makes it pass
REFACTOR → clean up while keeping tests green
```

This applies to bug fixes too: write the test that reproduces the bug, watch it fail, then fix the implementation.

**Hard rules:**

- Don't modify existing passing tests to accommodate new code. New behavior gets new tests.
- If existing tests break, fix the implementation, not the tests.
- If GREEN fails three times in a row for a single AC, stop and ask for help. The third failure is signal that the AC, the test, or the design is wrong — keep iterating and you'll force-fit a bad design.

**Source skill**: `superpowers:test-driven-development`.

## C. Issue-driven development

For any GitHub issue with acceptance criteria, invoke `/work-issue <N>`. The eight-phase gated flow is: analysis → branch → planning → implementation (TDD) → verification → review prep → review → PR. Each phase has a verification gate before the next opens. Issues without acceptance criteria in checkbox format aren't ready to start — fix the issue first; ACs in prose let work drift.

## D. Phasing

For cross-cutting work that touches more than ~8 files, spans more than 2 subsystems, has more than ~12 task bullets, or naturally breaks into milestones: invoke `/phase`. The user-level `phasing` skill at `~/.claude/skills/phasing` decomposes the work into a master plan + per-phase specs + handoffs, gates each phase with plan-mode self-verification, and tracks state in GitHub issues automatically when GitHub mode is selected (the default when a `github.com` remote is present).

**Skip when**: single file, fewer than 5 task bullets, refactor with no new logic, "just do it." Phasing has real overhead — master-plan generation, per-phase specs, verification gates, handoffs. That overhead pays back when the work is genuinely large enough that single-execution risks context rot, and not before.

## E. Verification before completion

Before claiming any task done:

- Run the full test suite (not just the changed-file tests).
- Run typecheck and build.
- Re-read the diff yourself.
- Cross-reference each acceptance criterion against the diff and the test output.

Performative verification — running one test and skipping the rest, or eyeballing the diff without re-reading — is the failure mode. Evidence before assertions, every time.

**Source skill**: `superpowers:verification-before-completion`.

## F. Living documents on every ship

After every `/ship`, update the project's living-doc set in the same commit as the code. The specific list of living docs is **defined per-project** in the project's `<consumer>/CLAUDE.md` "Documentation Requirements" section — this canon does not dictate which files a particular project owns. The rule is universal; the list is local.

The reason is simple: the cost of a stale doc is higher than the cost of an updated one, because stale docs *teach* errors. New devs read the doc, learn the wrong thing, and proceed confidently in the wrong direction. Coupling the doc update to the code update — same commit, same review — is the only mechanism that scales.

> **Example block — Next.js project (illustrative; consumer's actual list lives in their CLAUDE.md):**
> CHANGELOG, project_status, setup_guide, architecture, PRD, reference_docs, README. Plus user-guide HTML if user-facing behavior changed. The illustrative list is a starting point — every project edits it.

## G. Context discipline

The thresholds below are anchored on prompt-cache mechanics and observed agent behavior under context pressure. The Anthropic prompt-cache has a 5-minute TTL — sleeping past that means the next read is uncached, which is slower and more expensive. Beyond ~70% context fill, observed quality degrades; beyond ~90%, agents start hallucinating from truncated context. The thresholds aren't arbitrary; they're the points at which the next degradation becomes likely.

Why each threshold matters: the 50% mark is a soft attention check — finish the current focused work before adding new scope, otherwise the next jump compresses two threads into one. The 70% mark triggers `/compact` to summarize, which buys back working room without losing the thread. The 90% mark mandates `/clear` because past that point the agent reasons over a truncated view of its own work, and the failure mode is silent.

| Context % | Action |
|---|---|
| 0–50% | Work freely |
| 50–70% | Pay attention; finish current focused work before adding new scope |
| 70–90% | `/compact` to summarize |
| 90%+ | `/clear` (mandatory) |

Plus: `/effort xhigh` for complex work; default to lower for routine work to control cost.

## H. Multi-agent review

The canonical "which reviewer when" mapping lives in `templates/cheatsheet.md.template` Appendix A. This methodology cites it; it does not restate it. The mapping is updated when the compound-engineering reviewer roster changes — that's a cheatsheet edit, not a methodology rewrite.

In abstract: layered review for any non-trivial PR — author self-review → `/claude-review` GH Action → one or more specialized reviewer agents (chosen by change shape) → human reviewer signs off. The layering is the rule; the specific reviewer choices are tactical.

## I. MCP discipline

The kit's MCP allowlist + 5-step vetting workflow live in `templates/mcp-policy.md.template` and the `mcp-config-integrity.sh` hook. This methodology does not restate them.
