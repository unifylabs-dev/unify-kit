<!--
scripts/test-fixtures/init-project/README.md
Sourcing mode: net-new (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-11 (v1); rewritten 2026-05-12 for v2 ephemeral-target CI.
License: MIT (kit scripts ship MIT per specs/00-vision-and-license.md §"License")
-->

# init-project test fixtures

Reproducible test inputs for `scripts/init-project.sh`. Consumed by the
`init-project-fixture` job in
[`.github/workflows/plugin-install-fixture.yml`](../../../.github/workflows/plugin-install-fixture.yml).

## v2 model: ephemeral targets

The v2 CI fixture installs into `$RUNNER_TEMP/<scenario>/` directories on
each run and asserts structural invariants (file existence, no leftover
placeholders, manifest schema). It does NOT diff against a committed
known-good output tree — that approach proved brittle in v1 (kit-version
strings, timestamps, and platform-specific path differences caused noise).

## Layout

| Path | Purpose |
|---|---|
| `init-project-test-config.yml` | Preset YAML with all 20 placeholders for non-interactive CI runs. |
| `empty/.gitkeep` | Bare directory placeholder. Tests clean-install path use ephemeral dirs but this exists for documentation. |
| `partial/CLAUDE.md` | Pre-existing legacy-format `CLAUDE.md` (no kit structure). Tests the backup-on-overwrite path. |

## Invariants the CI job asserts

- Core tier (10 templates) installs into target on a clean run.
- Claude-runtime tier (2 templates: `.mcp.json`, `.claude/settings.json`) installs.
- No `{{...}}` placeholders remain after substitution (a `grep -rohE` across the whole target tree returns empty).
- `.unify-kit-project-manifest.json` is valid JSON containing
  `compliance_profiles`, `includes`, `snippets`, and `artifacts` keys.
- `--compliance=baseline-pipeda` lands `docs/compliance/{pipeda-readiness,
  breach-response, privacy-policy, subprocessors, audit-log-requirements}.md`
  plus `runbooks/{access-revocation, vendor-escape-template}.md` and
  appends a `compliance-addendum:baseline-pipeda` block to `CLAUDE.md`.
- `--compliance=healthcare-phipa` auto-prepends `baseline-pipeda` (extends)
  and composes the PHIPA-flavored versions over baseline's. No leftover
  `../../<profile>/...` relative links in any installed file.
- `--dry-run` writes nothing to the target.
- A re-run of the same command reports `Preserved: 0` and creates no
  backups (idempotency).
- Pre-existing user-edited `CLAUDE.md` (from `partial/`) is preserved
  without `--force`; preserved-as-edit + backed up with `.bak.<UTC-ts>`
  suffix when `--force` is passed.

## Regenerating in your dev shell

The fixtures above are static; nothing needs regenerating. To smoke-test
locally before pushing, install into `/tmp`:

```bash
# From the kit root, on Bash 4+ (macOS: /opt/homebrew/bin/bash):
TGT=$(mktemp -d)
scripts/init-project.sh "$TGT" \
  --config scripts/test-fixtures/init-project/init-project-test-config.yml \
  --compliance=healthcare-phipa --snippets=nextjs
find "$TGT" -type f | sort
```
