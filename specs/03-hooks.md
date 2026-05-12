# Spec 03 — Hooks

> Status: Implemented in v0.2.x
> Depends on: 00 (sourcing modes, glossary), 01 (filename canon), 05 (bootstrap script + settings-merge algorithm), Claude Code hook schema (verified at implementation time — see [docs](https://docs.claude.com/en/docs/claude-code/hooks))
> Related: 02 (security-checklist references hook bundle), 09 (kit's own CI shellchecks `hooks/*.sh`)

## Purpose

Specify the security hook bundle for v1, the install paths, the `settings.json`
registration block, and the per-hook acceptance test recipe.

## Hook bundle (v1) — sourcing mode: `customization`

Six hooks. The kit authors original shell expression that implements the documented
patterns; `github.com/FlorianBruniaux/claude-code-ultimate-guide/examples/hooks/bash/`
is cited as conceptual prior art via per-file header comments. Each hook's header
cites the upstream pattern reference URL plus its own license note: *"based on
patterns from <upstream> (CC BY-SA 4.0 — patterns documented; expression authored
independently)."* No bytes from the upstream are copied. See
[`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md)
for why this changed from `verbatim`.

| File | Pattern reference | Trigger | Action |
|---|---|---|---|
| `dangerous-actions-blocker.sh` | `examples/hooks/bash/dangerous-actions-blocker.sh` | PreToolUse on `Bash` | Block destructive commands (`rm -rf /`, DB drops, `chmod 777 /`, etc.) |
| `pre-commit-secrets.sh` | `examples/hooks/bash/pre-commit-secrets.sh` | PreToolUse on `Bash(git commit:*)` | Scan staged diff for secret patterns; block commit if any match |
| `output-secrets-scanner.sh` | `examples/hooks/bash/output-secrets-scanner.sh` | PostToolUse on every tool | Scan tool output for API keys / tokens / credentials before display |
| `file-guard.sh` | `examples/hooks/bash/file-guard.sh` | PreToolUse on `Edit`/`Write` | Block modification of `.env`, `*.pem`, `id_rsa*`, `credentials.json`, `.aws/credentials` |
| `claudemd-scanner.sh` | `examples/hooks/bash/claudemd-scanner.sh` | SessionStart | Scan all `CLAUDE.md` files in the workspace for prompt-injection patterns |
| `mcp-config-integrity.sh` | `examples/hooks/bash/mcp-config-integrity.sh` | SessionStart | Compute SHA-256 of `.mcp.json`, compare to last-known-good in `~/.claude/.mcp-hashes/`. CVE-2025-54135 / 54136 mitigation. |

### Per-hook acceptance test (manual-recipe form)

No new tooling. Each hook has a concrete manual-test recipe in `hooks/README.md`.
The recipe is a sequence of bash commands a consumer (or the kit's own CI) runs;
expected behavior is asserted via exit code + grep on stderr.

**Example recipe shape (one per hook in `hooks/README.md`):**

```bash
# dangerous-actions-blocker.sh
# Setup: hook installed and registered.
# Test: trigger a known-bad rm.
output=$(echo "rm -rf /tmp/blocker-test" | claude --print --no-tools 2>&1 || true)
echo "$output" | grep -q "blocked" && echo "PASS" || echo "FAIL"

# pre-commit-secrets.sh
# Setup: in a sandbox repo, stage a file containing AKIAIOSFODNN7EXAMPLE.
# Test: attempt git commit; expect block.
git add fixture-with-fake-key
output=$(git commit -m "test" 2>&1 || true)
echo "$output" | grep -q "secret" && echo "PASS" || echo "FAIL"

# file-guard.sh
# Setup: hook installed.
# Test: ask Claude to edit .env; expect block.
echo "test" > /tmp/sandbox/.env
# (manual: invoke Edit on .env via Claude; expect refusal)

# (and so on for each hook)
```

The kit's own CI (`.github/workflows/bootstrap-fixture.yml`, spec 09) runs these
recipes against fixture inputs in a sandbox `~/.claude/` to prove the hooks fire.

There is no `claude-test-hook` helper script. We rejected that abstraction — the
recipes above are concrete bash commands. Less tooling, fewer failure modes.

### Stretch / opt-in hooks

(Removed from v1 spec. If a future v1.1+ hook bundle expands, candidates land in
`docs/decisions/` as ADR proposals. The previously-listed candidates —
`prompt-injection-detector.sh`, `repo-integrity-scanner.sh`,
`unicode-injection-scanner.sh`, `auto-format.sh`, `session-summary.sh` — are noted
in the kit's `BACKLOG.md` (per spec 08), not here.)

---

## Install paths

- **Hook scripts:** `~/.claude/hooks/<filename>.sh`
- **Settings registration:** `~/.claude/settings.json` under the `hooks` key

The `hooks/settings-snippet.json` file in the kit provides the JSON block to merge
into `~/.claude/settings.json`. The bootstrap script (spec 05) does a non-destructive
merge per the algorithm pinned in spec 05.

**Snippet shape (verified at implementation time against current Claude Code hook
schema — see Depends on):**

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

Tilde paths stay literal in JSON; Claude Code expands at runtime. The bootstrap
script does not pre-expand them.

## Disable mechanism

`CLAUDE_HOOKS_DISABLE=<name>` env var, comma-separated for multiple:

```bash
CLAUDE_HOOKS_DISABLE=file-guard claude   # disables file-guard for one session
CLAUDE_HOOKS_DISABLE=file-guard,output-secrets-scanner claude
```

Each hook script checks for its name in `$CLAUDE_HOOKS_DISABLE` at start; if matched,
prints `[hook: <name> disabled via env]` to stderr and exits 0 immediately. Visible
in shell history, scoped to one command, no `settings.json` mutation, never silent.

## Logging

Stderr only by default. Each hook prints its block/allow decision to stderr — never
silent.

Opt-in persistent log via `CLAUDE_HOOKS_LOG=~/.claude/hooks.log` env var. When set,
each hook appends a one-line JSON record `{ts, hook, decision, matcher, brief}` to
the named file. No rotation logic in v1 — the user owns the file.

## Cross-platform

**v1: Bash only.** macOS and Linux. Windows users use WSL.

PowerShell variants are out of v1 scope. Adding them post-v1 requires an ADR (the
attack surface is non-trivial and we don't ship Windows fixtures in v1 CI).

---

## Decisions needed

All hook-level decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | Bundle scope | Six hooks above. Period. |
| 2 | Cross-platform | Bash + macOS/Linux only for v1. |
| 3 | Lift mode | `verbatim` with header attribution. Style rewrites require an ADR. (Decision dropped — was theater per review.) |
| 4 | Disable mechanism | `CLAUDE_HOOKS_DISABLE=<name>` env var. |
| 5 | Logging | Stderr only by default; `CLAUDE_HOOKS_LOG=<path>` env var for opt-in persistence. |

## Out of scope

- Anti-malware scanning of installed plugins (defer to v1.1+ as separate effort).
- Pre-commit hooks at the *git* level (consumer's choice via husky etc.). Our
  `pre-commit-secrets.sh` runs at the *Claude Code* hook level.
- Rewriting Ultimate Guide hooks beyond what's needed for our `settings.json`
  registration.
- PowerShell variants for Windows.

## Acceptance criteria

- All six v1 hooks present in `hooks/` with executable bit set, header comment
  citing Ultimate Guide source path + license.
- `hooks/settings-snippet.json` is valid JSON and merges cleanly into a fresh or
  existing `~/.claude/settings.json` per spec 05's merge algorithm.
- `hooks/README.md` documents every hook, its source, its limitations, the
  `CLAUDE_HOOKS_DISABLE` syntax, the `CLAUDE_HOOKS_LOG` syntax, and one manual-test
  recipe per hook.
- After running `scripts/bootstrap-claude-config.sh`:
  - All six hooks live in `~/.claude/hooks/` with `chmod +x`.
  - `~/.claude/settings.json` contains the hook registrations.
  - A backup of the prior `settings.json` lives at
    `~/.claude/settings.json.bak.<timestamp>`.
- The kit's own CI runs each manual-test recipe against fixture inputs and asserts
  expected exit codes + stderr matches (per spec 09's `bootstrap-fixture.yml`).
- Each hook is shellcheck-clean (gated by spec 09's lint workflow).

## Revisions

Addressed: R-013 (sourcing mode `verbatim` declared), R-014 (decision #3 dropped;
disable + logging recommendations promoted to canon), R-015 (Stretch hooks
subsection removed; deferred candidates moved to BACKLOG.md per spec 08), R-016
(`claude-test-hook` removed; replaced with concrete manual-test recipes per hook),
R-017 (settings-merge algorithm pinned in spec 05; cross-link added to Depends on),
R-018 (Depends on header explicitly cites Claude Code hook schema verification).

**v0.3 revision (2026-05-04):** hook bundle reclassified from `verbatim` to
`customization` after Phase 2 of the v0.1 implementation run discovered the upstream
is licensed CC BY-SA 4.0 (not CC0 1.0 as originally assumed). Share-alike is
incompatible with the kit's MIT-for-code policy, so the hooks are now authored from
the documented patterns rather than lifted verbatim. Per-hook header comments cite
the upstream as pattern reference, not source. Decision #3 ("Lift mode: `verbatim`
with header attribution") is re-opened and resolved as `customization`. See
[`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md).
Upstream path corrected from `examples/hooks/<name>.sh` to
`examples/hooks/bash/<name>.sh` (factual fix from the same Phase 2 discovery).
