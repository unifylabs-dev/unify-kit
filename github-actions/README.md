<!--
github-actions/README.md
Sourcing mode: customization (authored — adoption guide for the kit's consumer-facing GH Action)
Authored: 2026-05-04
License: CC BY-SA 4.0 (narrative doc, per specs/00-vision-and-license.md §"License")
-->

# Consumer GitHub Actions

This directory ships ONE workflow that consumers copy into their own repos: a comment-triggered tiered PR-review workflow that runs Claude over the diff and posts findings in three tiers (🔴 / 🟡 / 🟢).

## Overview

`claude-code-review.yml` runs Claude on a PR's diff when a reviewer comments `/claude-review`. The review uses the externalized prompt at `prompts/code-review.md` and posts a tiered summary plus inline comments on specific lines. Quiet by default — runs only when invoked.

## What it ships

- `claude-code-review.yml` — comment-triggered tiered PR-review workflow.
- `prompts/code-review.md` — externalized review prompt with five required sections (Role, Must-check items, Output format, Anti-hallucination, Stack-specific opt-in).

## Adoption flow

1. Copy `claude-code-review.yml` to `.github/workflows/` in your repo.
2. Copy `prompts/code-review.md` to `.github/workflows/prompts/` in your repo.
3. Add the `ANTHROPIC_API_KEY` repo secret. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**. (Alternative: install Anthropic's GitHub App and use `claude_code_oauth_token` instead — see [Secrets](#secrets) below.)
4. Edit `prompts/code-review.md`'s `Stack-specific opt-in` section. Uncomment the blocks that apply to your stack; remove or replace the rest. Add your own conventions in the generic placeholder block.
5. Open a test PR and comment `/claude-review`. Verify the tiered summary comment posts within ~2 minutes.

## Inputs

The workflow exposes three configurable inputs via repo variables (override via **Settings → Secrets and variables → Actions → Variables**) or by editing the `env:` block directly. Each falls back to a documented default if unset.

| Input | Default | Where to set | Purpose |
|---|---|---|---|
| `CLAUDE_MD_PATH` | `./CLAUDE.md` | repo variable or workflow `env:` | Repo-relative path to the project memory file the prompt loads. Missing file → workflow logs a warning and continues without project context. **No tilde expansion** — the workflow runs on `ubuntu-latest` with no shell expansion. |
| `CLAUDE_REVIEW_MODEL` | `claude-opus-4-7` | repo variable | Which Claude model the review uses. Manual bumps only — document each bump in your CHANGELOG. There is no auto-upgrade-bot in v0.1. |
| `CLAUDE_REVIEW_PATHS_IGNORE` | `node_modules/**,dist/**,*.lock` | repo variable | Comma-separated globs to skip when sending the diff to Claude. |

## Secrets

`ANTHROPIC_API_KEY` is required by default. The workflow reads it via `${{ secrets.ANTHROPIC_API_KEY }}`.

**Alternative — Anthropic GitHub App (OAuth):** install Anthropic's GitHub App on your org or repo. The App provides a `claude_code_oauth_token` that the action can use in place of an API key. To switch:

- Replace `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` with `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` in `claude-code-review.yml`.
- Remove the `ANTHROPIC_API_KEY` repo secret if you are not using it elsewhere.

The kit ships with the API-key default because it has fewer setup steps for consumers without Anthropic GitHub App access.

## Verification recipe

The kit does NOT run live PR reviews against itself in CI (recursion + cost — see `specs/04-github-actions.md` §"Acceptance criteria"). Each consumer verifies adoption manually once after copying the workflow:

1. Open a test PR that adds a deliberate small bug. Recommended: a TypeScript file containing the line `const password = 'hunter2'`.
2. Comment `/claude-review` on the PR.
3. Expected: a 🔴 MUST FIX comment within 2 minutes naming the hardcoded credential.

If nothing posts within 5 minutes, check the **Actions** tab → **Claude Code Review** run → step logs. Common failure modes:

- `ANTHROPIC_API_KEY` repo secret not set → action exits early with an auth error in the logs.
- `CLAUDE_MD_PATH` points to a non-existent file → workflow logs a warning and continues without project context (this is informational, not a failure).
- Claude API rate-limited or 5xx → action surfaces the error; retry the `/claude-review` comment after a few minutes.
- Repo runner permissions stripped (`permissions: contents: read` removed) → action cannot read the diff; restore the workflow's `permissions:` block exactly as shipped.

## Out of scope

The following workflow variants are tracked in the kit's `BACKLOG.md` for v1.x:

- `claude-pr-auto-review.yml` — auto-trigger on PR open/synchronize.
- `claude-security-review.yml` — security-focused review with a dedicated prompt.
- `claude-issue-triage.yml` — auto-label and route incoming issues.

Also explicitly out of scope for v0.1: self-hosted runners, replacement of CodeRabbit / SonarQube / similar, and an auto-upgrade-bot for model bumps. See `BACKLOG.md` for status.

## Source attribution

Workflow YAML and prompt structure are based on patterns documented at `github.com/FlorianBruniaux/claude-code-ultimate-guide` (CC BY-SA 4.0 — patterns referenced, expression authored independently per `docs/decisions/0001-hook-bundle-licensing.md`). Prompt structure is pinned to `specs/04-github-actions.md` §"Externalized prompt".

License: MIT for `claude-code-review.yml`; CC0 1.0 for `prompts/code-review.md`; CC BY-SA 4.0 for this README.
