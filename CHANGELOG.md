# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `specs/10-sdd-layer.md` proposing an SDD layer (module + journey + specs-README templates, methodology §B SDD section, §D expansion with the `/work-issue` 8-phase contract, BDD-Lite snippet, two new placeholders). Spec only; implementation lands in a follow-up PR.
- Add `templates/specs/module.md.template` + `templates/specs/journey.md.template` + `templates/specs/README.md.template` — durable spec templates for consumer use (implements `specs/10-sdd-layer.md` Batch A).
- Add `docs/methodology.md` §B "Specification-Driven Development" — three-layer mental model (SDD + BDD-Lite + TDD), vocabulary, seven hard rules, drift-fix decision tree, lazy-bootstrap rule, BDD-Lite naming convention. Existing §B–I renumber to §C–J. §D (Issue-driven dev) expanded with the `/work-issue` 8-phase contract (Phase 0 Spec Sync through Phase 7 PR creation).
- Add `templates/snippets/bdd-lite-test-naming.md` — BDD-Lite test naming convention with Playwright example and adaptation notes for other runners.
- Add `specs/11-github-templates.md` proposing GitHub repo scaffolding (PR template + feature-request and bug-report issue templates; manual `cp` install via `templates/README.md`; BACKLOG cleanup of v1.0.0 release-prep bullets that ship earlier). Spec only; implementation lands in a follow-up PR.

### Changed

- Expand placeholder vocabulary from 16 to 18: `{{DATA_MODEL_PATH}}` and `{{TEST_E2E_DIR}}` added (`specs/02-templates.md`, `templates/README.md`, `.github/workflows/scrub-check.yml`).
- Update `/work-issue` 8-phase wording in `templates/cheatsheet.md.template`, `templates/claude.md.template`, and `specs/02-templates.md`: the kit's prior redundant `review` step collapses into `PR creation` to fit Phase 0 (Spec Sync) at the front. Canonical phase list is now `spec sync → analysis → branch → planning → TDD → verification → review prep → PR creation`.

### Deprecated
### Removed
### Fixed
### Security

<!--
New entries land here per-PR. The kit's own CI (.github/workflows/changelog-check.yml) will fail any PR that touches templates/, hooks/, scripts/, github-actions/, specs/, or docs/methodology.md|philosophy.md without updating [Unreleased]. Use [skip-changelog] in PR title to bypass for purely infrastructural PRs.
-->

## [0.1.3] — 2026-05-06

Patch release fixing one shellcheck warning introduced by v0.1.2's `bootstrap-fixture` Step 6 rewrite.

### Fixed

- **`bootstrap-fixture.yml` Step 6** — replaced `ls "$target".bak.*` with `find "$(dirname "$target")" -maxdepth 1 -name "$(basename "$target").bak.*"` to silence shellcheck SC2012 (`Use find instead of ls to better handle non-alphanumeric filenames`). The `actionlint` job in `lint.yml` runs shellcheck against `run:` blocks; SC2012 is a default-warning that gets promoted to fail under our `-e SC2086,SC2155`-only suppression policy. Repro: GH Actions run 25457890463. [v0.1.2 → v0.1.3]

## [0.1.2] — 2026-05-06

Patch release fixing one CI workflow bug that surfaced on v0.1.1's run.

### Fixed

- **`bootstrap-fixture.yml` Step 6** rewrote to test the `--force` semantics that `scripts/bootstrap-claude-config.sh` actually implements: file-level overwrite of tampered kit hook `.sh` files (with `<hook>.sh.bak.<ts>` backup), restoring the original kit content via SHA-256 manifest comparison. The previous form simulated a `settings.json` entry-level tamper (changing a `command` path) and expected `--force` to remove it — but the bootstrap script's merge algorithm is append-only-dedup-by-command-string, so the user's edit was preserved alongside the kit's intended command. Entry-level `--force` semantics for `settings.json` is a known gap between spec 05's intent and the v0.1.x implementation; tracked in BACKLOG.md as a v0.2.0 candidate (would require manifest-aware merge logic). Repro: GH Actions run 25457680335. [v0.1.1 → v0.1.2]

### Changed

- `BACKLOG.md` — added entry under "Stretch scripts" for entry-level `--force` semantics in `settings.json` merge (currently file-level only). [v0.1.2]

## [0.1.1] — 2026-05-06

Patch release fixing two CI workflow bugs that surfaced on the first remote run of `v0.1.0` against GitHub-hosted `ubuntu-latest` runners.

### Fixed

