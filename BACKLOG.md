# Backlog

Items that could ship in a future release but are explicitly out of scope for v0.1. Each entry is tracked here so contributors can see what is acknowledged-but-deferred (rather than forgotten or rejected). Permanently-rejected ideas do not belong here — they live in spec "Considered alternatives" tables.

## Stretch hooks

Five candidate hooks were evaluated and deferred from the v0.1 bundle per [`specs/03-hooks.md`](specs/03-hooks.md). Adding any of them in the future requires an ADR.

- **`prompt-injection-detector.sh`** — scans tool output for known prompt-injection markers (instruction overrides embedded in fetched URLs, file contents, etc.). Deferred because the false-positive rate against the kit's stack-agnostic posture has not been characterised.
- **`repo-integrity-scanner.sh`** — verifies that the consumer repo's `.claude/`, `.mcp.json`, and CLAUDE.md files match a known-good manifest at session start. Deferred until the bootstrap manifest format (sketched in [`specs/05-scripts.md`](specs/05-scripts.md) and [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §4) has been exercised by at least one real consumer.
- **`unicode-injection-scanner.sh`** — flags suspicious Unicode (zero-width, RTL override, homoglyph) in pasted content and tool output. Deferred because the kit's existing `output-secrets-scanner.sh` and `claudemd-scanner.sh` cover the highest-priority paths; this is a useful second line that can land later.
- **`auto-format.sh`** — runs project formatters (Prettier, Black, gofmt) on edited files before commit. Deferred because formatter selection is stack-specific and conflicts with v0.1's stack-agnostic core.
- **`session-summary.sh`** — captures a per-session digest for cost tracking and retro material. Deferred until there is concrete demand from a consuming team.

## Stretch GitHub Actions

Three additional workflows were evaluated and deferred per [`specs/04-github-actions.md`](specs/04-github-actions.md). v0.1 ships only the comment-triggered review.

- **`claude-pr-auto-review.yml`** — auto-runs review on every PR open and update. Deferred with the rationale "noisy on small PRs; default OFF in v1." Once the comment-triggered variant has soaked, an ADR can opt this in for repos that want it.
- **`claude-security-review.yml`** — runs a security-focused review on PRs that touch sensitive paths. Deferred until the comment-triggered review's review-prompt has stabilised and a security-only prompt variant has been validated.
- **`claude-issue-triage.yml`** — auto-labels and triages new issues. Deferred because the triage taxonomy is consumer-specific; v1.1 may ship a configurable variant.

## Stretch scripts

Two scripts sketched in [`specs/05-scripts.md`](specs/05-scripts.md) and [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §4 are deferred from v0.1.

- **`claude-md-validator.sh`** — lints a `<consumer>/CLAUDE.md` against the kit's `templates/claude.md.template` structure (required sections present, banned synonyms absent, MCP policy referenced, etc.). Deferred to v1.1 once `templates/claude.md.template` has been used in anger.
- **`update-from-upstream.sh`** — automates "pull the new kit version → re-run bootstrap → diff against current install". Depends on the upgrade-flow contract sketched in [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §4. v0.1's upgrade story is "re-run the bootstrap script after pulling the new kit version"; automation lands in v1.1+.
- **Entry-level `--force` for `settings.json` merge** — `scripts/bootstrap-claude-config.sh`'s `--force` is currently file-level only (overwrites tampered hook `.sh` files via SHA-256 manifest comparison). Spec 05 §"Conflict-on-manual-edit" implies entry-level support too: when a consumer edits a kit-shipped settings.json entry's `command` path, `--force` should restore the kit's intended value. The current merge algorithm is append-only-dedup-by-command-string and does not detect or remove the user's substitution. Adding this requires manifest-aware merge logic that reads the manifest's recorded command string, detects divergence, and (under `--force`) removes the user's entry before the dedup append. Deferred to v0.2.0+; surfaced in v0.1.2 CHANGELOG when the corresponding CI assertion was relaxed.

## `examples/` directory

Filled-in example outputs (a sample `<consumer>/CLAUDE.md`, a sample bootstrap run, etc.) are deferred to v1.1 per [`specs/00-vision-and-license.md`](specs/00-vision-and-license.md) and [`specs/01-repo-structure.md`](specs/01-repo-structure.md). Once v0.1 has been used to bootstrap one real project end-to-end, the sanitized output of that bootstrapping becomes the v1.1 examples. v0.1 ships `templates/snippets/` for opt-in stack fragments; full filled-in examples come later.

## Multi-stack `claude.md.template` flavors

The kit ships a stack-agnostic core `templates/claude.md.template` plus opt-in `templates/snippets/` for stack-specific fragments per [`specs/02-templates.md`](specs/02-templates.md) decision 2. Multi-flavor expansion (e.g. a Next.js variant, a Rails variant, a Go variant of the full template) is deferred until at least two consuming teams have run into a real limitation with the stack-agnostic core plus snippets approach.

## PowerShell variants of hooks and scripts

v0.1 hooks and scripts are Bash-only; Windows users use WSL per [`specs/03-hooks.md`](specs/03-hooks.md) and [`specs/05-scripts.md`](specs/05-scripts.md). A PowerShell port requires an ADR — the attack surface of duplicate implementations is non-trivial, and v0.1 CI does not have Windows fixtures. The port is welcome as a contribution from someone who runs Windows daily and can maintain the Windows test matrix.

## v1.0.0 release prep

The following artifacts are required at v1.0.0 release per [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §5 but are not v0.1 gates. They land in a follow-up phase or a v0.1.x patch run.

- **Branch protection on `main`** — required reviews, required status checks, no force-push. Operational task (GitHub repo settings via `gh api` or UI), not a code PR. Tracked here so the v1.0.0 release-prep checklist stays complete until the protection rules are enabled.

> Previously listed here:
>
> - `.github/ISSUE_TEMPLATE/` (bug + feature) and `.github/PULL_REQUEST_TEMPLATE.md` — shipped via `specs/11-github-templates.md` with content that earns their keep (issue templates' "Spec sections affected" required field gates `/work-issue` Phase 0; PR template's `## Spec Changes` two-checkbox section forces the explicit "spec updated vs drift fix" decision). An ADR-proposal issue template was considered and rejected in spec 11 §"What does NOT land in this spec" — revisit if/when contributor volume warrants it.
> - `CODE_OF_CONDUCT.md` (Contributor Covenant) and `SECURITY.md` (vulnerability disclosure process) — shipped via PR #19 on 2026-05-11.

## Aggregator submission

Optional at v1.0.0 release per [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §7. Candidates include awesome-claude-code lists and Claude Code community indexes. Submission is the kit author's call at release time; not a release gate.

## Bootstrap script's machine-state install on author's own `~/.claude/`

The bootstrap script we ship targets `~/.claude/` on a consumer's machine. Installing it on the author's own machine is explicitly out of v0.1 implementation scope per the master plan — the implementation phases land the script artifact, not the side effect of running it on the author's box. Tracked here as a manual follow-up so it does not get lost.
