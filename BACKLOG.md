# Backlog

Items that could ship in a future release but are explicitly out of scope for the current version. Each entry is tracked here so contributors can see what is acknowledged-but-deferred (rather than forgotten or rejected). Permanently-rejected ideas do not belong here — they live in spec "Considered alternatives" tables.

## v2.1+ candidates

Items surfaced during v2.0.0 design + cutover; not in v2.0.0 scope.

- **Compliance profiles beyond the initial 4** — GDPR (EU), CCPA (California), FERPA (US education), HIPAA-US, PCI-DSS. Add when a real Unifylabs project needs them. Each profile is ~8–10 files (`README.md`, 5–6 `docs/compliance/*`, 1–2 runbooks, `claude-md-addendum.md`) following the existing template structure under `templates/compliance/profiles/`.
- **Migrate `unify-rolfing-app`, `optics-management/optics_boutique`, `wealth-portal` to consume v2** — per-project effort after v2 ships. Each project: install plugin, run `init-project.sh --compliance=<profile> --snippets=nextjs` to bring CLAUDE.md / docs/compliance / .mcp.json / .claude/settings.json in line with v2 standards.
- **Statusline auto-install option in `dev-symlink-skills.sh`** — currently the statusline opt-in is documented; could become an interactive prompt during the migration ("install statusline now? [y/N]").
- **Plugin marketplace listing on `claude.com`** (or whichever canonical Claude Code marketplace registry emerges) — submit `unifylabs-workflow` for discoverability beyond the `github.com/unifylabs-dev/unify-kit` path.
- **Multi-language compliance translations** (e.g., French versions of breach-response / privacy-policy for Quebec) — pull when a Quebec client demands them.
- **Hook-firing CI validation** in `plugin-install-fixture.yml` — currently the runner doesn't have the `claude` CLI available, so we structurally validate hook scripts (executable, shebang, `${CLAUDE_PLUGIN_ROOT}` resolution) but don't fire them end-to-end. If Claude Code ships a headless CLI invocation path, wire it into a new CI job that runs `git commit` with a fake `sk-ant-test...` in staged content and asserts the pre-commit-secrets hook blocks.

## Pre-existing items (carried forward from v1.x)

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

- **`claude-md-validator.sh`** — lints a `<consumer>/CLAUDE.md` against the kit's `templates/core/claude.md.template` structure (required sections present, banned synonyms absent, MCP policy referenced, etc.). Deferred to v2.x once `templates/core/claude.md.template` has been used across more real projects.
- **`update-from-upstream.sh`** — automates "pull the new kit version → re-run `init-project.sh` → diff against current install". Depends on the upgrade-flow contract sketched in [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §4. The current upgrade story is "re-run `init-project.sh` after pulling the new kit version"; automation lands in v2.x+.

<!--
v1.0.x item "Entry-level `--force` for `settings.json` merge" referred to
the now-deleted `scripts/bootstrap-claude-config.sh`. With v2.0.0, that
script's merge algorithm is gone — Claude Code's plugin loader owns
hook discovery, so the entry-level merge concern is moot.
-->


## `examples/` directory

Filled-in example outputs (a sample `<consumer>/CLAUDE.md`, a sample bootstrap run, etc.) are deferred to v1.1 per [`specs/00-vision-and-license.md`](specs/00-vision-and-license.md) and [`specs/01-repo-structure.md`](specs/01-repo-structure.md). Once v0.1 has been used to bootstrap one real project end-to-end, the sanitized output of that bootstrapping becomes the v1.1 examples. v0.1 ships `templates/snippets/` for opt-in stack fragments; full filled-in examples come later.

## Multi-stack `claude.md.template` flavors

The kit ships a stack-agnostic core `templates/core/claude.md.template` plus opt-in `templates/snippets/<stack>/` for stack-specific fragments per [`specs/02-templates.md`](specs/02-templates.md) decision 2. Multi-flavor expansion (e.g. a Next.js variant, a Rails variant, a Go variant of the full template) is deferred until at least two consuming teams have run into a real limitation with the stack-agnostic core plus snippets approach.

## PowerShell variants of hooks and scripts

v0.1 hooks and scripts are Bash-only; Windows users use WSL per [`specs/03-hooks.md`](specs/03-hooks.md) and [`specs/05-scripts.md`](specs/05-scripts.md). A PowerShell port requires an ADR — the attack surface of duplicate implementations is non-trivial, and v0.1 CI does not have Windows fixtures. The port is welcome as a contribution from someone who runs Windows daily and can maintain the Windows test matrix.

<!--
v1.0.0 release-prep section removed in v2.0.0:
- Branch protection on `main` was enforced before v1.0.0 shipped (per v1.0.0
  CHANGELOG entry).
- `.github/ISSUE_TEMPLATE/` + `.github/PULL_REQUEST_TEMPLATE.md` shipped via
  spec 11.
- `CODE_OF_CONDUCT.md` + `SECURITY.md` shipped via PR #19 on 2026-05-11.
-->


## v1.0.1 follow-ups surfaced during v1.0.0 dogfood

Two integration issues surfaced during the v1.0.0 run's Phase 2 dogfood (commit `f3226a4` ships the two fixes that did stick). These remain open and ship in v1.0.1+:

- **`/claude-review` workflow's `prompt:`-input mode bypasses comment-posting code path.** With `f3226a4`'s fixes (id-token + drop restrictive `--allowed-tools` + raise `--max-turns`), the workflow now runs Claude through the API successfully (`num_turns: 1`, `total_cost_usd: $0.087`, `is_error: false`) but `anthropics/claude-code-action@v1`'s auto-post-comments step logs `No buffered inline comments` and posts nothing to the PR. Hypothesis: the action's `prompt:` input mode treats Claude's response as final text output and skips the comment-posting code path that activates when the action handles `/claude-review`-style triggers itself. Investigation needs reading `https://github.com/anthropics/claude-code-action/blob/main/src/entrypoints/run.ts` + `src/mcp/install-mcp-server.ts` to map the action's mode-detection logic. Possible fixes: (a) restructure workflow to not use `prompt:` and let the action handle the comment-event itself with system-prompt injection via a different mechanism; (b) keep `prompt:` and add an explicit "post comment" step that scrapes Claude's response; (c) upstream contribution to the action. Estimated 2-4h investigation before a fix path is clear. Repro: open a PR on `unifylabs-dev/unify-kit-example-nextjs`, comment `/claude-review`, observe workflow runs to completion with no comment posted.

- **`templates/snippets/ci/ci-pr-fast.yml.template` assumes `npm test` exists.** When init-project.sh installs `--with-ci-templates` against a `create-next-app` scaffold that doesn't define a `test` script in `package.json`, the resulting `.github/workflows/ci.yml` fails on `main`. The template should either (a) make the test step conditional on `package.json` having a `test` script, (b) document the prerequisite in `templates/README.md`, or (c) ship a default no-op `npm test` stub via init-project.sh's snippet install. Repro: `unify-kit-example-nextjs` repo's failing `CI` workflow on `main`.

## Aggregator submission

Optional at v1.0.0 release per [`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md) §7. Candidates include awesome-claude-code lists and Claude Code community indexes. Submission is the kit author's call at release time; not a release gate.

<!--
v1.0.0 item "Bootstrap script's machine-state install on author's own ~/.claude/"
was absorbed in v2.0.0 by `scripts/dev-symlink-skills.sh`, which now ships as
the kit-author migration tool (backs up `~/.claude/skills/*` + commands/hooks
+ statusline, then symlinks user-level paths into the plugin tree).
-->