- **`bootstrap-fixture.yml` Step 3**: dropped a backup-count assertion (`backups -lt 1 → ERROR`) that fired against the actually-correct behavior of the bootstrap script on a clean install. Step 1 pre-seeds the fake home with the good-fixture (which already contains all six kit hooks correctly registered), so when Step 3 runs `bootstrap-claude-config.sh` the script correctly identifies "no merge needed / settings.json: up-to-date / Backups: none" and writes nothing. The backup assertion belongs in Step 6 (the `--force` path, where a backup actually fires) and is already present there. Repro: GH Actions run 25457513513 on `ubuntu-latest`. [v0.1.0 → v0.1.1]
- **`lint.yml` link-check**: dropped `--exclude-mail` from the lychee args. Lychee v0.23.0 (the latest stable as of 2026-05-06) renamed/removed this flag — current API is `--include-mail` (default OFF, opt-in). The kit's intent is to skip mail links, which is the new default; removing the flag preserves the intent. Repro: GH Actions run 25457513522 on `ubuntu-latest`. [v0.1.0 → v0.1.1]

## [0.1.0] — 2026-05-05

Initial development release of unify-kit. Eight-phase delivery: foundation files, security hooks, bootstrap script, consumer GitHub Action, templates, authored docs + onboarding, the kit's own CI, and this release polish.

### Added

**Summary of v0.1.0 deliverables:**

- Foundation files: `LICENSE` (MIT + CC0 + CC BY-SA breakdown), `CHANGELOG.md`, `CONTRIBUTING.md` (spec-first contribution flow), `BACKLOG.md`. [P1]
- Six security hooks (lifted from CC0 sources, with provenance headers and ADR 0001 covering license reclassification): `dangerous-actions-blocker.sh`, `pre-commit-secrets.sh`, `output-secrets-scanner.sh`, `file-guard.sh`, `claudemd-scanner.sh`, `mcp-config-integrity.sh`. Plus `hooks/settings-snippet.json` and `hooks/README.md` (manual-test recipes per hook + `CLAUDE_HOOKS_DISABLE` / `CLAUDE_HOOKS_LOG` documentation). [P2]
- Bootstrap script: `scripts/bootstrap-claude-config.sh` (idempotent, `--dry-run` + `--force`, mandatory backups, manifest writer at `~/.claude/.unify-kit-manifest.json`) + `scripts/README.md` (3 worked examples: clean install / additive install / idempotent re-run). [P3]
- Audit-scan: `scripts/audit-scan.sh` (sourced from upstream + kit-additions block: `inline-credential`, `unrestricted-mcp`, `missing-hook-file` checks) + test fixtures (`scripts/test-fixtures/settings.json.{good,bad}-fixture`). [P2]
- Consumer GitHub Action: `github-actions/claude-code-review.yml` (comment-triggered tiered review) + `github-actions/prompts/code-review.md` (5 required H2 headers) + `github-actions/README.md`. [P4]
- Templates: `cheatsheet.md.template` (source of truth), `claude.md.template` (minimal stack-agnostic 8-section), `llms.txt.template`, `ai-usage-charter.md.template`, `mcp-policy.md.template`, `security-checklist.md`, `team-onboarding.md.template`, plus 4 Next.js snippets in `templates/snippets/` and `templates/README.md` index. [P5]
- Authored docs: `docs/philosophy.md` (5 numbered principles), `docs/methodology.md` (sections A–G full + H/I as pointers, hierarchy-of-authority rule at top), `docs/decisions/README.md` (ADR index + lightweight format). [P6]
- Onboarding curriculum: `onboarding/README.md`, `day-1.md` (4 hard gates), `week-1.md` (soft milestones), `day-30.md` (retro + autonomy markers — no hard gates). [P6]
- Kit's own CI: 4 workflows (`.github/workflows/{lint,scrub-check,bootstrap-fixture,changelog-check}.yml`) + `.markdownlint.json` + `scripts/ci/run-hook-recipes.sh`. [P7]
- Release polish: implementation-centric root `README.md` (with 4 status badges) + `llms.txt` (~440 words describing the kit itself). [P8]

