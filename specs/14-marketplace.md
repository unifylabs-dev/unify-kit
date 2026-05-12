# Spec 14 — Marketplace + plugin shape

> Status: Implemented in v2.0.0
> Depends on: 00 (sourcing modes, glossary), 01 (filename canon), 03 (hooks — migrated to plugin in v2)
> Related: 02 (template tier reorg ships alongside this in v2), 05 (`init-project.sh` consumer install), Claude Code marketplace + plugin documentation (verified at implementation time)

## Purpose

Specify the `.claude-plugin/marketplace.json` shape, the
`plugins/unifylabs-workflow/` plugin layout, the curation policy for external
plugins, and the drift-detection hook that keeps user-level `~/.claude/`
state aligned with the kit's plugin tree.

Replaces the v1 model where machine-level Claude Code config was installed
via `scripts/bootstrap-claude-config.sh` (deleted in v2).

## Marketplace (`.claude-plugin/marketplace.json`)

One marketplace manifest, owned by this repo. Lists the plugins this repo
*publishes*; does NOT re-export externals.

```json
{
  "name": "unify-kit",
  "owner": { ... },
  "plugins": [
    {
      "name": "unifylabs-workflow",
      "source": "./plugins/unifylabs-workflow",
      "description": "..."
    }
  ]
}
```

**Curation policy** (why we list only `unifylabs-workflow`, not the ~28
external plugins worth pairing with this kit):

1. Claude Code's `marketplace.json` schema is for plugins the marketplace
   *owns*. The working `unifylabs-dev/claude-marketplace` (archived in v2)
   shipped exactly one entry, matching this pattern.
2. Externals (`superpowers`, the Supabase suite, the full Vercel suite —
   ~28 total) come from their own marketplaces; consumers add those
   marketplaces independently via `/plugin marketplace add <url>` and then
   `/plugin install <name>`.
3. The kit documents externals in `docs/curated-plugins.md` with one-line
   descriptions + install commands. This is curation, not auto-install.
4. `compound-engineering` is explicitly excluded from `docs/curated-plugins.md`'s
   list — Tomer tried it and bounced; the kit's `~/.claude/settings.json`
   `disabledPlugins` block names it.

## Plugin (`plugins/unifylabs-workflow/`)

Single plugin published by this kit. Version `2.0.0` as of the v2 release.

```
plugins/unifylabs-workflow/
├── .claude-plugin/plugin.json          # name + version + description + author
├── README.md                            # plugin overview
├── skills/
│   ├── work-issue/SKILL.md
│   ├── ship/SKILL.md
│   ├── review-prototype/SKILL.md
│   ├── analyze-comms/                  # SKILL.md + references/
│   ├── phasing/                        # SKILL.md + evals/ + references/ + scripts/
│   ├── promote-to-marketplace/SKILL.md
│   ├── compliance-research/SKILL.md
│   ├── iterative-review/               # SKILL.md + prompts/ + references/
│   └── humanizer/                      # SKILL.md + LICENSE + README.md + WARP.md (vendored)
├── commands/
│   ├── phase.md, phase-abort.md, phase-archive.md, phase-execute.md,
│   ├── phase-list.md, phase-next.md, phase-resume.md, phase-retry.md,
│   ├── phase-status.md
│   └── iterative-review.md
├── hooks/
│   ├── claudemd-scanner.sh
│   ├── dangerous-actions-blocker.sh
│   ├── file-guard.sh
│   ├── marketplace-drift-check.sh      # NEW in v2.0.0 (SessionStart, advisory)
│   ├── mcp-config-integrity.sh
│   ├── output-secrets-scanner.sh
│   ├── pre-commit-secrets.sh
│   └── hooks.json                      # event wiring; uses ${CLAUDE_PLUGIN_ROOT}
└── statusline/
    └── statusline.sh                   # opt-in per dev (documented in README)
```

### `hooks.json` and `${CLAUDE_PLUGIN_ROOT}`

