#!/usr/bin/env bash
#
# audit-scan.sh — Audit a Claude Code settings.json for security/quality issues.
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/scripts/audit-scan.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: not honored here (this script is not a Claude Code hook).
# CLAUDE_HOOKS_LOG: not honored here.
#
# Fixture-mode behavior: when the input path's basename ends in `-fixture`, the
# script treats the canonical kit-hook entries (matching one of the six bundled
# hook filenames at ~/.claude/hooks/<name>.sh) as deemed-installed. Other hook
# paths still get the existence check. This keeps the kit's own CI fixture flow
# working without requiring a real ~/.claude/ hook install on the runner.

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="audit-scan"
readonly _KIT_HOOKS=(
  dangerous-actions-blocker.sh
  pre-commit-secrets.sh
  output-secrets-scanner.sh
  file-guard.sh
  claudemd-scanner.sh
  mcp-config-integrity.sh
)

_usage() {
  cat <<'EOF'
Usage: audit-scan.sh [PATH]

Audit a Claude Code settings.json for security/quality issues.
Default PATH: ~/.claude/settings.json

Findings are emitted one per line as `[<severity>] <label>: <description>`
where severity is one of `critical`, `warning`, `info`.

Exit codes:
  0  no critical findings
  2  one or more critical findings
EOF
}

case "${1:-}" in
  -h|--help) _usage; exit 0 ;;
esac

_INPUT_PATH="${1:-$HOME/.claude/settings.json}"

# ---- Pre-flight ----

if ! command -v python3 >/dev/null 2>&1; then
  printf '[critical] no-python3: python3 not found in PATH; cannot parse JSON.\n'
  exit 2
fi

if [[ ! -r "$_INPUT_PATH" ]]; then
  printf '[critical] not-readable: %s does not exist or is not readable.\n' "$_INPUT_PATH"
  exit 2
fi

if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$_INPUT_PATH" 2>/dev/null; then
  printf '[critical] invalid-json: %s is not valid JSON.\n' "$_INPUT_PATH"
  exit 2
fi

_critical=0

_emit() {
  local severity="$1" label="$2" desc="$3"
  printf '[%s] %s: %s\n' "$severity" "$label" "$desc"
  if [[ "$severity" == "critical" ]]; then
    _critical=$((_critical + 1))
  fi
}

_is_fixture_run() {
  case "$(basename -- "$_INPUT_PATH")" in
    *-fixture) return 0 ;;
  esac
  return 1
}

_is_kit_hook() {
  local base="$1"
  local h
  for h in "${_KIT_HOOKS[@]}"; do
    [[ "$base" == "$h" ]] && return 0
  done
  return 1
}

_expand_tilde() {
  local input="$1"
  local tilde tildeslash
  tilde=$'\x7e'
  tildeslash="${tilde}/"
  if [[ "$input" == "$tilde" ]]; then
    printf '%s' "${HOME}"
  elif [[ "${input:0:2}" == "$tildeslash" ]]; then
    printf '%s' "${HOME}/${input:2}"
  else
    printf '%s' "$input"
  fi
}

# ============================================================================
# Kit-specific checks (per specs/05-scripts.md §"What it checks")
# ----------------------------------------------------------------------------
# The block below contains checks specific to unify-kit's threat model. It is
# structurally separate so future maintenance stays modular.
# ============================================================================

_kit_check_inline_credentials() {
  local entries
  entries="$(python3 -c '
import json, sys
d = json.load(open(sys.argv[1]))
for e in d.get("permissions", {}).get("allow", []):
    print(e)
' "$_INPUT_PATH" 2>/dev/null || true)"

  local pat_aws='AKI''A[0-9A-Z]{16}'
  local pat_anth='sk-''ant-api[0-9]+-[A-Za-z0-9_-]+'
  local pat_userpass='://[^:[:space:]@]+:[^@[:space:]]+@'
  local e snippet

  while IFS= read -r e; do
    [[ -z "$e" ]] && continue
    snippet="$(printf '%s' "$e" | head -c 80)"
    case "$e" in
      *"postgresql://"*)
        _emit critical inline-credential "permissions.allow contains a postgresql:// connection string: ${snippet}..."
        ;;
      *"mongodb://"*)
        _emit critical inline-credential "permissions.allow contains a mongodb:// connection string: ${snippet}..."
        ;;
      *"mysql://"*)
        _emit critical inline-credential "permissions.allow contains a mysql:// connection string: ${snippet}..."
        ;;
    esac
    if [[ "$e" =~ $pat_aws ]]; then
      _emit critical inline-credential "permissions.allow contains an AWS access key shape: ${snippet}..."
    fi
    if [[ "$e" =~ $pat_anth ]]; then
      _emit critical inline-credential "permissions.allow contains an Anthropic key shape: ${snippet}..."
    fi
    if [[ "$e" =~ $pat_userpass ]]; then
      _emit critical inline-credential "permissions.allow contains a userinfo://user:password@host pattern: ${snippet}..."
    fi
  done <<< "$entries"
}

_kit_check_unrestricted_mcp() {
  local result
  result="$(python3 -c '
import json, sys
d = json.load(open(sys.argv[1]))
all_on = d.get("enableAllProjectMcpServers", False)
allowlist = d.get("enabledMcpjsonServers", []) or []
if all_on and not allowlist:
    print("UNRESTRICTED")
' "$_INPUT_PATH" 2>/dev/null || true)"
  if [[ "$result" == "UNRESTRICTED" ]]; then
    _emit warning unrestricted-mcp "enableAllProjectMcpServers: true with no enabledMcpjsonServers allowlist."
  fi
}

_kit_check_missing_hook_files() {
  local fixture=0
  if _is_fixture_run; then fixture=1; fi

  local cmds
  cmds="$(python3 -c '
import json, sys
d = json.load(open(sys.argv[1]))
hooks = d.get("hooks", {}) or {}
for evt, entries in hooks.items():
    for ent in entries or []:
        for h in ent.get("hooks", []) or []:
            cmd = h.get("command", "")
            if cmd:
                print(cmd)
' "$_INPUT_PATH" 2>/dev/null || true)"

  local cmd expanded base
  while IFS= read -r cmd; do
    [[ -z "$cmd" ]] && continue
    expanded="$(_expand_tilde "$cmd")"
    base="$(basename -- "$expanded")"

    if [[ "$fixture" == "1" ]] && _is_kit_hook "$base"; then
      # Fixture mode: kit hooks aren't installed on the test runner.
      continue
    fi

    if [[ ! -e "$expanded" ]]; then
      _emit critical missing-hook-file "registered hook file does not exist: $cmd"
    elif [[ ! -x "$expanded" ]]; then
      _emit critical missing-hook-file "registered hook file is not executable: $cmd"
    fi
  done <<< "$cmds"
}

# ---- Main ----

_kit_check_inline_credentials
_kit_check_unrestricted_mcp
_kit_check_missing_hook_files

if [[ "$_critical" -gt 0 ]]; then
  exit 2
fi
exit 0
