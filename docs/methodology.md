<!--
docs/methodology.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Inherits MCP 5-step vetting + context-discipline threshold patterns from the
Ultimate Guide; SDD layer (§B) inherits structure from a real consumer
project's methodology document, no expression lifted; prose is authored.
License: CC BY-SA 4.0 (narrative docs ship CC BY-SA 4.0 per specs/00-vision-and-license.md §"License")
Authored: 2026-05-04 (initial); §B SDD added 2026-05-06 (per specs/10-sdd-layer.md)
-->

# Methodology

The operational canon. Less stable than `docs/philosophy.md` — re-read this after meaningful kit updates. Each section names one technique, the conditions under which to use it, and the skill or tool that encodes it. Sections A–H are the kit's whole canon; sections I and J are one-line pointers to authoritative sources of truth living elsewhere in the kit.

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

## B. Specification-Driven Development

The kit's durable behavior layer. Specs are the law; issues are the case. The case references the law and amends it through PR review; the law lives in version control and is read top-to-bottom by anyone (or any agent) trying to understand the system.

### Three-layer mental model

| Layer | Artifact | Question it answers | Lives in | Audience |
|---|---|---|---|---|
| **SDD** (Specification-Driven Development) | Module spec, journey spec | "How does this part of the system *behave*?" | `<consumer>/docs/specs/` (durable, version-controlled) | Devs, future hires, agents, auditors |
| **BDD-Lite** (Behavior-Driven Development, lightly tooled) | E2E test + Given/When/Then test names under a `Journey:` describe block | "Does the user-level behavior actually work end-to-end?" | The project's e2e tree (durable) | CI, devs |
| **TDD** (Test-Driven Development) | Unit test | "Does this function/action do what I told it to do?" | The project's unit-test tree (durable) | CI, devs, agents |

Plus the change-request layer (ephemeral): a GitHub issue is the *change request*; implementation = code + tests + spec deltas in **one PR**.

There is no Cucumber, no `.feature` files, no DSL. BDD-Lite is just a naming convention layered on top of whatever e2e runner the project uses.

### Vocabulary

- **Spec** — a markdown file in `<consumer>/docs/specs/` that documents *behavior*, not implementation. Specs link to source code; they don't quote it.
- **Module spec** — `<consumer>/docs/specs/modules/<name>.md`. Documents one slice of the system. Aim 200–500 lines. Template: `templates/core/specs/module.md.template`.
- **Journey spec** — `<consumer>/docs/specs/journeys/<slug>.md`. Documents one cross-module user flow. Aim 100–300 lines. Template: `templates/core/specs/journey.md.template`.
- **Drift fix** — a bug fix where the *code* drifted away from the documented behavior. The spec is correct; the code is wrong. **No spec change needed.**
- **Behavior change** — a fix or feature that intentionally changes documented behavior. **Spec update required in the same PR.**
- **Lazy bootstrap** — when an issue touches code with no existing spec, `/work-issue` Phase 0 (Spec Sync) creates the initial spec from current code as its first step. No big-bang migration; specs accumulate on use.

### Seven hard rules

1. **Every issue with non-trivial behavior change lists "Spec sections affected" in its body.** Pure drift fixes write `None — fixing drift from spec`. Pure docs/config/typo PRs write `None — no behavior change`. Anything else names the spec(s) and section(s).
2. **Specs ship in the same PR as the code that implements them.** Never separate PRs. Reason: the spec and the code are the contract and its fulfillment; separating them lets one drift from the other before review.
3. **The spec describes behavior, not implementation.** Don't quote schemas, don't copy function signatures, don't paste type definitions. Link to file paths via `code_anchors:` and describe what they do in prose. A future maintainer should be able to re-implement the module from the spec without reading the original code.
4. **Module specs are 200–500 lines. Journey specs are 100–300 lines.** Longer = documenting implementation; start over. Shorter for substantial subjects = under-documenting; add behavior rules and edge cases.
5. **Bug-fix-only PRs (drift fix, no behavior change) tick the "no spec changes needed" box** in the PR template. This forces an explicit decision: either the spec was updated, or the spec is confirmed still accurate.
6. **New e2e tests use Given/When/Then naming under `Journey: <slug>` describe blocks.** At least one test per Tier-1 journey carries the `@daily` tag. See `templates/snippets/testing/bdd-lite-test-naming.md` for the canonical example.
7. **Review-driven spec changes ship in the same PR as the code they accompany — never a follow-up PR.** When PR review surfaces a behavior change (e.g., a missing edge case), update both spec and code in the same branch *before* merging. Same-branch follow-up commits are fine; a separate "fix spec" PR is not.

