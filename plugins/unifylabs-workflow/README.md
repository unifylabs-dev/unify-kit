# unifylabs-workflow

The Unifylabs team Claude Code plugin. Bundles skills, slash commands, security & workflow hooks, and an opt-in statusline.

Lives in the [unify-kit](https://github.com/unifylabs-dev/unify-kit) marketplace.

## Contents

### Skills (auto-discovered)

| Skill | What it does |
|---|---|
| `work-issue` | Orchestrates GitHub issue-driven dev: 8 gated phases (analysis → branch → planning → strict TDD → verify → tests → review → PR) |
| `ship` | Commits, pushes, opens PR in one command — for ad-hoc changes |
| `phasing` | Decomposes a task into a master plan + per-phase specs; orchestrates execution across fresh sessions |
| `review-prototype` | Analyzes a prototype branch, extracts acceptance criteria, creates a GitHub issue for `/work-issue` to implement |
| `analyze-comms` | Analyzes incoming emails/PDFs/vendor messages against project context; produces structured reports |
| `promote-to-marketplace` | Moves a personal skill or hook from `~/.claude/` into this plugin (maintainer-only) |
| `compliance-research` | (Stub — phase 3 of the unify-kit v2 run implements.) Interactive compliance profile selection + gap analysis using `context7` + `WebSearch` |

### Slash commands

The 9 phase commands that pair with the `phasing` skill:

`/phase`, `/phase-resume`, `/phase-execute`, `/phase-archive`, `/phase-list`, `/phase-retry`, `/phase-status`, `/phase-next`, `/phase-abort`.

### Hooks (auto-wired via `hooks/hooks.json`)

| Hook | Triggers | Purpose |
|---|---|---|
| `pre-commit-secrets.sh` | PreToolUse `Bash(git commit:*)` | Blocks commits containing API keys, tokens, secrets |
| `output-secrets-scanner.sh` | PostToolUse `*` | Scans tool output for leaked secrets |
| `file-guard.sh` | PreToolUse `Edit\|Write` | Blocks edits to credential files (`.env`, `*.pem`, etc.) |
| `dangerous-actions-blocker.sh` | PreToolUse `Bash` | Blocks `rm -rf`, `git reset --hard`, etc. without confirmation |
| `claudemd-scanner.sh` | SessionStart | Audits CLAUDE.md for prompt-injection patterns |
| `mcp-config-integrity.sh` | SessionStart | Detects CVE-2025-54135/54136 patterns in MCP configs |
| `marketplace-drift-check.sh` | SessionStart | Warns if `~/.claude/skills/*` has un-promoted skills (advisory; never blocks) |

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

Current: `2.0.0-pre.1`. Bumps to `2.0.0` when phase 4 of the unify-kit v2 run ships.
