<!--
scripts/test-fixtures/init-project/README.md
Sourcing mode: net-new (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-11
License: MIT (kit scripts ship MIT per specs/00-vision-and-license.md §"License")
-->

# init-project test fixtures

Reproducible test inputs / outputs for `scripts/init-project.sh`. Consumed by
the `init-project-fixture` job in
[`.github/workflows/bootstrap-fixture.yml`](../../../.github/workflows/bootstrap-fixture.yml).

## Layout

| Path | Purpose |
|---|---|
| `init-project-test-config.yml` | Preset YAML with all 18 placeholders for non-interactive CI runs. |
| `empty/` | Bare directory (just `.gitkeep`). Tests clean install path. |
| `partial/CLAUDE.md` | Pre-existing legacy-format `CLAUDE.md` (no kit structure). Tests backup-on-overwrite path. |
| `full/` | Known-good output of `init-project.sh <target> --config init-project-test-config.yml`. Tests idempotency baseline. |
| `full-with-ci/` | Known-good output of `init-project.sh <target> --config <preset> --snippets=nextjs --with-ci-templates`. Tests full-flag install. |

## Regenerating `full/` and `full-with-ci/`

These two fixtures are *outputs* of running `init-project.sh` against the
`init-project-test-config.yml` preset. Re-generate them after any change to
the script, the preset, or any installed template — then commit the resulting
diff alongside your source change.

From the kit repo root, on Bash 4+ (macOS users: `/opt/homebrew/bin/bash`):

```bash
# 1. Regenerate full/
rm -rf scripts/test-fixtures/init-project/full
mkdir -p scripts/test-fixtures/init-project/full
scripts/init-project.sh scripts/test-fixtures/init-project/full \
  --config scripts/test-fixtures/init-project/init-project-test-config.yml

# 2. Regenerate full-with-ci/
rm -rf scripts/test-fixtures/init-project/full-with-ci
mkdir -p scripts/test-fixtures/init-project/full-with-ci
scripts/init-project.sh scripts/test-fixtures/init-project/full-with-ci \
  --config scripts/test-fixtures/init-project/init-project-test-config.yml \
  --snippets=nextjs --with-ci-templates

# 3. Manifests have absolute paths in `installed_at` timestamps; that's fine,
#    they aren't compared byte-for-byte in CI (CI re-runs the script into
#    $RUNNER_TEMP, not against these committed fixtures). The committed
#    fixtures exist to document the expected file *shape* (which files land
#    where) and as a quick local reference for the post-install state.
```

## Invariants the CI job asserts

- All 11 one-shot targets exist after a clean install.
- No `{{...}}` placeholders remain in any installed file (a `grep -rohE`
  across the whole target tree returns empty).
- `.unify-kit-project-manifest.json` is valid JSON.
- A pre-existing target file (e.g., a legacy `CLAUDE.md`) is backed up with
  `.bak.<UTC-ts>` suffix before being overwritten.
- A second run of the same command reports `no changes needed` and does not
  create new backups.
- `--dry-run` writes nothing to the target.
- `--force` restores a tampered target to the kit version, backing up the
  tampered content first.
- `--with-ci-templates --snippets=nextjs` installs 2 workflow YAMLs, 1
  executable `ci-test-split.sh`, and 5 snippets (4 Next.js + 1 BDD-Lite).
