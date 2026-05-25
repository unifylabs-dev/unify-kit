# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<!--
New entries land here per-PR. The kit's own CI (.github/workflows/changelog-check.yml) will fail any PR that touches templates/, plugins/, scripts/, github-actions/, specs/, or docs/methodology.md|philosophy.md without updating [Unreleased]. Use [skip-changelog] in PR title to bypass for purely infrastructural PRs.
-->

## [2.1.0] - 2026-05-25

Minor release adding three coordinated, additive artifacts that turn ad-hoc session→session knowledge transfer into a first-class primitive: a universal `handoff` skill, a `context-awareness` hook, and a checkpoint extension to the existing `phasing` skill. All changes are additive — no consumer migration required.

### Added

- **`handoff` skill** at `plugins/unifylabs-workflow/skills/handoff/`. Universal session-handoff machinery with a fixed 7-section core (Trajectory, Locked decisions, Open items, World state, TaskList snapshot, Do-not-re-litigate, Resume instructions), auto-detected mode addenda (phasing-orchestrator, phasing-executor, brainstorm, plan-exec, work-issue), tiered FULL/LEAN/EMERGENCY writes keyed to context %, and a strict natural-break gate. Discretion table teaches Claude when to surface `/handoff` proactively. See `plugins/unifylabs-workflow/skills/handoff/SKILL.md`.
- **5 slash commands** at `plugins/unifylabs-workflow/commands/`: `/handoff`, `/handoff-resume`, `/handoff-list`, `/handoff-done`, `/handoff-revive`. Flat command surface mirroring `/phase-execute` convention.
- **`context-awareness` hook** at `plugins/unifylabs-workflow/hooks/context-awareness.sh`. Fires on `UserPromptSubmit` (new event for this plugin) and `SessionStart` (added alongside existing 3 entries). Computes context % from transcript char-count÷4 against model-specific window; injects threshold-tier reminders (silent <40%; 40s/50s/60s/70+ tiers); scans MEMORY.md for `Pending handoff` pointers on SessionStart and injects ask-to-resume guidance; idempotent consumed-cleanup. Awareness only — never forces AskUserQuestion. Per-session suppression (no re-surfacing within 5 turns unless threshold escalates).
- **`phasing` skill extension** at `plugins/unifylabs-workflow/skills/phasing/SKILL.md`. Mid-phase checkpoint flow: phase-executor invokes `/handoff` mid-flight → writes `phase-N-checkpoint.md` per `references/checkpoint-shape.md` → orchestrator detects via extended polling (§7.5) → renders ⏸ CHECKPOINT status card (6th variant alongside ✅/🚀/⏳/🏁/🛑) → fires 4-option menu (Re-spawn / Split / View detail / Abort) with dynamic Recommended tag based on Reason enum (`context-pressure` / `scope-creep-detected` / `blocker-out-of-scope` / `other`). New `run.json` status `"checkpoint"` + optional `checkpoint_count` field (default 0); 8 documented state transitions. `checkpoint_count` thresholds: `=2` adds WARNING, `≥3` removes Re-spawn from menu.
- **`/phase-continue` command** at `plugins/unifylabs-workflow/commands/phase-continue.md`. 12-step playbook to continue a paused phase from its checkpoint in a fresh executor session. Mandatory `EnterPlanMode`; plan body excludes DONE work-steps; on completion writes canonical `phase-N-handoff.md` with carried-from-checkpoint verification annotations; checkpoint renamed `.superseded-<ts>.bak`.
- **`launch-terminal.sh` 5th arg.** Optional command-name parameter (defaults `phase-execute`) enabling `/phase-continue` spawn. Backward-compatible — all existing 4-arg callers unchanged. Also exports `CLAUDE_PHASE_SESSION=1` before spawn so `detect-mode.sh` reliably identifies executor sessions.
- **`references/founder-card-checkpoint.md`** at `plugins/unifylabs-workflow/skills/handoff/references/`. Self-contained reference card explaining the 4 checkpoint menu options + consequences + when each is recommended.

### Changed

