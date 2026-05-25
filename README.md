# unify-kit

> Tomer's principles + plugin curation kit for Claude Code. One repo,
> three roles: marketplace, plugin, template-tier scaffolding.

[![lint](https://github.com/unifylabs-dev/unify-kit/actions/workflows/lint.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/lint.yml)
[![scrub-check](https://github.com/unifylabs-dev/unify-kit/actions/workflows/scrub-check.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/scrub-check.yml)
[![plugin-install-fixture](https://github.com/unifylabs-dev/unify-kit/actions/workflows/plugin-install-fixture.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/plugin-install-fixture.yml)
[![changelog-check](https://github.com/unifylabs-dev/unify-kit/actions/workflows/changelog-check.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/changelog-check.yml)

---

## What it is

A Claude Code kit that ships:

- A **marketplace** (`.claude-plugin/marketplace.json`) curating the
  `unifylabs-workflow` plugin.
- A **plugin** (`plugins/unifylabs-workflow/`) bundling 11 skills
  (`work-issue`, `ship`, `phasing`, `extract-prototype-review`,
  `integrate-branch`, `analyze-comms`, `promote-to-marketplace`,
  `compliance-research`, `iterative-review`, `humanizer`, `handoff`),
  16 commands (the 9 `phase*` set plus `iterative-review`, the 5
  `handoff*` commands, and `/phase-continue`), 8 security/workflow hooks
  (including `context-awareness`; resolved via `${CLAUDE_PLUGIN_ROOT}`),
  and an opt-in statusline.
- A **template tree** (`templates/`) organized into tiers — `core/`,
  `claude-runtime/`, `optional/`, `compliance/profiles/{baseline-pipeda,
  healthcare-phipa, financial-canada, general-soc2}/`, and
  `snippets/{nextjs,testing,ci}/`.
- Per-project scaffolding via [`scripts/init-project.sh`](scripts/init-project.sh)
  with `--compliance=<profile>` (PIPEDA / PHIPA / financial-Canada / SOC 2),
  `--include=<name>`, and `--snippets=<stack>` flags.

External plugins worth pairing with this kit (`superpowers`, the Supabase
suite, the full Vercel suite — ~28 total) are documented in
[`docs/curated-plugins.md`](docs/curated-plugins.md). `compound-engineering`
is explicitly **not** curated (opted out).

---

## Quick start

### One time per machine

From any Claude Code session:

```
/plugin marketplace add github.com/unifylabs-dev/unify-kit
/plugin install unifylabs-workflow
```

That registers the marketplace + installs the plugin (skills, commands,
hooks, statusline). Verify with `/help` — you should see `work-issue`,
`ship`, `phasing`, `compliance-research`, the full `phase*` command set,
and the rest.

### Per new project

Clone or `mkdir` your project, then from this repo's root:

```bash
bash scripts/init-project.sh /path/to/your-project \
  --compliance=healthcare-phipa --snippets=nextjs
```

Scaffolds CLAUDE.md (with PHIPA addendum), CHEATSHEET.md, AI usage charter,
MCP policy, security checklist, `.mcp.json` skeleton, `.claude/settings.json`,
GitHub PR + issue templates, CODEOWNERS, docs/specs/, docs/compliance/ +
runbooks/ for the named profile(s), and a SHA-256 manifest at
`<project>/.unify-kit-project-manifest.json` for safe re-runs.

Other flag combinations:

```bash
# Default Canadian project (no compliance, no snippets):
bash scripts/init-project.sh ./my-project --config <my.yml>

# Canadian fintech doing enterprise sales (extends + composition):
bash scripts/init-project.sh ./my-fintech --config <my.yml> \
  --compliance=financial-canada,general-soc2 --snippets=nextjs

# Opt into the team-onboarding doc:
bash scripts/init-project.sh ./my-project --config <my.yml> \
  --include=team-onboarding
```

See [`templates/README.md`](templates/README.md) for the full tier
inventory and `bash scripts/init-project.sh --help` for the flag table.

### Kit-author one-time setup (Tomer's box only)

After pulling v2.0.0:

```bash
bash scripts/dev-symlink-skills.sh
```

Backs up `~/.claude/skills/*`, `~/.claude/commands/*`, `~/.claude/hooks/*.sh`,
and `~/.claude/statusline.sh` to `~/.claude/.v2-migration-backup-<UTC-ts>/`,
then symlinks the user-level paths into this kit's
`plugins/unifylabs-workflow/...` tree. Result: editing
`~/.claude/skills/ship/SKILL.md` in your normal workflow lands directly in
the kit's working tree. `--dry-run` and `--rollback` available. This is
**not** a consumer-facing script — consumers use `/plugin install`.

---

## What's new in v2

- Plugin install replaces the old `bootstrap-claude-config.sh` (deleted).
- Hooks moved from `unify-kit/hooks/` to `plugins/unifylabs-workflow/hooks/`
  with `${CLAUDE_PLUGIN_ROOT}` path resolution. Hook *content* unchanged.
- Templates reorganized into 5 tiers (`core/`, `claude-runtime/`, `optional/`,
  `compliance/`, `snippets/{nextjs,testing,ci}/`).
- Per-project compliance subsystem: 4 profiles (`baseline-pipeda`,
  `healthcare-phipa` extends baseline, `financial-canada` extends baseline,
  `general-soc2`) + composition mechanism.
- `/compliance-research` skill (interactive industry/geo/regulator walkthrough
  using `context7` + `WebSearch` to ground on current regulatory text).
- `iterative-review` skill + command (bounded review-fix-verify loop with
  auto-detected code / doc / phase mode).
- `humanizer` skill (vendored; remove AI-writing tells from text).
- Vocabulary grew from 18 placeholders to 20 (`{{REPO_OWNER}}` for CODEOWNERS,
  `{{COMPLIANCE_PROFILE}}` for addenda).

See [`CHANGELOG.md`](CHANGELOG.md) `[2.0.0]` for the full migration block.

---

## What's in the box

- [`plugins/unifylabs-workflow/`](plugins/unifylabs-workflow/) — the plugin
  (skills, commands, hooks, statusline). See its
  [`README.md`](plugins/unifylabs-workflow/README.md) for the per-skill
  table.
- [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) —
  marketplace manifest; lists `unifylabs-workflow`.
- [`templates/`](templates/) — 5-tier template tree. See
  [`templates/README.md`](templates/README.md) for the inventory + flag
  contract; [`templates/compliance/README.md`](templates/compliance/README.md)
  for the profile composition rules.
- [`scripts/`](scripts/) — `init-project.sh` (per-project scaffold),
  `audit-scan.sh` (read-only health check), `dev-symlink-skills.sh`
  (kit-author migration).
- [`docs/`](docs/) — [`philosophy.md`](docs/philosophy.md),
  [`methodology.md`](docs/methodology.md),
  [`curated-plugins.md`](docs/curated-plugins.md),
  [`decisions/`](docs/decisions/) ADRs.
- [`specs/`](specs/) — pre-implementation specs (00–14). Spec 03 is amended
  for the plugin migration; spec 14 covers the marketplace.
- [`onboarding/`](onboarding/) — Day-1 / week-1 / day-30 curriculum.

---

## Status

`v2.0.0` — released 2026-05-12. Cuts over from v1.0.0's
`bootstrap-claude-config.sh` model to the Claude Code marketplace + plugin
model. See [`CHANGELOG.md`](CHANGELOG.md) for the full `[2.0.0]` block
including the "Migration from v1.0.0" section.

Items deferred to v2.1+ live in [`BACKLOG.md`](BACKLOG.md).

---

## Compatibility

Bash + macOS / Linux. Windows users use WSL. `init-project.sh` and
`dev-symlink-skills.sh` both require Bash 4+ (associative arrays) — on
macOS, install via `brew install bash` and invoke as
`/opt/homebrew/bin/bash scripts/<name>.sh ...`. The plugin's hooks +
statusline are Bash 3.2-compatible.

---

## License

MIT for code, CC0 1.0 for templates, CC BY-SA 4.0 for narrative documentation.
See [`LICENSE`](LICENSE) for the full breakdown.

---

## Contributing

Spec-first per [`CONTRIBUTING.md`](CONTRIBUTING.md). Open an issue describing
the change, write a numbered spec under [`specs/`](specs/), get review,
implement; every PR that touches a kit artifact updates `CHANGELOG.md`'s
`[Unreleased]` block (the kit's own
[`changelog-check.yml`](.github/workflows/changelog-check.yml) workflow
enforces this).

---

## Acknowledgments

Hooks, the `audit-scan` script's core, and the security-checklist OWASP spine
are lifted (or distilled) from
[`github.com/FlorianBruniaux/claude-code-ultimate-guide`](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)
under that project's CC0 examples sub-tree, with header comments preserving
provenance per the kit's
[`docs/decisions/0001-hook-bundle-licensing.md`](docs/decisions/0001-hook-bundle-licensing.md).
The `humanizer` skill is vendored from
[`devnen/Humanizer-Skill`](https://github.com/devnen/Humanizer-Skill) under
MIT.
