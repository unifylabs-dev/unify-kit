<!--
onboarding/week-1.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
License: CC BY-SA 4.0
Authored: 2026-05-04
-->

# Week 1 — Internalize the canonical workflows

By end of week 1 you should fluently run the canonical workflows, understand the project's test pyramid, and know which reviewers to invoke for which kinds of changes. Week 1 is *soft milestones only* — there's no hard gate the kit enforces at the end. The list at the bottom is for self-assessment.

## 1. Workflows

The kit's canonical command list lives in `templates/cheatsheet.md.template` (the source of truth). This file does not restate it. The five most common in your first week:

- `/work-issue <N>` — issue-tracked work with acceptance criteria. Default for any GitHub issue with checkbox ACs.
- `/brainstorm` → `writing-plans` → `executing-plans` — for ambiguous features and "we should probably…" requests. Brainstorm to surface intent, plan to make implementation reviewable, execute under hard gates.
- `/phase` — cross-cutting work (>8 files, >2 subsystems, >12 task bullets, or natural milestones). Decomposes into a master plan + per-phase specs with verification gates per phase.
- `/lfg` — autonomous mode on well-scoped work where you've already aligned on the approach. Continuous execution; you can interrupt with course corrections.
- `/ship` — final commit + push + PR in one step. Wraps up an end-of-task flow.

Use the cheatsheet — don't memorize. The file is short on purpose so you can re-open it whenever you need a refresher.

## 2. Skills you invoke

The cheatsheet (same file, second table) lists the daily skills: `brainstorming`, `writing-plans` / `executing-plans`, `test-driven-development`, `verification-before-completion`. Read the daily-skills table once and refer back when in doubt about which skill applies. The skills are *rigid* — they tell you exactly when to enter and exit each phase — and that rigidity is the point. Loose discipline plus AI assistance equals sloppy work at scale.

## 3. Reviewers you invoke

The canonical "which reviewer when" mapping lives at `templates/cheatsheet.md.template` Appendix A. The mapping covers TypeScript review, security/permission/credential review, architectural review, error-handling review, and DB-migration review. Read Appendix A before opening your first non-trivial PR. The mapping is updated when the reviewer roster changes — that's a cheatsheet edit, not a methodology rewrite. This curriculum cites Appendix A; it does not restate the list.

## 4. Test pyramid

Your project's testing strategy lives in `<consumer>/CLAUDE.md` (typically under a "Test Strategy" section). Read it in week 1 if you haven't already. Understand which tier (unit / integration / e2e) runs in CI, which tier the team expects you to write for new behavior (typically unit + integration), and the full local suite — what runs, how long it takes. If `<consumer>/CLAUDE.md` doesn't have a Test Strategy section, that's a gap to file an issue against; the project should have one before week 2.

## 5. Documentation rhythm

The doc-on-ship rule: every `/ship` updates the project's living-doc set in the same commit as the code. The specific list (CHANGELOG, project_status, architecture, README, etc.) lives in `<consumer>/CLAUDE.md` "Documentation Requirements" — projects own their list. The principle is uniform: the cost of a stale doc is higher than the cost of an updated one, because stale docs *teach* errors. `docs/methodology.md` §F describes the rule in the kit's voice; `<consumer>/CLAUDE.md` tells you what to update for *this* project specifically. Read both.

## 6. Pair an end-to-end feature

Pick a real feature ticket — not a typo fix. Pair with a senior on your team. Run it through the full flow: brainstorm if ambiguous, plan, TDD, verify, `/claude-review`, get an Appendix A reviewer agent on the diff, ship. The pair-programming step isn't optional in week 1. The flow has too many small judgment calls (when to brainstorm? which reviewer? when does TDD apply?) for a new dev to get them all right solo on the first try. A senior shortcuts a week of trial-and-error into one feature's worth of pairing.

## Week-1 soft milestones

These are advisory, not gates. Use them for self-check at end of week:

- Two `/work-issue` PRs merged.
- One feature run through `/brainstorm` → `writing-plans` → execution.
- Reviewed two teammates' PRs (with `/review` invoked, plus at least one Appendix A reviewer agent).
- Familiarity with the project's test pyramid demonstrated in conversation with your lead.

If you're behind on these, that's signal to talk with your lead — not a kit-enforced failure. The soft framing is deliberate: every project's ticket cadence is different, and a kit-level gate would punish slow-cadence projects for no good reason.
