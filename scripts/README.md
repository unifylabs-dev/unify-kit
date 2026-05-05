# unify-kit scripts

This directory ships two consumer-facing Bash scripts:

- **`bootstrap-claude-config.sh`** — installs the kit's six security hooks into
  `~/.claude/hooks/` and registers them in `~/.claude/settings.json`. Idempotent;
  re-running on a clean state reports "no changes needed".
- **`audit-scan.sh`** — checks an existing `~/.claude/settings.json` (or any
  fixture) for inline credentials, unrestricted MCP servers, and missing hook
  files. Exit non-zero on any `[critical]` finding.

Both target Bash 4+ on macOS / Linux. Per-hook documentation lives in
[`hooks/README.md`](../hooks/README.md). Reproducible test inputs for both
scripts live in [`test-fixtures/`](test-fixtures/).

---

## `bootstrap-claude-config.sh`

### Usage

```
scripts/bootstrap-claude-config.sh [--dry-run | --force] [--help]
```

### Flags

| Flag | Effect |
|---|---|
| `--dry-run` | Preview every change. Does not create directories, copy files, write `settings.json`, or write the manifest. |
| `--force` | Overwrite kit-shipped hook files that have been manually edited since the last install. Backups are still created. |
| `--help`, `-h` | Print usage and exit 0. |

`--no-backup` and `--hooks <list>` are intentionally **not** available — backups
are mandatory and the bundle ships as a unit. See `specs/05-scripts.md` decision
table #6.

### What it does

1. **Pre-flight** — checks `jq` is on `PATH`, picks `shasum` or `sha256sum`,
   warns (but does not fail) if `claude` is missing.
2. **Installs hooks** — copies `hooks/*.sh` into `~/.claude/hooks/`, `chmod +x`.
   Skips files that already match the kit's SHA-256 (idempotent).
3. **Backs up** existing `~/.claude/settings.json` to
   `~/.claude/settings.json.bak.<UTC-timestamp>` whenever a write is required.
4. **Merges** `hooks/settings-snippet.json` into `~/.claude/settings.json`
   under `.hooks` per the spec-05 settings-merge algorithm. Tilde paths in
   `command` fields stay literal — Claude Code expands at runtime.
5. **Writes manifest** — creates `~/.claude/.unify-kit-manifest.json` recording
   the kit version, install timestamp, and per-artifact SHA-256.

After every step the script verifies that each hook is present and executable
and that each `command` string from the snippet is registered in
`settings.json`. Verification failures abort with a non-zero exit.

### Idempotency

Running the script a second time on a clean install produces zero
modifications: every hook is reported `up-to-date`, `settings.json` is
reported `up-to-date`, no backup is created, and the script prints
`no changes needed`.

### Worked examples

The CI workflow `bootstrap-fixture.yml` (spec 09) reproduces these examples
end-to-end against the fixtures in `test-fixtures/`. If you change the
behavior, update the examples here in lockstep with the script.

#### Example A — clean install

The consumer has never run the script. `~/.claude/settings.json` does not
exist.

**Before** — `~/.claude/settings.json` does not exist.

