# unifylabs-workflow

The Unifylabs team Claude Code plugin. Bundles skills, slash commands, security & workflow hooks, and an opt-in statusline.

Lives in the [unify-kit](https://github.com/unifylabs-dev/unify-kit) marketplace.

## Contents

### Skills (auto-discovered)

| Skill | What it does |
|---|---|
| `work-issue` | Orchestrates GitHub issue-driven dev: 8 gated phases (analysis → branch → planning → strict TDD → verify → tests → review → PR) |
| `spec-it` | Front-door to `/work-issue`: turns a raw feature idea into a `/work-issue`-ready GitHub issue with an embedded draft spec, grounded in repo + memory + external standards research. 11 gated phases. Adapts to the target repo's spec conventions (optics-style, unify-kit-style, ADR-style, or bootstrap). Both code and non-code deliverables. |
| `ship` | Commits, pushes, opens PR in one command — for ad-hoc changes |
| `phasing` | Decomposes a task into a master plan + per-phase specs; orchestrates execution across fresh sessions |
| `extract-prototype-review` | Extracts acceptance criteria + visual specs from a sanctioned prototype branch and creates a GitHub issue for `/work-issue` to implement (formerly `review-prototype`) |
| `integrate-branch` | Audits an external/untrusted branch against project standards + cross-cutting impact, then routes to salvage / rebuild / discard |
| `analyze-comms` | Analyzes incoming emails/PDFs/vendor messages against project context; produces structured reports |
| `promote-to-marketplace` | Moves a personal skill or hook from `~/.claude/` into this plugin (maintainer-only) |
| `compliance-research` | Interactive compliance profile selection + gap analysis using `context7` + `WebSearch` |
| `iterative-review` | Iterative review-fix-verify loop for code, docs, and phasing-run artifacts; severity-gated stopping with a 3-iteration cap |
| `humanizer` | Removes signs of AI-generated writing from text (based on Wikipedia's "Signs of AI writing") |
| `handoff` | Writes a structured session-handoff doc so a fresh Claude session can resume cold; also handles the resume side (`/handoff-resume`, `/handoff-list`, …) |

### Slash commands

16 commands total — 10 `phase*` commands that pair with the `phasing` skill, the `iterative-review` command, and 5 `handoff*` commands:

- **Phasing (10):** `/phase`, `/phase-abort`, `/phase-archive`, `/phase-continue`, `/phase-execute`, `/phase-list`, `/phase-next`, `/phase-resume`, `/phase-retry`, `/phase-status`
- **Review (1):** `/iterative-review`
- **Handoff (5):** `/handoff`, `/handoff-done`, `/handoff-list`, `/handoff-resume`, `/handoff-revive`

### Hooks (auto-wired via `hooks/hooks.json`)

8 hooks total: 7 security/integrity hooks + the `context-awareness` UX hook.

| Hook | Triggers | Purpose |
|---|---|---|
| `pre-commit-secrets.sh` | PreToolUse `Bash(git commit:*)` | Blocks commits containing API keys, tokens, secrets |
| `output-secrets-scanner.sh` | PostToolUse `*` | Scans tool output for leaked secrets |
| `file-guard.sh` | PreToolUse `Edit\|Write` | Blocks edits to credential files (`.env`, `*.pem`, etc.) |
| `dangerous-actions-blocker.sh` | PreToolUse `Bash` | Blocks unambiguously destructive Bash patterns: rooted `rm -rf /`, SQL `DROP DATABASE/TABLE/SCHEMA`, `chmod 777 /`, `dd` to block devices, `find / ... -delete`, `mkfs.* /dev/*` |
| `claudemd-scanner.sh` | SessionStart | Audits CLAUDE.md for prompt-injection patterns |
| `mcp-config-integrity.sh` | SessionStart | Detects CVE-2025-54135/54136 patterns in MCP configs |
| `marketplace-drift-check.sh` | SessionStart | Warns if `~/.claude/skills/*` has un-promoted skills (advisory; never blocks) |
| `context-awareness.sh` | UserPromptSubmit, SessionStart | Window-fraction context-pressure reminders (awareness, not authorization) + pending-handoff resume prompts |

### Statusline (opt-in)

`statusline/statusline.sh` renders `[Model] [branch]  ▓░░ XX%  Y∆  cwd`. Activate by adding to `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "${CLAUDE_PLUGIN_ROOT}/statusline/statusline.sh"
}
```

Requires `jq` and `git` on PATH.

## Install

```
/plugin marketplace add unifylabs-dev/unify-kit
/plugin install unifylabs-workflow
```

Skills, commands, and hooks load on the next session.

## Curated companion plugins

The [`unify-kit` README](../../README.md) lists the external plugins (superpowers, supabase, the Vercel suite) that pair well with `unifylabs-workflow` for new projects. Install them from their own marketplaces.

## Versioning

Current: `2.0.3`.