- **`phasing/SKILL.md`** extended additively (no deletions in §1–§7 except a surgical `until`-loop OR'd extension in §7.3). All 5 prior status block variants intact (`🚀 READY`, `✅ COMPLETE`, `⏳ IN PROGRESS`, `🏁 DONE`, `🛑 ABORTED`); new `⏸ CHECKPOINT` is the 6th.
- **`phasing/scripts/launch-terminal.sh`** — 5th arg + `LAUNCH_TERMINAL_DRY_RUN` short-circuit + `CLAUDE_PHASE_SESSION=1` export.
- **`phasing/references/phase-spec-shape.md`** — appended optional Checkpoint policy section (most phases won't use it).
- **`hooks/hooks.json`** — added `context-awareness.sh` to existing `SessionStart` array (now 4 entries); added new `UserPromptSubmit` block. All prior PreToolUse/PostToolUse blocks untouched.
- **`README.md` "What's inside" bullet** — count + names synced with the bumped `plugin.json`/`marketplace.json` description (incidentally fixes pre-existing v2.0.1 drift where the README still listed `review-prototype` and was missing `extract-prototype-review` + `integrate-branch`).

### Migration from 2.0.1

No migration required for consumers. The build is fully additive. In-flight phasing runs in other projects continue running under their starting skill version; per-orchestrator cutover follows the documented procedure in `docs/cutover-handoff-v2.1.md` (manual, at natural breaks; lands in P10 of run `2026-05-24-handoff-skill-build`).

## [2.0.1] - 2026-05-12

Patch release fixing a v2.0.0 plugin-load regression and vendoring 2 skills that emerged after phase-1's scope was locked. Same-day shipped — minimal scope, high-urgency hook fix.

### Fixed

- **🔴 `plugins/unifylabs-workflow/hooks/hooks.json` schema match.** v2.0.0 shipped with hooks.json using the OLD flat schema (`{"SessionStart": [...], "PreToolUse": [...]}`); Claude Code's current plugin loader requires the NEW wrapped schema (`{"hooks": {"SessionStart": [...], "PreToolUse": [...]}}`). Plugin load failed with `Hook load failed: expected record, received undefined at path ["hooks"]` after install. Wrapped all event blocks under a top-level `"hooks"` key per the schema observed in working `superpowers` and `security-guidance` plugins. No semantic change — same 7 hooks, same matchers.
- **`scripts/dev-symlink-skills.sh` settings.json strip now matches tilde paths.** The jq predicate compared command strings against `$HOME + "/.claude/hooks/"` (expanded), but `~/.claude/settings.json` stores commands as `~/.claude/hooks/foo.sh` (tilde shorthand — Claude Code expands at runtime). Strip never fired on real machines. Predicate now matches BOTH `~/.claude/hooks/` and `$HOME/.claude/hooks/` prefixes, and the resulting empty `.hooks` top-level key is dropped entirely.

### Added

- **`plugins/unifylabs-workflow/skills/integrate-branch/`** vendored. Net-new skill that emerged after phase-1's vendoring snapshot. Audits an external/untrusted branch (built outside the standard workflow — by a junior dev with GSD, a contractor, a quick spike) against project standards and routes to one of three paths: salvage (fix in place via `/work-issue`), rebuild (extract specs + rebuild), or discard. Pairs with `/extract-prototype-review` (the renamed prototype-spec-extractor).

### Changed

- **`plugins/unifylabs-workflow/skills/review-prototype/` renamed → `extract-prototype-review/`.** Same skill, clearer name: it *extracts specs from* a sanctioned prototype branch (now distinct from the new `/integrate-branch` skill, which is the true *review-and-integrate* tool). Frontmatter `description` cross-references both for discoverability. `/review-prototype` command no longer registered; consumers update slash invocations.
- **`scripts/dev-symlink-skills.sh` SKILLS array lists 10 skills** (was 9). Replaces `review-prototype` with `extract-prototype-review`, adds `integrate-branch`. Dev-machine migration handles all 10.
- **`plugins/unifylabs-workflow/.claude-plugin/plugin.json`**: `version` `2.0.0` → `2.0.1`; `description` enumerates 10 skills, swapping `review-prototype` → `extract-prototype-review` and adding `integrate-branch`.
- **`.claude-plugin/marketplace.json`**: description mirrors plugin.json (10 skills).

### Removed

- **`plugins/unifylabs-workflow/skills/review-prototype/`** dir deleted. Superseded by the renamed `extract-prototype-review/`. If you have `~/.claude/skills/review-prototype` left over from a pre-2.0.1 dev-symlink run, `bash scripts/dev-symlink-skills.sh --rollback` first or remove the dangling symlink manually before re-running.

### Security (rolled in from post-v2.0.0 work that hadn't yet shipped)

- **Plugin security hooks fail closed instead of open.** `dangerous-actions-blocker.sh` and `file-guard.sh` now exit 2 (block) instead of exit 0 (allow) when (a) `python3` is missing from PATH, or (b) the tool-input JSON payload fails to parse. Previously a stripped-down environment without python3, or any Claude Code payload schema drift, silently disabled both hooks with only a stderr line that the user might miss. Diagnostic now names the hook and points at `CLAUDE_HOOKS_DISABLE=<name>` for explicit opt-out.
- **`pre-commit-secrets.sh` fail-closed on missing git or git-diff failure.** Previously a `Bash(git commit:*)` matcher firing without `git` on PATH, or a `git diff --cached` that errored (corrupt index, `safe.directory` rejection), would silently allow the commit through. Both now block (exit 2) with the captured git stderr.
- **`mcp-config-integrity.sh` surfaces baseline-write failures.** Previously `mkdir -p` and the baseline-file write silently swallowed filesystem errors via `2>/dev/null || true`, so a read-only `HOME` or wrong perms on `~/.claude/.mcp-hashes/` permanently disabled the CVE-2025-54135 / 54136 mitigation with no diagnostic. Now emits a one-line stderr explaining drift detection is disabled (still exit 0 — the hook is advisory).

### Fixed

- **`changelog-check.yml` trigger paths matched v2.** `^hooks/` (repo-root `hooks/` was deleted in v2) replaced with `^plugins/` + `^\.claude-plugin/`. Without this, every plugin / marketplace edit silently bypassed the per-PR `[Unreleased]` discipline that the workflow exists to enforce.
- **`marketplace.json` description matches `plugin.json`.** Now lists 9 skills (adds `iterative-review`, `humanizer`) and "10 phase + review commands" instead of v1's "skills (work-issue, ship, …, compliance-research), 9 phase commands."
- **`scripts/dev-symlink-skills.sh` migration is atomic across the seam.** (a) `_symlink` now uses `ln -s` to a `.new.$$` sibling then `mv -f` rename — Ctrl-C between operations no longer leaves a deleted user_path with no replacement. (b) `settings.json` is edited via `jq` BEFORE hook files are deleted, with the jq stderr captured and surfaced on failure; previously a jq error left the hook files deleted but `settings.json` still referencing them, breaking every subsequent session. (c) `_backup_path` handles empty-subdir destination cleanly so the post-hoc `BACKUP_DIR//statusline.sh` rename hack drops away.
- **`scripts/init-project.sh` `_install_compliance` surfaces find failures.** Compliance profile enumeration via `find` ran inside `< <(...)` process substitution with `2>/dev/null` — a missing subdir or permission error produced the misleading "no docs/compliance or runbooks content" warning. Now pre-checks each subdir's existence, stages the file list to a tempfile, fails loudly via `_err` + `exit 1` on real find errors.
- **`scripts/README.md` rewritten for v2.** Old 474-line doc still documented `bootstrap-claude-config.sh` (deleted), referenced `../hooks/README.md` (deleted), and claimed "11 templates" / "6 hooks" (both v1 numbers). Replaced with a concise v2 stub pointing at the canonical README + `init-project.sh --help`.
- **`scripts/ci/run-hook-recipes.sh` deleted.** Read recipes from `hooks/README.md` (deleted in v2) and was only ever invoked by `bootstrap-fixture.yml` (also deleted). Hook-firing verification is user-gated post-install per CLAUDE.md §6.
- **`onboarding/day-1.md` step 2 + day-1 hard gate refreshed for v2.** Bootstrap step swapped from `./scripts/bootstrap-claude-config.sh` to `/plugin marketplace add … && /plugin install unifylabs-workflow`; audit-scan step now uses `--check-plugin`.
- **`.github/pull_request_template.md` workflow reference renamed.** `gh workflow run bootstrap-fixture.yml` → `gh workflow run plugin-install-fixture.yml` (2 occurrences).
- **`plugins/unifylabs-workflow/commands/iterative-review.md` "see also" pointer.** Replaced `~/.claude/skills/iterative-review/SKILL.md` (only resolves after `dev-symlink-skills.sh` migration) with a posture-neutral reference to the bundled skill.
- **`marketplace-drift-check.sh` uses `set -euo pipefail` per CLAUDE.md §3.** Was `set -uo` (no `-e`); now `-euo` with `trap 'exit 0' ERR` to preserve the advisory contract while still benefiting from `-e` during development.

### CI

- **`plugin-install-fixture.yml` adds two structural assertions.** (a) `bash -n` parse check across all hook scripts + `statusline.sh` (catches unterminated heredocs / `$(...)` that shellcheck can miss). (b) `hooks.json` `command` paths are extracted via jq, `${CLAUDE_PLUGIN_ROOT}` is resolved, and each referenced file is asserted to exist on disk (catches typos that currently fail only at user runtime).

## [2.0.0] - 2026-05-12

Major release reshaping unify-kit from v1's "generic kickstarter via consumer-side scripts" into v2's "Tomer's principles + plugin curation kit." One repo now serves three roles: (a) a Claude Code marketplace at `.claude-plugin/marketplace.json` curating the `unifylabs-workflow` plugin, (b) the `unifylabs-workflow` plugin at `plugins/unifylabs-workflow/` (9 skills, 10 commands, 7 security hooks, opt-in statusline), (c) a tier-organized template tree at `templates/{core,claude-runtime,optional,compliance,snippets}/` with per-project compliance subsystem (PHIPA / PIPEDA / financial-Canada / SOC 2). v1.0.0's machine-state install via `scripts/bootstrap-claude-config.sh` is replaced by `/plugin install unifylabs-workflow` from a Claude session; the repo-root `hooks/` directory is migrated into the plugin (functionally identical hook content; only path resolution changed, from absolute `~/.claude/hooks/` to plugin-rooted `${CLAUDE_PLUGIN_ROOT}/hooks/`).

### Migration from v1.0.0

v1.0.0 audience was ~1 day old (essentially Tomer + close clients). No automated migration script; manual steps:

1. **One-time per machine**: from a fresh Claude session, run
   `/plugin marketplace add github.com/unifylabs-dev/unify-kit` then
   `/plugin install unifylabs-workflow`. Verify with `/help` — you should see
   `work-issue`, `ship`, `phasing`, `compliance-research`, plus the 9 `phase*`
   commands and `iterative-review`.
2. **Optional (kit-author only — Tomer)**: from this repo's clone, run
   `bash scripts/dev-symlink-skills.sh`. Backs up `~/.claude/skills/*`,
   `~/.claude/commands/*`, `~/.claude/hooks/*.sh`, `~/.claude/statusline.sh`
   to `~/.claude/.v2-migration-backup-<UTC-ts>/`, then symlinks the
   user-level paths into `plugins/unifylabs-workflow/`. `--dry-run` and
   `--rollback` available. Consumers do NOT need this script — `/plugin install`
   wires everything up via Claude Code's plugin loader.
3. **Per existing project on v1.0.0**: re-run
   `bash scripts/init-project.sh <dir> --compliance=<profile> --snippets=<stack>`.
   The script handles `<dir>/.unify-kit-project-manifest.json` SHA comparison
   for safe re-runs (no surprise overwrites of consumer-edited files; use
   `--force` to override). v2's manifest schema is a superset of v1's — old
   manifests are compatible.

### Added

- **Marketplace** (`.claude-plugin/marketplace.json`) listing the
  `unifylabs-workflow` plugin. External plugins worth pairing with this kit
  (`superpowers`, the Supabase suite, the full Vercel suite — ~28 in total)
  are documented in `docs/curated-plugins.md` with install commands. Users
  add their own marketplaces independently. `compound-engineering` is
  explicitly excluded (opted out).
- **`unifylabs-workflow` plugin** at `plugins/unifylabs-workflow/`
  (v2.0.0). Ships:
  - **9 skills**: `work-issue` (8-phase issue-driven dev), `ship`
    (commit + push + PR), `review-prototype` (turn a prototype branch into
    an acceptance-criteria-backed issue), `analyze-comms` (analyze incoming
    client/vendor messages), `phasing` (multi-phase orchestration across
    fresh Claude sessions), `promote-to-marketplace` (move a personal
    `~/.claude/skills/X` into the plugin), `compliance-research`
    (interactive industry/geo/regulator walkthrough), `iterative-review`
    (bounded review-fix-verify loop; auto-detects code / doc / phase mode),
    `humanizer` (remove signs of AI-generated writing; MIT vendor from
    `devnen/Humanizer-Skill`).
  - **10 commands**: `phase`, `phase-abort`, `phase-archive`, `phase-execute`,
    `phase-list`, `phase-next`, `phase-resume`, `phase-retry`, `phase-status`,
    `iterative-review`.
  - **7 security hooks**: `pre-commit-secrets`, `output-secrets-scanner`,
    `file-guard`, `dangerous-actions-blocker`, `claudemd-scanner`,
    `mcp-config-integrity`, `marketplace-drift-check`. Wired in
    `plugins/unifylabs-workflow/hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}`
    path resolution.
  - **Opt-in statusline** at `plugins/unifylabs-workflow/statusline/statusline.sh`.
- **Template tier reorganization**: `templates/` restructured into
  `core/` (always applied — `claude.md`, `cheatsheet`, `ai-usage-charter`,
  `mcp-policy`, `security-checklist`, `pull-request-template`,
  `issue-templates/`, `specs/`, `github/CODEOWNERS`), `claude-runtime/`
  (always applied — `.mcp.json`, `.claude/settings.json`), `optional/`
  (`team-onboarding`, `methodology-retro`, `llms.txt`), `compliance/profiles/`
  (4 profiles), `snippets/{nextjs,testing,ci}/`. All moves used `git mv`
  so `git log --follow` works on every renamed file.
- **Compliance subsystem** under `templates/compliance/profiles/`:
  - `baseline-pipeda` — Canadian privacy floor. PIPEDA's 10 fair-information
    principles; OPC breach-reporting (RROSH threshold, 24-month record
    retention); CASL-aware privacy policy; OWASP-aligned safeguards.
  - `healthcare-phipa` — Ontario PHIPA. HIC vs. Agent role distinction;
    consent + lockbox; s. 10.1 electronic audit log; s. 12.2 breach
    notification "at the first reasonable opportunity" (PHIPA s. 12.2
    canonical wording — superseding the master plan's outdated "24-hr"
    framing); IPC reporting flow; PHI access-revocation with audit-log
    reconciliation. Extends `baseline-pipeda`.
  - `financial-canada` — FINTRAC readiness (PCMLTFA compliance program,
    STR / LCTR / LVCTR / EFTR reporting); provincial-securities-overview
    linking the CSA + each provincial commission + CIRO + OBSI;
    multi-regulator breach response; financial-flavored privacy + audit-log
    + access-revocation. Extends `baseline-pipeda`.
  - `general-soc2` — SOC 2 TSC mapping (CC1–CC9 + Availability +
    Confidentiality + Processing Integrity + Privacy framing);
    `security-policies-index.md` listing the 22 policy artifacts auditors
    expect; NIST SP 800-61-aligned IR runbook; vendor-management runbook
    covering 4-tier classification and onboarding/re-review/termination.
    Independent of baseline (framework, not law); composes alongside
    `baseline-pipeda` for Canadian B2B SaaS.
- **Composition / extends mechanism** in `init-project.sh`: when an
  extender profile is named (`healthcare-phipa`, `financial-canada`),
  baseline-pipeda is auto-prepended. Install order is
  `baseline → extender → general-soc2` (later writes win on collision).
  Cross-profile relative links (e.g., baseline's `vendor-escape-template.md`
  referenced from an extender) are rewritten during install from
  `../../baseline-pipeda/runbooks/<file>` to `runbooks/<file>` to match
  the flattened consumer tree.
- **`/compliance-research` skill** at
  `plugins/unifylabs-workflow/skills/compliance-research/SKILL.md` — ~235-line
  interactive flow. Walks user through industry / customer-geography /
  data-classes / specific-regulator questions via `AskUserQuestion`; applies
  a deterministic recommendation matrix; gap-analyzes any existing
  `docs/compliance/`; fetches current regulatory text via `context7` MCP
  (preferred) then `WebSearch` (fallback); writes
  `docs/compliance/research-notes/<YYYY-MM-DD>-<topic-slug>.md` with YAML
  frontmatter. Offline-friendly fallback.
- **`iterative-review` skill + command** at
  `plugins/unifylabs-workflow/skills/iterative-review/` and
  `plugins/unifylabs-workflow/commands/iterative-review.md` — bounded
  review-fix-verify loop. Auto-detects code, doc, or phase mode. Severity-
  gated stopping (Critical always gates user; Important auto-fixes by
  default; Suggestions surface in report only). 3-iteration hard cap,
  skip-if-clean pre-gate (avoids Snorkel self-critique 41pt accuracy drop),
  fixed-point early exit, 5× token-budget circuit breaker. Cross-referenced
  from `plugins/unifylabs-workflow/skills/phasing/SKILL.md` §9.2 as a
  deeper post-phase conformance-review option.
- **`humanizer` skill** at `plugins/unifylabs-workflow/skills/humanizer/`
  — vendored from `devnen/Humanizer-Skill` (MIT). Removes AI-writing tells
  per Wikipedia's "Signs of AI writing" guide. Includes LICENSE, SKILL.md,
  README.md, WARP.md (the upstream `.git/` was excluded from vendor).
- **`scripts/init-project.sh` v2 refactor**:
  - New tier mapping (core/ + claude-runtime/ always applied).
  - `--compliance=<comma-list>` flag with extends auto-resolution.
  - `--include=<comma-list>` flag for optional templates
    (`team-onboarding`, `llms-txt`).
  - `--snippets=<stack>` extended to support comma-separated combos of
    `nextjs`, `testing`, `ci`, `none`.
  - 2 new placeholders: `{{REPO_OWNER}}` (CODEOWNERS) and
    `{{COMPLIANCE_PROFILE}}` (addenda). Vocabulary grew from 18 → 20.
  - Manifest schema: top-level `compliance_profiles`, `includes`, `snippets`
    arrays in `<target>/.unify-kit-project-manifest.json`.
  - Compliance addenda baked into CLAUDE.md upfront (per-profile
    `<!-- compliance-addendum:<slug> -->` markers; idempotent across re-runs).
- **`scripts/audit-scan.sh` v2 refactor**: drops the v1 hook-existence
  check (hooks now live in the plugin and resolve via `${CLAUDE_PLUGIN_ROOT}`);
  adds `--check-plugin` flag probing `~/.claude/plugins/installed.json` and
  `~/.claude/plugins/unifylabs-workflow/.claude-plugin/plugin.json`. Inline-
  credential + unrestricted-MCP scans unchanged.
- **`scripts/dev-symlink-skills.sh`** (new) — one-time kit-author migration:
  back up `~/.claude/skills/*`, `~/.claude/commands/*`, `~/.claude/hooks/*.sh`,
  `~/.claude/statusline.sh` to `~/.claude/.v2-migration-backup-<UTC-ts>/`,
  then symlink user-level paths into `plugins/unifylabs-workflow/`. Atomic
  backup-then-symlink; `--dry-run` and `--rollback` flags; idempotent
  (already-correct symlinks left alone). Surgically strips user-level hook
  command entries from `~/.claude/settings.json` (plugin provides hooks).
- **`.github/workflows/plugin-install-fixture.yml`** (new) — replaces
  `bootstrap-fixture.yml`. Structural validation (marketplace + plugin
  JSON validity, 9-skill description, 10 commands, hook executability,
  `${CLAUDE_PLUGIN_ROOT}` resolution) + ephemeral `init-project.sh`
  smoke tests across compliance profiles + audit-scan happy/sad path +
  dev-symlink-skills dry-run.
- **`docs/curated-plugins.md`** (new) — ~28 external plugins documented
  by category: Process/Workflow (`superpowers`), Supabase suite (2),
  Vercel suite (~24). Per-plugin one-line description + install command.
  Linked from rewritten root `README.md`.
- **`specs/14-marketplace.md`** (new) — documents
  `.claude-plugin/marketplace.json` schema, curation policy, the
  `marketplace-drift-check.sh` SessionStart hook, and what's explicitly
  out of scope (auto-installing externals).
- **5 new Next.js snippets** under `templates/snippets/nextjs/`:
  `prisma-7.md`, `drizzle.md`, `custom-auth.md`, `forms.md`,
  `semantic-release.md`. Each 80–200 lines.
- **`templates/core/github/CODEOWNERS.template`** (new) — routes
  `.claude/`, `.mcp.json`, `CLAUDE.md`, `ONBOARDING.md`, and
  `docs/compliance/` to a configurable repo owner via `{{REPO_OWNER}}`.
- **`templates/claude-runtime/`** (new dir) — `.mcp.json.template`
  (empty `{ "mcpServers": {} }` skeleton), `.mcp.json.examples.md`
  (companion reference with Supabase / Playwright / context7 worked
  examples — JSON doesn't support inline comments, hence the sibling
  reference doc), `.claude-settings.json.template`
  (`enableAllProjectMcpServers: true` + 15-entry permission allowlist).
- **`templates/compliance/README.md`** finalized — composition section
  with 3 worked examples (default Canadian project; Ontario clinic;
  Canadian fintech doing enterprise sales); "Extends mechanism" walkthrough
  explaining install order + overwrite-on-collision logic; profile-author
  checklist; "not legal advice" disclaimer.

### Changed

- **`init-project.sh` SOURCE_TARGET_MAP** rewritten to read from
  `templates/core/` and `templates/claude-runtime/`; `--snippets=` extended
  from `nextjs|none` to `nextjs,testing,ci|none` (comma-separated); v1's
  `--with-ci-templates` flag dropped (CI snippets now live under
  `templates/snippets/ci/` and are addressable via `--snippets=ci`).
- **`audit-scan.sh`** plugin-aware (drops repo-hook tracking; adds
  `--check-plugin` probe).
- **`CLAUDE.md`** §2 (Architecture) rewritten for the v2 model (marketplace
  + plugin + tier-organized templates); §6 (Test Strategy) references
  `plugin-install-fixture` instead of `bootstrap-fixture`; §4 (Issue-Driven
  Development) corrected — `work-issue` ships in the `unifylabs-workflow`
  plugin (this repo), not in `superpowers + compound-engineering`; PR Merge
  Process checklist updated to use the new workflow + shellcheck scope.
- **`README.md`** quickstart fully rewritten for the 3-step v2 flow
  (plugin install / clone / `init-project.sh --compliance=...`); status
  table to v2.0.0; bootstrap-fixture badge replaced with
  plugin-install-fixture badge; new "What's new in v2" section; link to
  `docs/curated-plugins.md`.
- **`templates/README.md`** documents the v2 tier layout and the
  `--include` / `--compliance` / `--snippets` flag contract; vocabulary
  table extended to 20 placeholders.
- **`templates/core/cheatsheet.md.template`** Appendix A reviewer roster
  rewritten to be vendor-neutral (roles + how to invoke, no hard-coded
  `compound-engineering:` plugin entries); removed the "Plan mode + phasing
  trigger" mini-section (redundant with the `/phase` row in Daily
  slash-commands).
- **`templates/core/pull-request-template.md.template`** removed the
  `## Design Decisions` H2 section (low-adoption; decisions belong inline
  in Summary or in spec changes); slim from 73 to 70 lines.
- **`.github/workflows/scrub-check.yml`** SUPPORTED placeholder list
  extended from 18 to 20 entries (`{{REPO_OWNER}}`, `{{COMPLIANCE_PROFILE}}`);
  shipped-artifact scope adjusted to scan `plugins/` instead of repo-root
  `hooks/`.
- **`.github/workflows/lint.yml`** shellcheck scope updated to
  `scripts/*.sh + scripts/ci/*.sh + templates/snippets/ci/*.sh +
  plugins/unifylabs-workflow/{hooks,statusline}/*.sh`; SC2034 added to the
  exclusion set; the v1 `json-schema` job (validated the now-deleted
  `hooks/settings-snippet.json`) removed.
- **`specs/03-hooks.md`** appended with a "Migration to plugin (v2.0.0)"
  section describing the move from `unify-kit/hooks/*.sh` to
  `plugins/unifylabs-workflow/hooks/*.sh` with `${CLAUDE_PLUGIN_ROOT}`
  resolution.
- **`plugins/unifylabs-workflow/.claude-plugin/plugin.json`** version
  finalized to `2.0.0`; description enumerates 9 skills; `[stub]` marker
  on `compliance-research` removed.

### Removed

- **`scripts/bootstrap-claude-config.sh`** — replaced by `/plugin install
  unifylabs-workflow` from a Claude session. v1 install steps in
  `~/.claude/` (hooks, settings.json merge, kit-version manifest at
  `~/.claude/.unify-kit-manifest.json`) are now handled by Claude Code's
  plugin loader.
- **`hooks/` directory at repo root** — 6 security hook scripts +
  `hooks/README.md` + `hooks/settings-snippet.json`. The 6 hook scripts
  are now byte-identical at `plugins/unifylabs-workflow/hooks/`. The
  settings snippet is superseded by `plugins/unifylabs-workflow/hooks/hooks.json`
  (uses `${CLAUDE_PLUGIN_ROOT}`).
- **`.github/workflows/bootstrap-fixture.yml`** — replaced by
  `plugin-install-fixture.yml`.
- **`scripts/test-fixtures/init-project/full/`** + `full-with-ci/` —
  v1 known-good output trees. v2 CI installs into `$RUNNER_TEMP` targets
  and asserts structural invariants; committed known-good output proved
  brittle (kit-version strings, platform-specific path differences).
- **v1 `--with-ci-templates` flag** in `init-project.sh` (CI snippets
  now addressable via the unified `--snippets=ci` syntax).

### Fixed

- **`CLAUDE.md` line 108** (v1) — "Ships in the `superpowers` +
  `compound-engineering` plugins" was wrong; `work-issue` is Tomer's own
  skill and ships in this repo's `unifylabs-workflow` plugin. Corrected.

### Security

- 7 security hooks (existing 6 + new `marketplace-drift-check.sh`) now
  ship through the plugin install path. `marketplace-drift-check.sh`
  (SessionStart, advisory) detects when `~/.claude/skills/X` exists but
  isn't in the plugin and isn't on `~/.claude/.personal-skills` allowlist.

## [1.0.0] - 2026-05-11

Major release closing the consumer-side init flow gap. `scripts/init-project.sh` debuts as the sibling of `bootstrap-claude-config.sh`, installing 11 one-shot templates with `{{...}}` placeholder substitution, opt-in Next.js snippets, and opt-in CI workflow templates into any project directory, with a SHA-256 manifest written at `<project>/.unify-kit-project-manifest.json` for safe re-runs. The kit bootstrapped [`unify-kit-example-nextjs`](https://github.com/unifylabs-dev/unify-kit-example-nextjs) end-to-end (one project end-to-end → spec 08 §7 single-gate trigger satisfied) and dogfooded the spec 11 PR + issue templates into its own `.github/` (spec 08 §5 closure). `UPGRADING.md` documents the manual upgrade flow per spec 08 §4 artifact taxonomy. Branch protection on `main` is enforced (required PR review, 5 required status checks, no force-push, no deletion). All 14 specs (00–13) are implemented as of v0.2.x.

### Added

- Kit self-bootstrapped via `scripts/init-project.sh`: installed `CLAUDE.md` at kit root (enriched per spec 13 — Branch Naming + Specification Discipline + PR Merge Process + Living Document Triggers; light hand-edits for kit-specific Architecture / Conventions / Test Strategy framing) and `.github/{pull_request_template.md, ISSUE_TEMPLATE/{feature_request,bug_report}.yml}` from spec 11 templates. Gitignored `.unify-kit-project-manifest.json` (kit IS the kit-version source of truth). Closes G9; closes spec 08 §5 two `.github/` checklist items (the kit now dogfoods every public-repo scaffold it ships).
- Add `scripts/init-project.sh` — consumer-side bootstrap installer for project templates. Installs 11 one-shot templates with `{{...}}` placeholder substitution (9 substituted + 2 lift-as-is issue YAMLs), optional Next.js stack snippets (`--snippets=nextjs`, 5 files), and optional CI workflow templates (`--with-ci-templates`, 3 files). Writes `<target>/.unify-kit-project-manifest.json` recording per-artifact SHA-256 + install timestamps for safe re-runs. Mirrors `bootstrap-claude-config.sh`'s preflight / backup / atomic-write / SHA-256 manifest patterns; uses `sed`-based search-replace instead of `jq` merge. Idempotent (`no changes needed` on clean re-runs). Closes spec 11's "bootstrap-installer extension for `.github/` templates defers to v1.0.0" deferral by installing the PR + issue templates into `<target>/.github/`. Requires Bash 4+ with helpful error on Bash 3.x.
- Add `scripts/test-fixtures/init-project/` — `empty/`, `partial/CLAUDE.md` (legacy-format pre-existing), `full/` and `full-with-ci/` (known-good outputs), `init-project-test-config.yml` (18-placeholder preset for CI), plus a fixtures README documenting layout + regeneration commands.
- Extend `.github/workflows/bootstrap-fixture.yml` with a parallel `init-project-fixture` job — 6 CI steps covering clean install, backup-on-overwrite, idempotency, dry-run, `--force` restore-from-tamper, and the `--with-ci-templates --snippets=nextjs` full-flag path.
- Add `UPGRADING.md` at the kit's repo root — manual upgrade guide per `specs/08-living-docs-and-decision-log.md` §4 artifact taxonomy (drop-in / fork-and-customize / reference) with detailed re-run flows for `bootstrap-claude-config.sh` and `init-project.sh`, a classification matrix for `WARNING: target exists with different content` cases, a worked `v0.2.0 → v1.0.0` upgrade example, a semver-based breaking-changes policy, and a forward pointer to BACKLOG's `update-from-upstream.sh` (v1.1+) for users wanting a less-manual flow.
- Enforce branch protection on `main`: required pull-request reviews (1 approving review, no stale-dismiss, no code-owner requirement), 5 required status checks (`lint`, `scrub-check`, `bootstrap-fixture`, `init-project-fixture`, `changelog-check`), no force-push, no deletion, no admin enforcement (kit author may bypass for hotfixes), required conversation resolution. Closes the lone remaining `BACKLOG.md` v1.0.0 release-prep item. Operational config (no file change).

### Changed

- `README.md` — rewrite for v1.0.0 readiness: Quickstart step 4 now points at `scripts/init-project.sh` (replacing the "manually copy templates + replace placeholders" wording); new `## Adopting the kit on an existing project` section walks through `--dry-run` discovery / classification / `--skip` / live install / GitHub-App + secret setup; new `## See it in action` section references the `unify-kit-example-nextjs` sandbox + PR #1; `## What's in the box` refreshed for v0.2.x scope (14 templates, three scripts including `init-project.sh`, `docs/audit/` callout, 5 day-1 hard gates, 14 implemented specs); `## Status` set to `v1.0.0 — released 2026-05-11` with the v1.0.0 single-gate trigger satisfied; `## Compatibility` extended with Bash 4+ requirement for `init-project.sh` (vs. Bash 3.2+ for `bootstrap-claude-config.sh`).
- `onboarding/day-1.md` — prepend new `## 0. Initialize the project (if it isn't already)` section (walks through `init-project.sh` invocation + manifest-current verification for already-bootstrapped projects); prepend new first `Day-1 hard gate` for `init-project.sh exits 0` (now 5 gates, all objectively verifiable per spec 06 R-025).
- `onboarding/README.md` — `## Overview` extended with one-paragraph mention of `init-project.sh` as the day-1 entry point + manifest-current verification path for already-bootstrapped projects.
- All 14 specs (`specs/00-*.md` through `specs/13-*.md`) — frontmatter `Status:` updated from `Draft / awaiting review` to `Implemented in v0.2.x`. `specs/README.md` extended with all-implemented callout in the Status blockquote + 4 new table rows (10–13: SDD layer / GitHub templates / test discipline / CLAUDE.md enrichment); methodology canon reference in the row-07 description updated from `A–G + pointers` to `§A–J` reflecting the spec-10 renumber.
- `github-actions/README.md` — `## Secrets` section reframed: the [Claude Code GitHub App](https://github.com/apps/claude) is **required** (not optional / OAuth-alternative) for both API-key and OAuth auth paths. Without the app installed, `anthropics/claude-code-action@v1` exits 401 on `setupGitHubToken` regardless of which auth secret is set. Adoption-flow step 3 reordered to install the app first, then set the API-key (or OAuth) secret. Common-failure-mode bullet added for missing-app case. Discovered by Phase 2 dogfood against the `unify-kit-example-nextjs` sandbox.

### Fixed

- Fix `github-actions/claude-code-review.yml` missing `id-token: write` permission. The `anthropics/claude-code-action@v1` action requires OIDC for GitHub-side auth even when `ANTHROPIC_API_KEY` is provided as a secret; without this permission the action fails on `setupGitHubToken` with "Could not fetch an OIDC token". Discovered by Phase 2's live `/claude-review` test against the `unify-kit-example-nextjs` sandbox.
- Fix `github-actions/claude-code-review.yml` `claude_args`: dropped the explicit `--allowed-tools` whitelist (`Read,Glob,Grep,Bash(gh pr diff:*),Bash(gh pr view:*)`) which excluded the MCP comment-posting tools that `anthropics/claude-code-action@v1` ships by default. With the whitelist in place Claude reviewed the diff but couldn't publish findings — the action's logs reported `No buffered inline comments`. New `claude_args` lets the action's defaults apply (defaults already restrict to read + MCP-comment tools per the action's own least-privilege design). Also raised `--max-turns` from 12 to 20 to give Claude headroom on larger diffs. Discovered by Phase 2's live `/claude-review` test.

## [0.2.0] — 2026-05-11

Minor release closing the v0.2.x absorption-from-source-project arc. Four spec/implementation PR pairs (10–13) ported practice from a real consumer project into the kit while keeping the kit stack-agnostic: a Specification-Driven Development layer (durable module + journey specs as the contract that GitHub issues amend), GitHub repo scaffolding (PR + issue templates that gate `/work-issue` Phase 0), a test-discipline layer (smart CI test-split + four-tier pyramid canon + workflow templates with secrets-gate pattern), and consumer CLAUDE.md enrichment (Branch Naming + Spec Discipline + PR Merge Process + Living Document Triggers + a methodology-retro template + a 4-week onboarding ramp). v1.0.0 release-prep also advanced: `CODE_OF_CONDUCT.md` + `SECURITY.md` landed. Vocabulary grew from 16 placeholders to 18; methodology canon grew from §A–I to §A–J.

### Added

- Add `specs/10-sdd-layer.md` proposing an SDD layer (module + journey + specs-README templates, methodology §B SDD section, §D expansion with the `/work-issue` 8-phase contract, BDD-Lite snippet, two new placeholders). Spec only; implementation lands in a follow-up PR.
- Add `templates/specs/module.md.template` + `templates/specs/journey.md.template` + `templates/specs/README.md.template` — durable spec templates for consumer use (implements `specs/10-sdd-layer.md` Batch A).
- Add `docs/methodology.md` §B "Specification-Driven Development" — three-layer mental model (SDD + BDD-Lite + TDD), vocabulary, seven hard rules, drift-fix decision tree, lazy-bootstrap rule, BDD-Lite naming convention. Existing §B–I renumber to §C–J. §D (Issue-driven dev) expanded with the `/work-issue` 8-phase contract (Phase 0 Spec Sync through Phase 7 PR creation).
- Add `templates/snippets/bdd-lite-test-naming.md` — BDD-Lite test naming convention with Playwright example and adaptation notes for other runners.
- Add `specs/11-github-templates.md` proposing GitHub repo scaffolding (PR template + feature-request and bug-report issue templates; manual `cp` install via `templates/README.md`; BACKLOG cleanup of v1.0.0 release-prep bullets that ship earlier). Spec only; implementation lands in a follow-up PR.
- Add `templates/pull-request-template.md.template` — PR template with the load-bearing `## Spec Changes` two-checkbox section (gates "spec updated vs drift fix" decision) and a Verification Checklist parameterized by `{{TEST_FULL_CMD}}` + `{{BUILD_CMD}}`. Implements `specs/11-github-templates.md` Batch A.
- Add `templates/issue-templates/feature-request.yml.template` + `templates/issue-templates/bug-report.yml.template` — GitHub form-schema YAML issue templates with required "Spec sections affected" fields that gate `/work-issue` Phase 0.
- Add `## GitHub repo scaffolding` section to `templates/README.md` with worked-example `cp` commands for manual install of the PR + issue templates (bootstrap-installer extension still defers to v1.0.0).
- Add `specs/12-test-discipline.md` proposing the test-scheduling layer (smart CI test-split bash snippet, methodology §C "Test scheduling" sub-section with the four-tier pyramid, two CI workflow templates `ci-pr-fast.yml.template` + `ci-nightly.yml.template`). No new placeholders. Spec only; implementation lands in a follow-up PR.
- Add `templates/snippets/ci-test-split-bash.sh` — smart CI test-split (always-run core + diff-driven action tests + full-suite fallback). Bash variables with `${VAR:-default}` for stack adaptation. Implements `specs/12-test-discipline.md` Batch A.
- Add `docs/methodology.md` §C "Test scheduling: match cost to feedback urgency" sub-section — four-tier pyramid (CI fast / E2E daily / local pre-PR / nightly), `@daily` tagging convention, three anti-pattern call-outs.
- Add `templates/snippets/ci-pr-fast.yml.template` — GitHub Actions workflow bundling Tier-1 PR-fast + Tier-2 daily-E2E with the secrets-gate pattern.
- Add `templates/snippets/ci-nightly.yml.template` — Tier-4 nightly workflow (full unit + full e2e on cron + workflow_dispatch).
- Add `specs/13-claude-md-enrichment.md` proposing the final v0.2.x absorption arc (claude.md.template enrichment with Branch Naming + Spec Discipline + PR Merge Process + Living Document Triggers; methodology-retro template; cheatsheet Conventions section + post-/ship Notes update; team-onboarding 4-week ramp). No new placeholders. Spec only; implementation lands in a follow-up PR.
- Add `templates/methodology-retro.md.template` — methodology-retrospective skeleton (frontmatter + 5 body sections: What worked / What we tuned / Known gaps / New rules adopted / Action items). Implements `specs/13-claude-md-enrichment.md` Batch B.
- Add `templates/cheatsheet.md.template` `## Conventions` section — branch-name format, `gh issue develop` invocation, spec-discipline pointer, living-docs pointer.
- Add `templates/team-onboarding.md.template` §3 `### 4-week ramp` sub-section — Week 1 environment+docs / Week 2 paired `/work-issue` P3 / Week 3 solo P2 / Week 4 real backlog. Soft milestones, not gates.
- Add `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1) and `SECURITY.md` (vulnerability disclosure process + response SLA). Closes 2 of 3 v1.0.0 release-prep items from `BACKLOG.md`. [PR #19]

### Changed

- Expand placeholder vocabulary from 16 to 18: `{{DATA_MODEL_PATH}}` and `{{TEST_E2E_DIR}}` added (`specs/02-templates.md`, `templates/README.md`, `.github/workflows/scrub-check.yml`).
- Update `/work-issue` 8-phase wording in `templates/cheatsheet.md.template`, `templates/claude.md.template`, and `specs/02-templates.md`: the kit's prior redundant `review` step collapses into `PR creation` to fit Phase 0 (Spec Sync) at the front. Canonical phase list is now `spec sync → analysis → branch → planning → TDD → verification → review prep → PR creation`.
- `templates/README.md` Usage step 2 grep example updated from `[A-Z_]+` to `[A-Z][A-Z0-9_]*` to match the broadened scrub-check regex (placeholders may contain digits, e.g. `{{TEST_E2E_DIR}}`).
- `BACKLOG.md` "v1.0.0 release prep" — removed `.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE.md` bullets; both ship earlier with content that earns their keep (see `specs/11-github-templates.md`). Replaced with a back-reference noting the supersession.
- Expand `.github/workflows/lint.yml` shellcheck scope from `hooks/*.sh scripts/*.sh scripts/ci/*.sh` to additionally include `templates/snippets/*.sh`. Per spec 12 §"Lint scope expansion" AC — the kit dogfoods quality gates on its own bash snippets.
- Add three template-table rows to `templates/README.md` for the new test-discipline templates (`ci-test-split-bash.sh`, `ci-pr-fast.yml.template`, `ci-nightly.yml.template`).
- Enrich `templates/claude.md.template` with four `###` sub-sections inside existing top-level sections (per `specs/13-claude-md-enrichment.md` Batch A, keeping the 8-section minimal shape from spec 02): §3 gains `### Branch Naming` (canonical `<type>/<issue-number>-<kebab-description>` + `gh issue develop` invocation; replaces the pre-existing one-line bullet). §4 gains `### Specification Discipline` (condensed pointer to methodology §B + the seven hard rules + pointer to `templates/specs/`). §7 gains `### PR Merge Process` (6-step non-negotiable checklist parameterized by `{{TEST_FULL_CMD}}` + `{{BUILD_CMD}}`). §8 replaces the prose paragraph with a trigger-action table (5 rows) and corrects the stale `methodology.md §F` reference to `§G` (post-spec-10 renumber).
- Update `templates/README.md` template-table to add `methodology-retro.md.template` row + extend `team-onboarding.md.template` row's description to mention the new 4-week ramp.
- Sweep stale `docs/methodology.md §X` references that didn't propagate during spec 10's renumber (existing §B–I → §C–J): `docs/philosophy.md` and `onboarding/week-1.md` both pointed to "§F" for the doc-on-ship rule (now §G); `templates/cheatsheet.md.template` pointed to "§H" for Multi-agent review (now §I) and "§G" for context-discipline thresholds (now §H). All five references corrected. Caught during the verification-before-completion pass per `docs/methodology.md` §F.
- `BACKLOG.md` "v1.0.0 release prep" — removed `CODE_OF_CONDUCT.md` and `SECURITY.md` bullets (both shipped via PR #19 on 2026-05-11) and consolidated the back-reference note. Only "Branch protection on `main`" remains; the entry now annotates that it's an operational task (GitHub repo settings via `gh api` or UI), not a code PR.

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
