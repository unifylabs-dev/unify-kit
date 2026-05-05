# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `github-actions/claude-code-review.yml` — comment-triggered (`/claude-review`) tiered PR-review workflow. Read-only permissions (contents:read + pull-requests/issues:write); pinned to `claude-opus-4-7`; configurable via `CLAUDE_MD_PATH` / `CLAUDE_REVIEW_MODEL` / `CLAUDE_REVIEW_PATHS_IGNORE` repo variables; `ANTHROPIC_API_KEY` secret required (OAuth via Anthropic GitHub App documented as alternative). [P4]
- `github-actions/prompts/code-review.md` — externalized review prompt with the five mandated H2 sections (Role / Must-check items / Output format / Anti-hallucination / Stack-specific opt-in). Tiered output 🔴 MUST FIX / 🟡 SHOULD FIX / 🟢 CAN SKIP. Stack-specific opt-in section includes commented-out blocks for Next.js Server Action / audit logging / rate limiting / middleware patterns plus a generic placeholder. [P4]
- `github-actions/README.md` — adoption guide with 5-step install flow, inputs table, secrets setup (API key + OAuth alternative), verification recipe, BACKLOG of deferred workflows, source attribution. [P4]
- `templates/cheatsheet.md.template` — single-page pocket reference and source of truth for the kit's command vocabulary (8 daily commands), daily skills (4), context-discipline thresholds, and reviewer-agent mapping (Appendix A). Body 54 lines — fits one US-letter page at 12pt; Appendix A is the only spillable section. Sourcing mode: `customization`. [P5]
- `templates/claude.md.template` — minimal stack-agnostic 8-section project memory file (Project Overview / Architecture / Conventions / Issue-Driven Development / TDD Enforcement / Test Strategy / Documentation Requirements / Living Document Rules). Stack-specific patterns explicitly deferred to `templates/snippets/`. Sourcing mode: `customization`. [P5]
- `templates/llms.txt.template` — standard `llms.txt` skeleton (≤1K tokens) with Stack / Key files / Key conventions / How to ask for help sections. Sourcing mode: `pattern-only`. [P5]
- `templates/ai-usage-charter.md.template` — 6-section AI usage charter with the hard rule that AI-generated code passes the same review as human code (relax via ADR only). Sourcing mode: `customization`. [P5]
- `templates/mcp-policy.md.template` — 5-section MCP policy: empty allowlist + 5-step vetting workflow (provenance → code review → permissions → testing → monitoring) + add/remove process + scoping. Sourcing mode: `pattern-only`. [P5]
- `templates/security-checklist.md` — OWASP Top-10 spine (A01–A10) with one-paragraph framing + actionable checks per category, plus a labeled `## Stack example: Next.js` block linking to the four snippets. Sourcing mode: `customization` (reclassified from `verbatim-with-light-edit` per ADR 0001 precedent). [P5]
- `templates/team-onboarding.md.template` — 5-section onboarding stitcher (welcome / required reading / day-1/week-1/day-30 / bootstrap pointer / area-owners table). Cross-references the cheatsheet and the kit's onboarding curriculum. Sourcing mode: `customization`. [P5]
- `templates/snippets/server-action-anatomy-nextjs.md` — Next.js Server Action 6-step anatomy (auth-guard → validate → audit-start → business → audit-success → return) with a generic-named TypeScript skeleton. Sourcing mode: `customization`. [P5]
- `templates/snippets/audit-logging-nextjs.md` — `logAudit({ event, actor, target, metadata })` fire-and-forget pattern; non-blocking, errors don't propagate, no secrets in entries. Sourcing mode: `customization`. [P5]
- `templates/snippets/rate-limiting-nextjs.md` — `checkRateLimit(key, limit, windowMs)` + `timingSafeDelay(targetMs)` for public endpoints; defends against brute force AND timing-side-channel leaks. Sourcing mode: `customization`. [P5]
- `templates/snippets/middleware-nextjs.md` — Next.js 14+ middleware for dual-session + idle-timeout pattern. Identifies actors; does not authorize. Sourcing mode: `customization`. [P5]
- `templates/README.md` — index: Overview / Templates table (11 rows) / Placeholder vocabulary table (16 rows) / Usage / Sourcing modes / "the cheatsheet is the source of truth". Sourcing mode: `customization`. [P5]

### Changed
- Reclassified `github-actions/claude-code-review.yml` sourcing mode from `verbatim` (per `specs/04-github-actions.md` body) to `customization` per ADR 0001 precedent — upstream `FlorianBruniaux/claude-code-ultimate-guide` is CC BY-SA 4.0, incompatible with the kit's MIT-for-code policy. Patterns documented; expression authored independently. Spec 04 body should be updated in a follow-up to reflect this reclassification. [P4]
- Reclassified `templates/security-checklist.md` sourcing mode from `verbatim-with-light-edit` (per `specs/02-templates.md` §5) to `customization` per ADR 0001 precedent — same upstream-license incompatibility. The 3-bullet diff intent is preserved (kept OWASP Top-10 spine; dropped threat-db / malicious-skills catalog references; added labeled Next.js stack example block) but every word of prose is originally authored. Spec 02 §5 body should be updated in a follow-up to reflect this reclassification, and ADR 0001's "Affected files" should extend to cover spec 02 §5. [P5]

### Deprecated
### Removed
### Fixed
### Security

<!--
New entries land here per-PR. The kit's own CI (.github/workflows/changelog-check.yml) will fail any PR that touches templates/, hooks/, scripts/, github-actions/, specs/, or docs/methodology.md|philosophy.md without updating [Unreleased]. Use [skip-changelog] in PR title to bypass for purely infrastructural PRs.
-->
