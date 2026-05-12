# Spec 04 — GitHub Actions

> Status: Implemented in v0.2.x
> Depends on: 00 (sourcing modes, glossary), 01 (filename canon), 02 (cheatsheet sourcing for command vocab in the prompt)
> Related: 03 (security mindset), 06 (curriculum's review loop), 09 (kit's own CI lints this workflow's YAML)

## Purpose

Specify the CI workflow the kit ships *to consumers*: comment-triggered tiered PR
review. Plus the externalized prompt and consumer adoption flow.

The kit's own internal CI (which lints these workflow YAMLs and runs against this
repo) is specified separately in spec 09 — not to be confused with what we ship.

## v1 workflow shipped — sourcing mode: `customization`

### `claude-code-review.yml` — comment-triggered tiered PR review

- **Trigger:** PR comment containing `/claude-review`
- **Permissions:** read-only access to PR diff and repo files; can post comments
  and inline review threads
- **Behavior:** Runs Claude over the PR diff with the prompt at
  `prompts/code-review.md`, posts a structured comment with tiered findings:
  - 🔴 **MUST FIX** — correctness, security, data-loss risks
  - 🟡 **SHOULD FIX** — readability, maintainability, test gaps
  - 🟢 **CAN SKIP** — nits and style preferences
- **Output:** one summary comment + inline comments on specific lines for 🔴 / 🟡
  findings

This is the comment-triggered variant — quiet by default, runs only when invoked.
Auto-on-PR variants (`claude-pr-auto-review.yml`, `claude-security-review.yml`,
`claude-issue-triage.yml`) are explicitly out of v1; tracked in `BACKLOG.md` per
spec 08.

## Externalized prompt — `prompts/code-review.md`

Lives outside the YAML so the team can tune review focus without touching workflow
plumbing.

**Required sections (concrete checklist — replaces "comprehensive enough" AC):**

1. **Role** — "You are a senior reviewer for this repo. Read `<consumer>/CLAUDE.md`
   first to understand project conventions."
2. **Must-check items** (the prompt asserts each is examined):
   - Auth guard / permission check present where required
   - Input validation present
   - Tests added for new behavior
   - Error paths handled (no silent failures)
   - Matches existing patterns in the file/dir
   - No anti-hallucination tells (function calls that don't exist, imports of
     non-existent modules)
3. **Output format** — exact structure for the summary comment and inline comments;
   what each tier means.
4. **Anti-hallucination guardrails** — "If you can't determine something from the
   diff alone, say so. Don't invent function signatures or imports."
5. **Stack-specific opt-in blocks** — Next.js Server Action conventions, Prisma
   transaction patterns, audit-logging requirements (consumer uncomments the ones
   that apply). These are clearly labeled as opt-in and consumers strip what they
   don't use.

The kit's own CI (spec 09) asserts these section headers are present in
`prompts/code-review.md` via grep — if any are removed, CI fails.

## Workflow inputs and configuration

The shipped `claude-code-review.yml` exposes these inputs (via `env:` block or
`workflow_dispatch.inputs`):

| Input | Default | Purpose |
|---|---|---|
| `CLAUDE_MD_PATH` | `./CLAUDE.md` | Path the workflow reads to inject project context into the prompt. If file missing, workflow warns and proceeds without project context. |
| `CLAUDE_REVIEW_MODEL` | pinned to `claude-opus-4-7` (or current as of impl time) | Which model to use. Manual-only bumps (no auto-upgrade-bot in v1; bumps land via PR + CHANGELOG entry). |
| `CLAUDE_REVIEW_PATHS_IGNORE` | `node_modules/**,dist/**,*.lock` | Glob patterns to skip. |
| `ANTHROPIC_API_KEY` | required repo secret | Auth. OAuth via Anthropic's GitHub App is documented as an alternative. |

Tilde paths in `CLAUDE_MD_PATH` are not supported — workflow runs on `ubuntu-latest`
runners with no shell expansion of tilde. Consumers use repo-relative paths only.

## Repo secrets / configuration

A consumer adopting this workflow needs:

- `ANTHROPIC_API_KEY` repo secret (or OAuth token if using Anthropic's GitHub App)
- Optional: override `CLAUDE_REVIEW_MODEL` repo variable
- Optional: override `CLAUDE_REVIEW_PATHS_IGNORE` repo variable

## Adoption flow (in `github-actions/README.md`)

1. Copy `claude-code-review.yml` to `.github/workflows/`
2. Copy `prompts/code-review.md` to `.github/workflows/prompts/`
3. Add `ANTHROPIC_API_KEY` repo secret
4. Edit `prompts/code-review.md` for project-specific stack opt-in blocks
5. Open a test PR and comment `/claude-review`; verify tiered comment posts

## Decisions needed

All workflow-level decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | PR review mode for v1 | Comment-trigger only (`claude-code-review.yml`). Auto-on-PR variants deferred to BACKLOG. |
| 2 | Security review workflow | Deferred to BACKLOG. (Spec 03's hooks cover the security floor.) |
| 3 | Issue triage workflow | Deferred to BACKLOG. |
| 4 | OAuth vs API key | Document both. Default examples use API key. |
| 5 | Model pinning | Pin to `claude-opus-4-7` (or current) in v1. Manual bumps documented in CHANGELOG. No auto-upgrade-bot. |

## Out of scope

- CI runners other than GitHub Actions.
- Self-hosted runners.
- Replacing CodeRabbit, SonarQube, or other commercial review tools.
- Auto-upgrade-bot for model bumps (manual via CHANGELOG).

## Acceptance criteria

- `github-actions/claude-code-review.yml` is valid YAML, lints clean against
  `actionlint` (gated by spec 09's lint workflow).
- `github-actions/prompts/code-review.md` contains all five required section
  headers (Role, Must-check items, Output format, Anti-hallucination, Stack-specific
  opt-in). Verified by grep in spec 09's lint workflow.
- `github-actions/README.md` includes copy-paste install instructions, secrets
  setup, and a manual verification recipe ("comment `/claude-review` on a PR;
  expect a tiered comment within N minutes").
- Manual verification: a test PR in a sandbox repo (which the kit links to but does
  not maintain inline) posts the tiered review comment after `/claude-review`. This
  acceptance is documented in `github-actions/README.md` as a one-time setup check
  for the consumer; the kit itself doesn't run live PR reviews against itself in v1
  CI (recursion + cost).

## Revisions

Addressed: R-012 (concrete must-check checklist replaces "comprehensive enough" AC;
section-header grep gated by kit CI), R-019 (decision #5 cleaned up — pin + manual
bumps + no phantom upgrade-bot), R-020 (v2 stretch workflows removed from spec body;
moved to BACKLOG), R-021 (`CLAUDE_MD_PATH` workflow input added with graceful
missing-file handling).

**v0.3 revision (2026-05-04):** workflow YAML reclassified from `verbatim` to
`customization` for the same upstream-license reason as the hook bundle and
`audit-scan.sh` (CC BY-SA 4.0 not CC0). Header attribution wording changed from
`Source:` (verbatim) to `Pattern reference:` (customization). The kit authors
the workflow expression originally; the upstream
`github.com/FlorianBruniaux/claude-code-ultimate-guide/examples/github-actions/`
is cited as conceptual prior art only. See
[`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md)
— that ADR's scope is extended to cover GH Actions YAML; the reasoning is
identical (share-alike incompatible with the kit's MIT-for-code policy).
