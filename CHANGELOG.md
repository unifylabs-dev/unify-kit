# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `github-actions/claude-code-review.yml` — comment-triggered (`/claude-review`) tiered PR-review workflow. Read-only permissions (contents:read + pull-requests/issues:write); pinned to `claude-opus-4-7`; configurable via `CLAUDE_MD_PATH` / `CLAUDE_REVIEW_MODEL` / `CLAUDE_REVIEW_PATHS_IGNORE` repo variables; `ANTHROPIC_API_KEY` secret required (OAuth via Anthropic GitHub App documented as alternative). [P4]
- `github-actions/prompts/code-review.md` — externalized review prompt with the five mandated H2 sections (Role / Must-check items / Output format / Anti-hallucination / Stack-specific opt-in). Tiered output 🔴 MUST FIX / 🟡 SHOULD FIX / 🟢 CAN SKIP. Stack-specific opt-in section includes commented-out blocks for Next.js Server Action / audit logging / rate limiting / middleware patterns plus a generic placeholder. [P4]
- `github-actions/README.md` — adoption guide with 5-step install flow, inputs table, secrets setup (API key + OAuth alternative), verification recipe, BACKLOG of deferred workflows, source attribution. [P4]

### Changed
- Reclassified `github-actions/claude-code-review.yml` sourcing mode from `verbatim` (per `specs/04-github-actions.md` body) to `customization` per ADR 0001 precedent — upstream `FlorianBruniaux/claude-code-ultimate-guide` is CC BY-SA 4.0, incompatible with the kit's MIT-for-code policy. Patterns documented; expression authored independently. Spec 04 body should be updated in a follow-up to reflect this reclassification. [P4]

### Deprecated
### Removed
### Fixed
### Security

<!--
New entries land here per-PR. The kit's own CI (.github/workflows/changelog-check.yml) will fail any PR that touches templates/, hooks/, scripts/, github-actions/, specs/, or docs/methodology.md|philosophy.md without updating [Unreleased]. Use [skip-changelog] in PR title to bypass for purely infrastructural PRs.
-->
