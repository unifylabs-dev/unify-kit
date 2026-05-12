#!/usr/bin/env bash
#
# audit-scan.sh — Audit a Claude Code settings.json for security/quality issues.
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/scripts/audit-scan.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04; refactored 2026-05-12 for v2 (plugin-aware; dropped repo-hook checks).
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: not honored here (this script is not a Claude Code hook).
# CLAUDE_HOOKS_LOG: not honored here.
#
# v2 changes (cutover from kit-hook tracking to plugin-managed hooks):
#   - Dropped: `_kit_check_missing_hook_files` (the v1 check that asserted each
#     PreToolUse entry in settings.json pointed to an existing `~/.claude/hooks/*.sh`).
#     In v2, hooks ship via the `unifylabs-workflow` plugin and resolve through
#     `${CLAUDE_PLUGIN_ROOT}`; Claude Code's plugin loader owns hook discovery.
#   - Added: `--check-plugin` flag invokes `_kit_check_plugin_installed`,
#     which probes Claude Code's plugin install state for `unifylabs-workflow`.
#   - Kept: inline-credential scan + unrestricted-MCP scan (both still apply).
#
# Plugin-detection strategy hierarchy (best effort; Claude Code's installed-
# plugin format is not yet stable across versions):
#   1. `~/.claude/plugins/installed.json` exists AND mentions `unifylabs-workflow`
#   2. `~/.claude/plugins/unifylabs-workflow/.claude-plugin/plugin.json` exists
#      and parses as valid JSON
#   3. Otherwise: emit [warning] plugin-not-detected (not critical — a fresh
#      contributor box without the plugin shouldn't fail CI)

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="audit-scan"
readonly _PLUGIN_NAME="unifylabs-workflow"

_usage() {
  cat <<'EOF'
Usage: audit-scan.sh [PATH] [--check-plugin]

Audit a Claude Code settings.json for security/quality issues.
Default PATH: ~/.claude/settings.json

Flags:
  --check-plugin   Also probe Claude Code plugin install state for
                   `unifylabs-workflow`. Emits a warning if not detected
                   (warning-severity; exit 0 unless a separate critical
                   finding fires).

Findings are emitted one per line as `[<severity>] <label>: <description>`
where severity is one of `critical`, `warning`, `info`.

Exit codes:
  0  no critical findings
  2  one or more critical findings
EOF
}

_INPUT_PATH=""
_CHECK_PLUGIN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)      _usage; exit 0 ;;
    --check-plugin) _CHECK_PLUGIN=true ;;
    --*)
      printf '[critical] unknown-flag: %s\n' "$1" >&2
      _usage >&2
      exit 2
      ;;
    *)
      if [[ -z "${_INPUT_PATH}" ]]; then
        _INPUT_PATH="$1"
      else
        printf '[critical] unexpected-argument: %s\n' "$1" >&2
        exit 2
      fi
      ;;
  esac
  shift
done

_INPUT_PATH="${_INPUT_PATH:-$HOME/.claude/settings.json}"

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

# ============================================================================
# Kit-specific checks (per specs/05-scripts.md §"What it checks")
# ----------------------------------------------------------------------------
# In v2, this scope shrank: hooks now ship in the unifylabs-workflow plugin
# and resolve via ${CLAUDE_PLUGIN_ROOT}, not via paths in settings.json.
# Claude Code's plugin loader owns hook discovery + execution.
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

# Probe Claude Code plugin state for `unifylabs-workflow`. See header for
# the 3-strategy hierarchy. Best-effort; non-detection is a warning, not
# critical (CI runners may not have the plugin installed).
_kit_check_plugin_installed() {
  local installed_json="${HOME}/.claude/plugins/installed.json"
  local plugin_dir="${HOME}/.claude/plugins/${_PLUGIN_NAME}"
  local plugin_json="${plugin_dir}/.claude-plugin/plugin.json"

  # Strategy 1: installed.json mentions the plugin.
  if [[ -f "${installed_json}" ]]; then
    if python3 -c "
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
# installed.json shape varies; check common locations.
flat = json.dumps(d)
sys.exit(0 if '${_PLUGIN_NAME}' in flat else 1)
" "${installed_json}" 2>/dev/null; then
      _emit info plugin-installed "${_PLUGIN_NAME} detected via installed.json"
      return 0
    fi
  fi

  # Strategy 2: plugin directory + valid plugin.json.
  if [[ -f "${plugin_json}" ]] && python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "${plugin_json}" 2>/dev/null; then
    _emit info plugin-installed "${_PLUGIN_NAME} detected at ${plugin_dir}"
    return 0
  fi

  _emit warning plugin-not-detected "could not detect ${_PLUGIN_NAME} plugin install; install via '/plugin install ${_PLUGIN_NAME}' from a Claude session"
  return 0
}

# ---- Main ----

_kit_check_inline_credentials
_kit_check_unrestricted_mcp

if [[ "${_CHECK_PLUGIN}" == "true" ]]; then
  _kit_check_plugin_installed
fi

if [[ "$_critical" -gt 0 ]]; then
  exit 2
fi
exit 0