### Bug-fix flow: drift fix vs behavior change

```
Bug reported
    │
    ▼
Read the relevant module spec
    │
    ├── Does the bug describe code behaving DIFFERENTLY from spec?
    │       │
    │       ├── YES → DRIFT FIX
    │       │         • Issue's "Spec sections affected" = "None — fixing drift from spec"
    │       │         • Phase 0 confirms spec is still accurate
    │       │         • Fix the code to match the spec
    │       │         • PR: tick "fixes drift, no spec change needed"
    │       │
    │       └── NO  → BEHAVIOR CHANGE (spec is wrong, or new behavior needed)
    │                 • Issue's "Spec sections affected" lists the spec(s) to update
    │                 • Phase 0 identifies the section deltas
    │                 • COMMIT 1: spec update
    │                 • COMMIT 2: code + tests
    │                 • PR: tick "updates docs/specs/"
```

**Worked example A — drift fix.** A logging helper was supposed to redact PII before writing to the audit log, per the auth module's spec. A bug report shows raw email addresses landing in logs. The spec already says "redact email before logging." The fix realigns code to spec — drift fix, no spec change.

**Worked example B — behavior change.** A reviewer requests widening permission on a read-only resource so the `VIEWER` role can see audit entries. Currently the spec says ADMIN-only. To enable VIEWER, the spec's Permissions section must change. The behavior is being intentionally widened — spec update required in the same PR.

### Lazy bootstrap (Tier 1 / Tier 2)

Bootstrapping is incremental. Tier-1 modules and journeys get pre-emptive specs (worth the effort because the area is high-leverage); Tier-2 are bootstrapped on first-touch by `/work-issue` Phase 0. Pick Tier-1 when at least two are true:

- **Highest leverage** — most-changed, central to multiple flows.
- **Security-sensitive or compliance-critical** — auth, audit, data residency.
- **Freshest in memory** — recently shipped or actively under development.

The list of Tier-1 modules and journeys is per-project; the consumer maintains it in `<consumer>/docs/specs/README.md`. The kit ships the templates and the rule, not the list.

### BDD-Lite naming convention

Top-level e2e describe = `Journey: <slug>`. Each `test()` is named with a Given/When/Then sentence and corresponds 1:1 to a numbered step in the matching journey spec. At least one test per Tier-1 journey is tagged `@daily`. Existing assertion-style tests stay — never rewrite a passing test to fit the convention. Full rules and a copy-paste example: `templates/snippets/testing/bdd-lite-test-naming.md`.

## C. Test-Driven Development

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

### Test scheduling: match cost to feedback urgency

Not every test needs to run on every push. Fast feedback on the change in hand, slower feedback on integration concerns, slowest feedback on cross-cutting regressions. The four-tier pyramid below is the working compromise: keep PR CI under ~3 minutes, gate locally on the full unit suite before opening a PR, run e2e on a daily schedule (not on PRs), and run everything cross-cutting nightly.

| Tier | When | What runs | Typical time |
|---|---|---|---|
| **CI (fast)** | Every push/PR | Core infrastructure tests + tests for changed code paths. The gate for PR review. | 2–3 min |
| **E2E daily** | Daily cron, NOT on PRs | `@daily`-tagged e2e tests covering critical read-only paths (auth, nav, list pages, route guards). | 5–8 min |
| **Local (pre-PR)** | Before opening a PR | Full unit suite. The author's gate before requesting review. | 5–8 min |
| **Nightly** | Daily cron, late hours | Full e2e suite + full unit suite. Catches cross-cutting regressions. | 60–75 min |

