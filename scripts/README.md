# unify-kit scripts

This directory ships the kit-authoring CLI tools.

## Scripts

- **`init-project.sh`** — installs the kit's tier-organized templates into a
  consumer project directory with `{{...}}` placeholder substitution.
  Tier-aware: `core/` and `claude-runtime/` are always applied; `optional/`,
  `compliance/profiles/<profile>/`, and `snippets/<stack>/` are opt-in via
  `--include`, `--compliance`, and `--snippets`. Writes
  `<target>/.unify-kit-project-manifest.json` (SHA-256 + applied profiles +
  includes + snippets) for safe re-runs. See `init-project.sh --help` for the
  full flag set. Requires Bash 4+.
- **`audit-scan.sh`** — read-only health check for an existing `~/.claude/`.
  Scans `settings.json` for inline credentials and unrestricted MCP
  permissions; with `--check-plugin`, also asserts the
  `unifylabs-workflow` plugin is installed. Exit non-zero on any
  `[critical]` finding.
- **`dev-symlink-skills.sh`** — kit-author-only migration tool. Atomically
  backs up and symlinks user-level `~/.claude/skills/*` and
  `~/.claude/hooks/*` into this repo's `plugins/unifylabs-workflow/` tree so
  the kit author can edit one source of truth. Ships with `--dry-run` and
  `--rollback`. **Not consumer-facing** — consumers should use
  `/plugin install unifylabs-workflow` from a Claude session instead.

## v2 cutover (2026-05)

The v1 `bootstrap-claude-config.sh` script was retired in v2.0.0. Hook
installation now happens via the `unifylabs-workflow` plugin from
the Claude Code marketplace — see the repo-root `README.md` Quickstart.
Consumers no longer run a shell script to register hooks; the plugin's
`hooks/hooks.json` declares them and Claude Code resolves them via
`${CLAUDE_PLUGIN_ROOT}`.

## Test fixtures

Reproducible inputs for `init-project.sh` and `audit-scan.sh` live under
[`test-fixtures/`](test-fixtures/). The kit's CI workflow
`plugin-install-fixture.yml` exercises both scripts end-to-end against
those fixtures on every PR.

## Cross-platform

Bash 4+ on macOS and Linux. Windows users should run via WSL. On macOS,
install Bash 4 via `brew install bash` and invoke as
`/opt/homebrew/bin/bash scripts/<script>.sh`.

## License + source

MIT — © Unify Labs.
Source: [github.com/unifylabs-dev/unify-kit](https://github.com/unifylabs-dev/unify-kit).
