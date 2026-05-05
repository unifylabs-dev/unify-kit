#!/usr/bin/env bash
#
# mcp-config-integrity.sh — Detect changes to .mcp.json at SessionStart (CVE-2025-54135 / 54136).
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/hooks/bash/mcp-config-integrity.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "mcp-config-integrity".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="mcp-config-integrity"
readonly _MATCHER="*"

case ",${CLAUDE_HOOKS_DISABLE:-}," in
  *",${_NAME},"*)
    printf '[hook: %s disabled via env]\n' "$_NAME" >&2
    exit 0
    ;;
esac

_hook_log() {
  [[ -z "${CLAUDE_HOOKS_LOG:-}" ]] && return 0
  python3 - "$_NAME" "$1" "$_MATCHER" "$2" "$CLAUDE_HOOKS_LOG" <<'PY' 2>/dev/null || true
import json, sys, time
ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
rec = {"ts": ts, "hook": sys.argv[1], "decision": sys.argv[2],
       "matcher": sys.argv[3], "brief": sys.argv[4]}
with open(sys.argv[5], "a") as f:
    f.write(json.dumps(rec) + "\n")
PY
}

# Drain stdin (SessionStart payload not needed for this check).
cat >/dev/null

# Walk pwd → / looking for the closest .mcp.json (project-scoped MCP config).
_find_mcp_json() {
  local dir="$PWD"
  while [[ "$dir" != "/" && -n "$dir" ]]; do
    if [[ -f "$dir/.mcp.json" ]]; then
      printf '%s\n' "$dir/.mcp.json"
      return 0
    fi
    dir="$(dirname -- "$dir")"
  done
  if [[ -f "/.mcp.json" ]]; then
    printf '%s\n' "/.mcp.json"
    return 0
  fi
  return 1
}

_mcp_path="$(_find_mcp_json || true)"

if [[ -z "$_mcp_path" ]]; then
  _hook_log allow "$_MATCHER" "no-mcp-json"
  exit 0
fi

# Hash function selection. shasum is on macOS by default; sha256sum on Linux.
_sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    return 1
  fi
}

_sha256_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  else
    return 1
  fi
}

_current="$(_sha256_file "$_mcp_path" 2>/dev/null || true)"
if [[ -z "$_current" ]]; then
  printf '[hook: %s] no sha256 utility found — cannot verify integrity.\n' "$_NAME" >&2
  _hook_log allow "$_MATCHER" "no-sha256"
  exit 0
fi

# Path key: hash of the project root so multiple projects can each have a baseline.
_pwd_hash="$(printf '%s' "$PWD" | _sha256_stdin 2>/dev/null || true)"
if [[ -z "$_pwd_hash" ]]; then
  printf '[hook: %s] could not compute pwd hash — skipping baseline check.\n' "$_NAME" >&2
  _hook_log allow "$_MATCHER" "no-pwd-hash"
  exit 0
fi

_baseline_dir="${HOME}/.claude/.mcp-hashes"
_baseline_file="${_baseline_dir}/${_pwd_hash}.sha256"

mkdir -p "$_baseline_dir" 2>/dev/null || true

if [[ ! -f "$_baseline_file" ]]; then
  # First-run record. Silent allow.
  printf '%s\n' "$_current" > "$_baseline_file" 2>/dev/null || true
  _hook_log allow "$_MATCHER" "baseline-recorded"
  exit 0
fi

_known="$(awk 'NR==1{print $1}' "$_baseline_file" 2>/dev/null || true)"

if [[ "$_known" == "$_current" ]]; then
  _hook_log allow "$_MATCHER" "ok"
  exit 0
fi

cat >&2 <<EOF
[hook: $_NAME] MCP config integrity changed.
  path: $_mcp_path
  expected: $_known
  current:  $_current
  CVE-2025-54135 / 54136 mitigation. Verify the change is expected and run
  \`claude --update-mcp-hash\` (or update $_baseline_file by hand) to acknowledge.
EOF

_hook_log block "$_MATCHER" "integrity-changed"
exit 2