**Per-PR detail (audit trail):**

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
- `docs/philosophy.md` — kit's core philosophy: 5 numbered principles (Verification before assertion / Methodology amplifies / Living documents / Plain text, plain markdown, no magic / Security as default) plus the hierarchy-of-authority rule (`<consumer>/CLAUDE.md > docs/methodology.md > superpowers / compound-engineering skill defaults > Claude Code defaults`). Each principle ends with a one-line `Tools encoding this:` citation. Sourcing mode: `pattern-only`. [P6]
- `docs/methodology.md` — kit's operational canon: hierarchy-of-authority repeated at top + sections A–G in full (Brainstorming-then-planning / TDD / Issue-driven development / Phasing / Verification before completion / Living documents on every ship / Context discipline) + sections H and I as one-line pointers to `templates/cheatsheet.md.template` Appendix A and `templates/mcp-policy.md.template` respectively. §F's project-specific list lives inside one labeled illustrative blockquote only; §G's threshold table is accompanied by a rationale paragraph anchored on prompt-cache 5-min TTL and observed agent behavior; §H contains zero named compound-engineering reviewer agents per spec 07 acceptance. Sourcing mode: `pattern-only`. [P6]
- `docs/decisions/README.md` — ADR index + lightweight format documentation (7 fields per `specs/08-living-docs-and-decision-log.md` §2) + when-to / when-not-to bullets + filename canon (`NNNN-<lowercase-hyphenated-slug>.md`) + index pre-populated with the row for ADR 0001 (which already exists as `docs/decisions/0001-hook-bundle-licensing.md`) + EXAMPLE ADR scaffold numbered `0099` so it cannot be confused with real ADRs. Net-new file (no upstream pattern; format itself documented in spec 08). [P6]
- `onboarding/README.md` — curriculum overview (~150 words): audience (new dev joining a kit-adopting project), pre-requisites, file order (`day-1` → `week-1` → `day-30`), customization pointer to `templates/team-onboarding.md.template`. Sourcing mode: `pattern-only`. [P6]
- `onboarding/day-1.md` — day-1 curriculum: 5 numbered sections (machine setup → bootstrap → required reading → verify tooling → ship trivial) + `## Day-1 hard gates` (4 objectively verifiable checkbox items: `bootstrap-claude-config.sh` exits 0, `audit-scan.sh` exits 0, first PR opened, `/claude-review` tiered comment posted) + `## Day-1 soft guidance` (read `<consumer>/CLAUDE.md` / join channel / pair with senior — bulleted, not gated, per spec 06 R-025). Sourcing mode: `pattern-only`. [P6]
- `onboarding/week-1.md` — week-1 curriculum: 6 sections (Workflows / Skills you invoke / Reviewers you invoke / Test pyramid / Documentation rhythm / Pair an end-to-end feature). Cites `templates/cheatsheet.md.template` for the canonical command list, daily skills, and Appendix A reviewer mapping — does NOT restate per spec 06 R-026. `## Week-1 soft milestones` is bulleted (NO checkbox gates) per spec 06 #5. Sourcing mode: `pattern-only`. [P6]
- `onboarding/day-30.md` — day-30 retro (~400 words): one short paragraph soft retrospective ("one conversation, one paragraph in writing — no structured form") + `## Autonomy markers` (3 descriptive bullets, NOT gated) + `## Updates to the kit` pointer + `## No hard gates at day 30` closer. NO checkbox gates, NO bulleted retro prompts per spec 06 R-027. Sourcing mode: `pattern-only`. [P6]
- `.github/workflows/lint.yml` — kit's own lint workflow with 6 jobs: shellcheck (hooks/, scripts/, scripts/ci/), actionlint (.github/workflows/ + github-actions/), markdownlint (docs / specs / templates / root), lychee internal-link check, JSON schema validation of `hooks/settings-snippet.json`, and a grep step asserting the 5 required H2 headers in `github-actions/prompts/code-review.md`. Self-validating: actionlint runs against this file too. Permissions: `contents: read` only. [P7]
- `.github/workflows/scrub-check.yml` — forbidden-strings + placeholder-vocabulary scan. Forbidden-strings job iterates the 10-pattern list from spec 09 §2 across the shipped-artifact scope (templates/, hooks/, github-actions/, scripts/ excluding test-fixtures/, README.md, CHANGELOG.md, CONTRIBUTING.md, docs/philosophy.md, docs/methodology.md, llms.txt if present). Placeholder-vocab job asserts every `{{...}}` in templates/ is in the 16-placeholder supported vocabulary AND every supported placeholder appears in at least one template. Permissions: `contents: read`. [P7]
- `.github/workflows/bootstrap-fixture.yml` — 9-step idempotency + hook-firing test against the P3 bootstrap script and P2 fixtures. Triggers: PR paths hooks/**, scripts/**, templates/**, plus push to main and weekly cron. Steps mirror spec 09 §3 verbatim: isolated `$RUNNER_TEMP/fake-home` setup, clean install with backup + executable + registration assertions, idempotent re-run with `no changes` marker, dry-run on a fresh fake home, `--force` after manual edit with backup-count assertion, per-hook recipes via `scripts/ci/run-hook-recipes.sh`, audit-scan against good-fixture (exit 0) and bad-fixture (exit 2 with `inline-credential` / `unrestricted-mcp` / `missing-hook-file` findings). Permissions: `contents: read`. [P7]
- `.github/workflows/changelog-check.yml` — per-PR `[Unreleased]` discipline (spec 09 §4). PRs touching templates/, hooks/, scripts/, github-actions/, specs/, docs/methodology.md, or docs/philosophy.md must add to CHANGELOG.md `[Unreleased]`. Bypass via `[skip-changelog]` in PR title. Uses `fetch-depth: 0` for full base/head diff; reads PR title + base/head SHAs from `github.event.pull_request` via env vars. Permissions: `contents: read`. [P7]
- `.markdownlint.json` — markdownlint config with sane defaults: `default: true` plus `MD013` (line length), `MD033` (inline HTML), and `MD041` (first line heading) disabled — the kit's specs and docs are long, sourcing-mode comments use HTML, and many files lead with HTML comment headers. [P7]
- `scripts/ci/run-hook-recipes.sh` — CI helper that extracts each fenced bash block under `## Manual-test recipes` in `hooks/README.md` to numbered tempfiles and runs them with `HOME` overridden to a caller-supplied isolation dir. Detects skip markers (`# (manual: ...)` / `# requires live claude session`) and PASS/FAIL stdout markers; exits non-zero on any non-skipped recipe failure. Sourcing mode: `net-new`. [P7]
- `README.md` (rewritten) — implementation-centric framing: hero + tagline + 4 status badges (one per workflow) + What it is + What's in the box + Quick start (4 steps) + Status (v0.1.0 development release) + Compatibility + License + Contributing + Acknowledgments. Replaces the previous "pre-development, specs hardened" framing. [P8]
- `llms.txt` (new) — ~440 words describing unify-kit itself for any LLM tool reading the kit's repo. Sections: What this is / Stack / Key directories / Key conventions / How to ask for help / License / Status. ≤1K tokens (well under the cap). [P8]

### Changed
- Reclassified `github-actions/claude-code-review.yml` sourcing mode from `verbatim` (per `specs/04-github-actions.md` body) to `customization` per ADR 0001 precedent — upstream `FlorianBruniaux/claude-code-ultimate-guide` is CC BY-SA 4.0, incompatible with the kit's MIT-for-code policy. Patterns documented; expression authored independently. Spec 04 body should be updated in a follow-up to reflect this reclassification. [P4]
- Reclassified `templates/security-checklist.md` sourcing mode from `verbatim-with-light-edit` (per `specs/02-templates.md` §5) to `customization` per ADR 0001 precedent — same upstream-license incompatibility. The 3-bullet diff intent is preserved (kept OWASP Top-10 spine; dropped threat-db / malicious-skills catalog references; added labeled Next.js stack example block) but every word of prose is originally authored. Spec 02 §5 body should be updated in a follow-up to reflect this reclassification, and ADR 0001's "Affected files" should extend to cover spec 02 §5. [P5]

### Deprecated
### Removed
### Fixed
- `hooks/README.md` — recipe-006 (`mcp-config-integrity.sh` manual-test) used `HOME=$tmp echo '{}' | hook` and `HOME=$tmp out=$(echo '{}' | hook ...)` — the first form set HOME for `echo` only (hook saw parent's HOME); the second form set HOME as a shell-level assignment that leaked into the `$(...)` subshell, making the second invocation use a different HOME than the first and miss the recorded baseline. Replaced with `echo '{}' | env HOME="$tmp" hook` on both invocations so the hook deterministically sees the recipe's tmp dir as HOME. Recipe now PASSes under bash strict-mode + isolated-HOME runners (e.g., `bootstrap-fixture.yml` step 7). [P7]

### Security
- Six security hooks block destructive actions, secrets in commits/output, edits to credential files, prompt injection in CLAUDE.md, and MCP config tampering. Audit-scan checks for inline credentials in `~/.claude/settings.json`, unrestricted MCP allowlists, and missing registered hook files. [P2 / P8 release-notes summary]

---

v0.1.0 is a development release. v1.0.0 follow-up items (CODE_OF_CONDUCT, SECURITY.md, issue/PR templates, auto-on-PR review variants, claude-md-validator, update-from-upstream) are tracked in [BACKLOG.md](BACKLOG.md). The v1.0.0 trigger is "specs implemented + one consumer project bootstrapped end-to-end" per [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §7. v0.1.0 satisfies the "specs implemented" half.