**Tagging convention.** `@daily` = read-only tests on critical paths (no DB writes, no destructive actions). Untagged = nightly-only. The `@daily` tag is applied at the test level (and at minimum at the `Journey: <slug>` describe-block level — see §B "BDD-Lite naming convention"). At least one test per Tier-1 journey is tagged `@daily`.

**Anti-patterns to avoid:**

- **Running the full suite on every PR when CI takes >5 min.** Slow PR feedback degrades author behavior — authors stop running tests locally because "CI will catch it," but CI catches it 15 minutes later, and the iteration loop balloons.
- **Running only the unit suite in CI.** No integration coverage means regressions in cross-module flows ship to production.
- **Skipping nightly entirely.** Cross-cutting regressions accumulate silently. The nightly tier is cheap insurance — it costs the equivalent of one CI run per night and catches what the per-PR tiers miss.

**Working implementation.** `templates/snippets/ci-test-split-bash.sh` ships a smart CI test-split for the Tier-1 (CI fast) tier: always-run core infrastructure tests + diff-driven action tests + full-suite fallback on push to default branch or on shallow checkout. Stack-leans toward Node + Vitest; the *shape* (always-run subset + diff-driven additions + fallback) ports cleanly to other runners. CI workflow shapes for Tier 1, Tier 2, and Tier 4 ship in `templates/snippets/ci-pr-fast.yml.template` and `templates/snippets/ci-nightly.yml.template`.

## D. Issue-driven development

For any GitHub issue with acceptance criteria, invoke `/work-issue <N>`. Issues without acceptance criteria in checkbox format aren't ready to start — fix the issue first; ACs in prose let work drift.

The eight-phase gated flow (each phase has a verification gate before the next opens):

| # | Phase | Purpose | Output |
|---|---|---|---|
| **0** | **Spec Sync** | Read spec(s) named in the issue's "Spec sections affected" field; bootstrap missing specs from current code (lazy bootstrap, §B); identify spec deltas required by the ACs. | A list of spec deltas, surfaced to the user, gating Phase 1. |
| 1 | Issue Analysis | Fetch issue title, body, labels; extract behavioral and visual ACs. | A structured AC list for the rest of the flow. |
| 2 | Branch + Worktree | `gh issue develop <N>` with naming convention `<type>/<issue>-<slug>`. | Isolated working branch, optionally as a git worktree. |
| 3 | Planning | Explore the codebase, formulate a plan; spec deltas from Phase 0 are part of the plan. | A reviewable plan doc. |
| 4 | Implementation (strict TDD) | RED → GREEN → REFACTOR per AC. **Spec deltas commit BEFORE code commits** — the spec leads, the code follows. | Code + tests + spec changes, all on the working branch. |
| 5 | Verification | Full test suite, typecheck, build, scope guard (every changed file maps to an AC). | Green CI signals. |
| 6 | Review prep | Dev server up; manual review checklist; AC cross-reference; concerns list. | A self-reviewed branch ready to PR. |
| 7 | PR creation | PR body includes a `## Spec Changes` section ticked appropriately (spec updated, or drift fix confirmed); PR description links the issue with `Closes #N`. The PR itself is where reviewer feedback enters; review-driven changes ship on the same branch (rule 7 in §B). | Open PR ready for review and merge. |

The skill at `~/.claude/skills/work-issue` is the executable contract; this section documents what each phase produces and which gates are mandatory.

The defining shift is **Phase 0**. Before any code is touched, the change is grounded against the durable spec layer. Spec deltas commit BEFORE code commits in Phase 4 — the spec leads, the code follows.

## E. Phasing

For cross-cutting work that touches more than ~8 files, spans more than 2 subsystems, has more than ~12 task bullets, or naturally breaks into milestones: invoke `/phase`. The user-level `phasing` skill at `~/.claude/skills/phasing` decomposes the work into a master plan + per-phase specs + handoffs, gates each phase with plan-mode self-verification, and tracks state in GitHub issues automatically when GitHub mode is selected (the default when a `github.com` remote is present).