Plugin hooks register via `hooks/hooks.json`. Every `command` field MUST be
prefixed with the `${CLAUDE_PLUGIN_ROOT}` resolution token. Claude Code's
plugin loader substitutes that at runtime to the absolute path where the
plugin is installed. Example:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [{ "command": "${CLAUDE_PLUGIN_ROOT}/hooks/dangerous-actions-blocker.sh", "type": "command" }]
    }
  ]
}
```

CI enforces this invariant (see `.github/workflows/plugin-install-fixture.yml`
job `structural-validation` step "hooks.json uses CLAUDE_PLUGIN_ROOT").

## Drift detection (`marketplace-drift-check.sh`)

SessionStart hook (advisory, exit 0 always). Detects when a user has a
`~/.claude/skills/<name>/` directory that:

- is NOT a symlink into `plugins/unifylabs-workflow/skills/<name>/`, AND
- is NOT listed in `~/.claude/.personal-skills` (the user's allowlist for
  experimental skills they don't want promoted yet).

When drift is detected, the hook prints a one-line advisory to stderr
naming the drifting skill + suggesting `/promote-to-marketplace <name>`
or adding the skill to `~/.claude/.personal-skills`.

This hook does NOT block sessions, modify files, or fail loudly. It is
deliberately non-intrusive — drift is informational, not always wrong.

## Plugin install (consumer path)

```
/plugin marketplace add github.com/unifylabs-dev/unify-kit
/plugin install unifylabs-workflow
```

Claude Code's plugin loader:

1. Clones (or pulls) `github.com/unifylabs-dev/unify-kit` into its plugin
   cache (typically `~/.claude/plugins/<plugin-name>/`).
2. Reads `plugins/unifylabs-workflow/.claude-plugin/plugin.json` to verify
   plugin metadata + version.
3. Wires hooks per `plugins/unifylabs-workflow/hooks/hooks.json`,
   substituting `${CLAUDE_PLUGIN_ROOT}` to the cache path.
4. Makes skills discoverable via `/help` and the skill-listing surface.
5. Makes commands discoverable as `/phase`, `/ship`, etc.

`statusline.sh` is opt-in — users add a documented line to their own
`~/.claude/settings.json` to enable it.

## Kit-author install (Tomer-only)

`scripts/dev-symlink-skills.sh` (see CHANGELOG `[2.0.0]` "Migration from
v1.0.0"). One-time symlink migration that points `~/.claude/skills/*`,
`~/.claude/commands/*`, `~/.claude/hooks/*.sh`, `~/.claude/statusline.sh`
into this kit's `plugins/unifylabs-workflow/` tree. Atomic backup +
`--rollback` available.

**Why this exists**: Tomer authors the kit's plugin content (he wrote
`work-issue`, `ship`, etc.). He wants to edit
`~/.claude/skills/ship/SKILL.md` in his normal workflow and have the
change land directly in unify-kit's working tree (git status will show
it). The script makes user-level paths symlinks into the kit, so the
user-level edit IS the kit edit.

`dev-symlink-skills.sh` is **not** a consumer-facing script. Consumers
use the standard `/plugin install` path.

## Repo archives (v2 cutover)

Two repos archive as part of the v2 release:

- **`unifylabs-dev/phasing`** — predecessor standalone repo. The full
  `phasing/` skill content was vendored into the plugin in phase 1.
  Archive after v2 ships with a redirect README pointing at
  `github.com/unifylabs-dev/unify-kit/plugins/unifylabs-workflow/skills/phasing/`.
- **`unifylabs-dev/claude-marketplace`** — predecessor marketplace repo.
  The marketplace + plugin merged into `unify-kit/.claude-plugin/marketplace.json`
  and `unify-kit/plugins/unifylabs-workflow/`. Archive with a redirect
  README pointing at `github.com/unifylabs-dev/unify-kit`.

## Out of scope

- Submitting `unifylabs-workflow` to a public Claude Code marketplace
  registry on `claude.com` — defer to when such a registry exists; tracked
  in `BACKLOG.md`.
- Auto-installing the ~28 curated external plugins as part of
  `/plugin install unifylabs-workflow`. Externals are *documented* in
  `docs/curated-plugins.md`, not auto-installed — consumers retain
  agency over which marketplaces they trust.
- An `npx unify-kit init`-style installable kit (replacing `git clone` +
  `bash scripts/init-project.sh`). Future v2.x or v3 consideration.
- PowerShell variants of plugin hooks. Per spec 03, the kit is Bash-only;
  Windows users use WSL.

## Acceptance criteria

- [x] `.claude-plugin/marketplace.json` exists and is valid JSON.
- [x] `marketplace.json` lists `unifylabs-workflow` (and only that plugin).
- [x] `plugins/unifylabs-workflow/.claude-plugin/plugin.json` lists
      version `2.0.0` and a description enumerating 9 skills.
- [x] All 9 skill SKILL.md files have `name:` + `description:`
      frontmatter.
- [x] All 10 commands exist as `*.md` files under
      `plugins/unifylabs-workflow/commands/`.
- [x] All 7 hooks (6 v1 + new `marketplace-drift-check.sh`) ship under
      `plugins/unifylabs-workflow/hooks/` with executable bit + bash
      shebang.
- [x] `hooks/hooks.json` registers events using `${CLAUDE_PLUGIN_ROOT}`
      for every `command` field.
- [x] `docs/curated-plugins.md` exists with categorized external list
      (superpowers + Supabase suite + Vercel suite + explicit
      `compound-engineering` exclusion note).
- [x] `scripts/dev-symlink-skills.sh` exists with `--dry-run` + `--rollback`
      + atomic backup-then-symlink semantics.
- [ ] `unifylabs-dev/phasing` archived with redirect README (post-merge step).
- [ ] `unifylabs-dev/claude-marketplace` archived with redirect README
      (post-merge step).
