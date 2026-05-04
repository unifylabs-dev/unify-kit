# Spec 05 — Scripts

> Status: Draft / awaiting review
> Depends on: 00 (sourcing modes, glossary), 01 (filename canon), 03 (hook bundle), Claude Code hook schema (verified at implementation time)
> Related: 02 (templates), 09 (kit's own CI runs the bootstrap script against fixtures)

## Purpose

Specify the executable utilities shipped in `scripts/`: bootstrap, audit-scan, and
the test fixtures both depend on.

## v1 scripts

### 1. `bootstrap-claude-config.sh` — sourcing mode: net-new (no Ultimate Guide source)

The single command a new dev runs after cloning a project that uses this kit. Stands
up their `~/.claude` to the project's expectations.

**Behavior:**

1. **Pre-flight checks:**
   - `claude --version` succeeds; fail with install link if not.
   - `~/.claude/` exists; create if missing.
   - Bash 4+ or zsh; warn otherwise.
2. **Hook installation:**
   - For each hook in `hooks/`: copy to `~/.claude/hooks/<name>.sh`, `chmod +x`.
   - Skip hooks that are already up-to-date (compare SHA-256).
   - If overwriting, back up the existing file to
     `~/.claude/hooks/<name>.sh.bak.<timestamp>`.
3. **Settings registration** — see merge algorithm below.
4. **Post-install verification:**
   - Confirm each hook is in `~/.claude/hooks/`.
   - Confirm each hook is registered in `~/.claude/settings.json`.
   - Print summary: "Installed N hooks. Registered N hooks. Backups at <paths>."
5. **Optional flags** (v1 — minimal):
   - `--dry-run` — print what would happen, don't modify anything.
   - `--force` — overwrite without prompting.

**Idempotent:** running twice on a clean state should produce no changes.

**Failure modes:**

- `~/.claude/settings.json` invalid JSON → abort with clear error; do not modify.
- Hook script fails `chmod +x` → abort.
- Disk full / permission denied → abort.

### Settings-merge algorithm (the contract)

The script merges `hooks/settings-snippet.json` into `~/.claude/settings.json`
under the `hooks` key. The algorithm is deterministic and idempotent.

**Pseudocode:**

```
existing = read_json(~/.claude/settings.json) || {}
snippet  = read_json(hooks/settings-snippet.json)

backup(existing, ~/.claude/settings.json.bak.<ts>)

for event in [PreToolUse, PostToolUse, SessionStart, ...]:
  existing.hooks[event] ||= []
  for snippet_entry in snippet.hooks[event]:
    matching = find existing.hooks[event] where matcher == snippet_entry.matcher
    if matching:
      # matcher already present → append commands not already present
      for cmd in snippet_entry.hooks:
        if cmd.command not in matching.hooks (by `command` string):
          matching.hooks.append(cmd)
        # else: already registered, skip silently (idempotent)
    else:
      # matcher missing → add new entry
      existing.hooks[event].append(snippet_entry)

write_json(~/.claude/settings.json, existing)
```

**Worked examples** (live in `scripts/README.md`):

**Example A — clean install** (no `~/.claude/settings.json` yet)

Before: file does not exist.
After: file equals `hooks/settings-snippet.json` exactly.

**Example B — additive install** (consumer has unrelated hooks already)

Before:
```json
{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "command": "~/.claude/hooks/my-custom-hook.sh", "type": "command" }] }] } }
```

After (merged):
```json
{ "hooks": { "PreToolUse": [
  { "matcher": "Bash", "hooks": [
    { "command": "~/.claude/hooks/my-custom-hook.sh", "type": "command" },
    { "command": "~/.claude/hooks/dangerous-actions-blocker.sh", "type": "command" }
  ]},
  { "matcher": "Bash(git commit:*)", "hooks": [{ "command": "~/.claude/hooks/pre-commit-secrets.sh", "type": "command" }] },
  { "matcher": "Edit|Write", "hooks": [{ "command": "~/.claude/hooks/file-guard.sh", "type": "command" }] }
] } }
```

The user's `my-custom-hook.sh` is preserved; ours appended on the same matcher.

**Example C — re-run idempotency** (consumer has run bootstrap before)

Before: `~/.claude/settings.json` already contains all kit hooks.
After: identical to before. Script reports "no changes needed."

**Tilde expansion:** tilde paths in `command` fields stay literal in JSON. Claude
Code expands them at runtime. The bootstrap script never pre-expands.

**Scope:** the script operates on `~/.claude/settings.json` only. It does **not**
touch `~/.claude/settings.local.json` (which can contain user-specific permissions
including credentials per the optics-management finding). `audit-scan.sh` covers
`settings.local.json`.

**Conflict-on-manual-edit:** if a consumer has manually edited a kit-shipped hook
entry (e.g., changed the `command` path), the script preserves their edit and skips
the entry. `--force` overwrites; `--dry-run` reports the divergence.

### 2. `audit-scan.sh` — sourcing mode: `customization`

Authored from the patterns documented in
`github.com/FlorianBruniaux/claude-code-ultimate-guide/examples/scripts/audit-scan.sh`
(upstream is CC BY-SA 4.0; we cite as pattern reference, do not lift expression —
see [`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md)).
Scans a Claude Code config and reports security/quality issues in human-readable
or JSON format.

**Use cases:**

- New dev runs it on day 1 after `bootstrap-claude-config.sh` to confirm a green setup.
- Existing dev runs it monthly as a config-drift check.
- Spec 09's CI runs it (via `bootstrap-fixture.yml`) against fixtures.

**What it checks (v1 minimum):**

- `~/.claude/settings.json` parses as valid JSON.
- All registered hooks exist on disk.
- All registered hooks are executable.
- `enableAllProjectMcpServers: true` without an explicit allowlist → **warning**.
- Inline `Bash` permission entries containing `postgresql://`, `mongodb://`,
  `mysql://`, AWS access keys, OpenAI keys, Anthropic keys → **critical**.
  (This is the optics-management finding pattern — a real protection.)
- All `enabledMcpjsonServers` documented in the project's `mcp-policy.md`
  (if present) → **warning** if undocumented.
- Plugin versions match `~/.claude/plugins/installed_plugins.json` (no stale entries
  per the registered marketplaces) → **info**.

**Sourcing:** the whole script is original expression. The kit-specific checks
(inline-credential and MCP-policy) live in a clearly-labeled "Kit-specific checks"
block at the bottom of the file so the structure stays modular. Header comment
cites the upstream pattern reference per the format documented in spec 00 §"Sourcing
modes" for `customization`.

### 3. `scripts/test-fixtures/` — sourcing mode: net-new

Reproducible fixtures the kit's own CI runs against. Two files in v1:

- `settings.json.good-fixture` — a hand-crafted "all kit hooks correctly registered,
  no inline credentials, MCP allowlist documented" config. `audit-scan.sh` against
  this exits 0 with zero findings.
- `settings.json.bad-fixture` — a hand-crafted "inline `Bash(node -e ...
  postgresql://user:password@host...)` entry, `enableAllProjectMcpServers: true`,
  hook registered but file missing" config. `audit-scan.sh` against this exits
  non-zero with `inline-credential`, `unrestricted-mcp`, and `missing-hook-file`
  findings.

Fixtures are checked by spec 09's `bootstrap-fixture.yml` workflow.

## Stretch (v1.1+ / opt-in)

Out of v1. Tracked in `BACKLOG.md` per spec 08:

- `claude-md-validator.sh` — sanity-check a CLAUDE.md against the kit's expectations
- `update-from-upstream.sh` — sync new kit versions into a consumer's `~/.claude`
  (depends on the upgrade-flow contract — spec 08 §"Upgrade flow")

## Decisions needed

All script-level decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | Bootstrap script destructiveness | Prompt before overwriting; offer `--force`; always create backups. `--no-backup` is removed (footgun risk). |
| 2 | Should bootstrap install audit-scan to `~/.local/bin/`? | No. `audit-scan.sh` runs from the repo (`./scripts/audit-scan.sh`). |
| 3 | Cross-platform | Bash + macOS/Linux only for v1. WSL for Windows. |
| 4 | Validator scope | `claude-md-validator.sh` deferred to BACKLOG. |
| 5 | Self-update mechanism | `update-from-upstream.sh` deferred to BACKLOG; the upgrade contract is sketched in spec 08. |
| 6 | Optional flags | Minimal: `--dry-run` and `--force` only. `--no-backup` and `--hooks <list>` removed (premature configurability per review). |

## Out of scope

- A binary or compiled tool; everything is shell scripts.
- Distributing scripts via Homebrew, npm, or other package managers.
- Encrypted credential management. The repo doesn't ship secrets.

## Acceptance criteria

- `bootstrap-claude-config.sh` runs end-to-end on a fresh `~/.claude/` and produces
  the expected state (hooks installed, settings registered, backups in place).
  Verified by spec 09's `bootstrap-fixture.yml`.
- Running `bootstrap-claude-config.sh --dry-run` on the same machine after a
  successful run prints "no changes needed" (idempotency).
- `bootstrap-claude-config.sh --force` overwrites a manually-edited kit-shipped
  hook entry and creates a backup of the prior `settings.json`.
- All three settings-merge worked examples (A, B, C) reproduce in
  `bootstrap-fixture.yml`.
- `audit-scan.sh test-fixtures/settings.json.bad-fixture` exits non-zero with
  `inline-credential` (and other expected) findings flagged.
- `audit-scan.sh test-fixtures/settings.json.good-fixture` exits 0 with zero
  findings.
- Both scripts have a `--help` flag with usage info.
- Both scripts use `set -euo pipefail` and are shellcheck-clean (gated by spec 09's
  lint workflow).

## Revisions

Addressed: R-017 (settings-merge algorithm pinned with three worked examples;
tilde-expansion behavior, settings.local.json scope, manual-edit conflict resolution
all stated explicitly), R-022 (`--no-backup` flag removed — backups are mandatory),
R-023 (`--hooks <list>` flag removed — bundle is bundle), R-024 (test fixtures added
in `scripts/test-fixtures/`; acceptance criteria reproducible via fixtures).

**v0.3 revision (2026-05-04):** `audit-scan.sh` reclassified from `verbatim` to
`customization` for the same upstream-license reason as the hook bundle (CC BY-SA
4.0 not CC0). The "Kit additions" block becomes "Kit-specific checks" — there are
no longer "additions on top of an upstream lift" because the whole script is now
original expression. See
[`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md).
