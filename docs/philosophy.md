<!--
docs/philosophy.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
The Five Golden Rules concept is inherited from the Ultimate Guide as a pattern;
prose is authored.
License: CC BY-SA 4.0 (narrative docs ship CC BY-SA 4.0 per specs/00-vision-and-license.md §"License")
Authored: 2026-05-04
-->

# Philosophy

This is the *why* behind every other component of the kit. Five principles, deliberately cut from a longer list, that should outlast any specific tool, plugin, or workflow we ship today. Read this once and orient permanently; re-read `docs/methodology.md` after meaningful kit updates.

## Hierarchy of authority

When guidance conflicts:

```
<consumer>/CLAUDE.md          ← always wins for project-specific rules
  > docs/methodology.md       ← wins over plugin defaults for shared workflows
  > superpowers / compound-engineering skill defaults
  > Claude Code defaults
```

A consumer override in `<consumer>/CLAUDE.md` always wins. The kit's methodology is advisory but uniform; plugin defaults are uniform but generic; Claude Code defaults are last-resort. Cite this rule whenever an agent (or a teammate) asks "but the skill says X" — the question becomes "what does *this* project's CLAUDE.md say?"

## Principles

### 1. Verification before assertion

Don't claim work is done until you've shown evidence. Tests passing, types compiling, the diff re-read against acceptance criteria, the build succeeding — those are evidence. "It looks right" is not. AI plus undisciplined claims ships broken work that *looks* fine, which is the worst failure mode because it survives review and lands in production. Tools don't fix this on their own; they encode the checks an undisciplined human would skip and an AI agent will skip if you let it.

Tools encoding this: `superpowers:verification-before-completion` skill, `/work-issue` Phase 5 (the verification gate before review), `github-actions/claude-code-review.yml` (the consumer-shipped tiered PR-review workflow).

### 2. Methodology amplifies — both ways

TDD, brainstorming, planning, phasing aren't friction — they're the discipline that makes AI assistance compound. Skipping them in the name of speed makes the work *look* fast and *be* worse. AI amplifies whatever discipline you have, including the bad: a sloppy plan executed by an agent produces sloppy code at scale. The corollary holds too — a careful plan executed by an agent produces careful code at scale, which is a result no individual contributor reaches solo.

Tools encoding this: `superpowers:brainstorming`, `superpowers:writing-plans` + `superpowers:executing-plans`, `superpowers:test-driven-development`, the user-level `phasing` skill at `~/.claude/skills/phasing`.

### 3. Living documents over frozen specs

`<consumer>/CLAUDE.md`, the team's onboarding doc, this kit itself — all evolve. The cost of a stale doc is higher than the cost of an updated one, because stale docs *teach* errors. A new dev reads the doc, learns the wrong thing, and proceeds with confidence in the wrong direction. Hard rule: docs update *with* the code, in the same commit. The implementation is the source of truth, but the doc is what people learn from — keep them in sync or one of them is lying.

Tools encoding this: `docs/methodology.md` §G (the doc-on-ship rule), `<consumer>/CLAUDE.md`'s Documentation Requirements section (the project-specific list of living docs), the kit's own `changelog-check.yml` workflow (CI-enforces per-PR `[Unreleased]` updates).

### 4. Plain text, plain markdown, no magic

Templates use `{{NAME}}` placeholders — one syntax, mandatory, no alternatives. Hooks are readable shell scripts. Configs are plain JSON. A consumer should never have to debug a templating engine, learn a custom DSL, or unwind a clever abstraction to ship. Plain text means you can `grep` it, `diff` it, paste it into a code review, and explain it to a teammate in one sentence. Magic — clever syntax, hidden lifecycles, "you don't need to understand this part" — fails at the worst times and leaves consumers stranded.

Tools encoding this: the `{{NAME}}` placeholder canon (`specs/02-templates.md`), the six security hooks under `hooks/` (each a single-purpose shell script), the bootstrap script's plain-JSON merge into `~/.claude/settings.json`.

### 5. Security as default, not afterthought

Hooks block destructive actions and credential leaks **before** anyone has to remember to be careful. Onboarding installs them on day one; the team's `~/.claude/settings.json` has them registered before the first commit. Default-on beats opt-in, because opt-in security is the security people don't have when they need it. The same logic applies to the kit's own CI — scrub-checks, lint, link-check, fixture tests run on every PR, not "when we remember."

Tools encoding this: the six security hooks (`dangerous-actions-blocker.sh`, `pre-commit-secrets.sh`, `output-secrets-scanner.sh`, `file-guard.sh`, `claudemd-scanner.sh`, `mcp-config-integrity.sh`), `scripts/audit-scan.sh`, the kit's own `scrub-check.yml` workflow.