**Skip when**: single file, fewer than 5 task bullets, refactor with no new logic, "just do it." Phasing has real overhead — master-plan generation, per-phase specs, verification gates, handoffs. That overhead pays back when the work is genuinely large enough that single-execution risks context rot, and not before.

## F. Verification before completion

Before claiming any task done:

- Run the full test suite (not just the changed-file tests).
- Run typecheck and build.
- Re-read the diff yourself.
- Cross-reference each acceptance criterion against the diff and the test output.

Performative verification — running one test and skipping the rest, or eyeballing the diff without re-reading — is the failure mode. Evidence before assertions, every time.

**Source skill**: `superpowers:verification-before-completion`.

## G. Living documents on every ship

After every `/ship`, update the project's living-doc set in the same commit as the code. The specific list of living docs is **defined per-project** in the project's `<consumer>/CLAUDE.md` "Documentation Requirements" section — this canon does not dictate which files a particular project owns. The rule is universal; the list is local.

**Specs are the highest-priority living doc.** Drift in a spec teaches the wrong thing on the next read — including to the next agent session that grounds itself in `<consumer>/docs/specs/` before touching code. Per §B rule 2, specs ship in the same PR as the code they document. Other living docs (CHANGELOG, README, runbook) follow the same same-commit discipline; specs come first when prioritising what to update under time pressure.

The reason is simple: the cost of a stale doc is higher than the cost of an updated one, because stale docs *teach* errors. New devs read the doc, learn the wrong thing, and proceed confidently in the wrong direction. Coupling the doc update to the code update — same commit, same review — is the only mechanism that scales.

> **Example block — Next.js project (illustrative; consumer's actual list lives in their CLAUDE.md):**
> CHANGELOG, project_status, setup_guide, architecture, PRD, reference_docs, README. Plus user-guide HTML if user-facing behavior changed. The illustrative list is a starting point — every project edits it.

## H. Context discipline

The thresholds below are anchored on prompt-cache mechanics and observed agent behavior under context pressure. The Anthropic prompt-cache has a 5-minute TTL — sleeping past that means the next read is uncached, which is slower and more expensive. Beyond ~70% context fill, observed quality degrades; beyond ~90%, agents start hallucinating from truncated context. The thresholds aren't arbitrary; they're the points at which the next degradation becomes likely.

Why each threshold matters: the 50% mark is a soft attention check — finish the current focused work before adding new scope, otherwise the next jump compresses two threads into one. The 70% mark triggers `/compact` to summarize, which buys back working room without losing the thread. The 90% mark mandates `/clear` because past that point the agent reasons over a truncated view of its own work, and the failure mode is silent.

| Context % | Action |
|---|---|
| 0–50% | Work freely |
| 50–70% | Pay attention; finish current focused work before adding new scope |
| 70–90% | `/compact` to summarize |
| 90%+ | `/clear` (mandatory) |

Plus: `/effort xhigh` for complex work; default to lower for routine work to control cost.

## I. Multi-agent review

The canonical "which reviewer when" mapping lives in `templates/core/cheatsheet.md.template` Appendix A. This methodology cites it; it does not restate it. The mapping is updated when the compound-engineering reviewer roster changes — that's a cheatsheet edit, not a methodology rewrite.

In abstract: layered review for any non-trivial PR — author self-review → `/claude-review` GH Action → one or more specialized reviewer agents (chosen by change shape) → human reviewer signs off. The layering is the rule; the specific reviewer choices are tactical.

**PR review challenges drift-fix claims.** When a PR ticks the "fixes drift, no spec change needed" box (§B rule 5), the reviewer's job is to verify the spec actually documents the behavior in question. If the spec is silent, the change is a behavior change wearing drift-fix clothing, and the spec must update in the same PR (§B rule 2). Over time, repeated examples in past PRs make the rule self-clarify; until then, the reviewer carries it.

## J. MCP discipline

The kit's MCP allowlist + 5-step vetting workflow live in `templates/core/mcp-policy.md.template` and the `mcp-config-integrity.sh` hook. This methodology does not restate them.