**After** — `~/.claude/settings.json` is the snippet exactly:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "command": "~/.claude/hooks/dangerous-actions-blocker.sh", "type": "command" }] },
      { "matcher": "Bash(git commit:*)", "hooks": [{ "command": "~/.claude/hooks/pre-commit-secrets.sh", "type": "command" }] },
      { "matcher": "Edit|Write", "hooks": [{ "command": "~/.claude/hooks/file-guard.sh", "type": "command" }] }
    ],
    "PostToolUse": [
      { "matcher": "*", "hooks": [{ "command": "~/.claude/hooks/output-secrets-scanner.sh", "type": "command" }] }
    ],
    "SessionStart": [
      { "matcher": "*", "hooks": [
        { "command": "~/.claude/hooks/claudemd-scanner.sh", "type": "command" },
        { "command": "~/.claude/hooks/mcp-config-integrity.sh", "type": "command" }
      ]}
    ]
  }
}
```

**Run output (excerpt):**

```
installed claudemd-scanner.sh
installed dangerous-actions-blocker.sh
installed file-guard.sh
installed mcp-config-integrity.sh
installed output-secrets-scanner.sh
installed pre-commit-secrets.sh
settings.json: updated
Installed 6/6 hooks. Registered 6 hooks. Backups: none
```

#### Example B — additive install

The consumer already has unrelated hooks of their own.

**Before** — `~/.claude/settings.json`:

```json
{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "command": "~/.claude/hooks/my-custom-hook.sh", "type": "command" }] }] } }
```

**After** — merged. The user's `my-custom-hook.sh` is preserved; the kit's
`dangerous-actions-blocker.sh` is appended on the same `Bash` matcher; the new
matchers (`Bash(git commit:*)`, `Edit|Write`, etc.) are added as separate
entries.

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

(`PostToolUse` and `SessionStart` are added below in the same way; omitted here
for brevity.)

**Run output (excerpt):**

```
installed dangerous-actions-blocker.sh
installed file-guard.sh
... (other hooks)
backed up ~/.claude/settings.json -> ~/.claude/settings.json.bak.20260504T120000Z
settings.json: updated
Installed 6/6 hooks. Registered 6 hooks. Backups: ~/.claude/settings.json.bak.20260504T120000Z
```

#### Example C — re-run idempotency

The consumer has run the script once successfully. They run it again.

**Before** — `~/.claude/settings.json` already contains all kit hooks; every
hook in `~/.claude/hooks/` matches the kit's SHA-256.

**After** — identical to before. No file mtime is updated, no backup is
created, no manifest rewrite occurs.

**Run output:**

```
up-to-date claudemd-scanner.sh
up-to-date dangerous-actions-blocker.sh
up-to-date file-guard.sh
up-to-date mcp-config-integrity.sh
up-to-date output-secrets-scanner.sh
up-to-date pre-commit-secrets.sh
settings.json: up-to-date
Installed 6/6 hooks. Registered 6 hooks. Backups: none
no changes needed
```

### Failure modes

- **`~/.claude/settings.json` is not valid JSON** — script aborts with a clear
  `ERROR:` message and **does not modify** any file.
- **`jq` not on PATH** — script aborts with install guidance
  (`brew install jq` / `apt install jq`).
- **`chmod +x` fails on a hook** — `set -euo pipefail` aborts the script;
  partial state may exist (any successfully-copied hooks remain in place).
- **Disk full / permission denied** — abort with stderr from the failing
  operation. Re-run the script after fixing the underlying issue.
- **Manual edit detected without `--force`** — the script prints a `WARNING:`
  per affected hook and skips it. Re-run with `--force` to overwrite (a backup
  of the consumer's edit is created first).

### `~/.claude/.unify-kit-manifest.json`

Sample manifest after a clean install:

```json
{
  "kit_version": "0.1.0-dev",
  "installed_at": "2026-05-04T18:00:00Z",
  "source": "https://github.com/unifylabs-dev/unify-kit",
  "artifacts": {
    "hooks/claudemd-scanner.sh": "<sha256>",
    "hooks/dangerous-actions-blocker.sh": "<sha256>",
    "hooks/file-guard.sh": "<sha256>",
    "hooks/mcp-config-integrity.sh": "<sha256>",
    "hooks/output-secrets-scanner.sh": "<sha256>",
    "hooks/pre-commit-secrets.sh": "<sha256>"
  }
}
```

The manifest enables safe re-runs by recording which kit version installed each
artifact at what SHA-256. On the next run the script compares each installed
file against its recorded SHA — matches mean kit-installed (safe to overwrite
when the kit ships a new version); mismatches mean consumer-edited (preserve
unless `--force`). This is the basis of the upgrade-flow contract documented in
`specs/08-living-docs-and-decision-log.md` §4.

---

## `audit-scan.sh`

### Usage

```
scripts/audit-scan.sh [<settings-file>]
```

Defaults to `~/.claude/settings.json` if no argument is given.

### What it checks

1. The settings file is **valid JSON**.
2. Every hook **registered** in `.hooks.<event>[].hooks[].command` exists on
   disk and is executable (a kit-bundled hook on a path ending in `-fixture` is
   exempt from the on-disk check; this is documented in the script header).
3. `enableAllProjectMcpServers: true` is paired with an explicit allowlist;
   otherwise flagged.
4. `permissions.allow[]` does not contain inline credentials (DB URLs of the
   form `postgresql://user:pass@…`, AWS access keys, Anthropic keys, etc.).
5. Registered hooks resolve to files on disk (no orphan registrations).

### Findings labels

- `inline-credential` — a `permissions.allow` entry contains a credential
  pattern (DB URL with userinfo, AWS access key, Anthropic key prefix, …).
  Severity: critical.
- `unrestricted-mcp` — `enableAllProjectMcpServers: true` without an
  `enabledMcpjsonServers` allowlist. Severity: critical.
- `missing-hook-file` — a hook is registered in `settings.json` but the
  corresponding file is absent (or non-executable) on disk. Severity: critical.

Exit 0 if no `[critical]` findings; exit 2 if any.

### Fixtures

The two reproducible inputs at
[`test-fixtures/settings.json.good-fixture`](test-fixtures/settings.json.good-fixture)
and
[`test-fixtures/settings.json.bad-fixture`](test-fixtures/settings.json.bad-fixture)
exercise the green and red paths respectively. The kit's own CI workflow
`bootstrap-fixture.yml` runs `audit-scan.sh` against both and asserts the
expected exit code + finding labels.

---

## Cross-platform

Bash 4+ on macOS and Linux. Windows users should run via WSL — PowerShell
variants of these scripts are out of v0.1 scope.

The `bootstrap-claude-config.sh` script tolerates Bash 3.x (it warns but does
not fail), but Bash 4+ is the supported configuration.

---

## License + source

MIT — © Unify Labs.
Source: [github.com/unifylabs-dev/unify-kit](https://github.com/unifylabs-dev/unify-kit).
