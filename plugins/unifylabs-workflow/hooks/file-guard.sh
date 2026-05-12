#!/usr/bin/env bash
#
# file-guard.sh — Block Edit/Write on credential-bearing paths at PreToolUse.
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/hooks/bash/file-guard.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "file-guard".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="file-guard"
readonly _MATCHER="Edit|Write"

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

_payload="$(cat)"

if ! command -v python3 >/dev/null 2>&1; then
  printf '[hook: %s] python3 not found in PATH; this hook requires python3 to parse the Edit/Write payload. Install python3 or set CLAUDE_HOOKS_DISABLE=%s to acknowledge the bypass; blocking conservatively.\n' "$_NAME" "$_NAME" >&2
  _hook_log block "$_MATCHER" "no-python3"
  exit 2
fi

_path_rc=0
_path="$(printf '%s' "$_payload" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("file_path", ""))
except Exception as e:
    print("PARSE_ERROR")
    print(str(e), file=sys.stderr)
' 2>/tmp/file-guard.parse.err)" || _path_rc=$?

if [[ "${_path_rc:-0}" -ne 0 ]] || [[ "$_path" == "PARSE_ERROR" ]]; then
  printf '[hook: %s] payload parse failed: %s; blocking conservatively.\n' "$_NAME" "$(cat /tmp/file-guard.parse.err 2>/dev/null || echo unknown)" >&2
  rm -f /tmp/file-guard.parse.err
  _hook_log block "$_MATCHER" "parse-error"
  exit 2
fi
rm -f /tmp/file-guard.parse.err

if [[ -z "$_path" ]]; then
  _hook_log allow "$_MATCHER" "no-file-path"
  exit 0
fi

# Compare against the basename and the full path (case-insensitive shell glob).
_base="$(basename -- "$_path")"
_lower_base="$(printf '%s' "$_base" | tr '[:upper:]' '[:lower:]')"
_lower_path="$(printf '%s' "$_path" | tr '[:upper:]' '[:lower:]')"

_is_guarded() {
  local base="$1" path="$2"

  # .env, .env.<anything>
  case "$base" in
    .env|.env.*|*.env) return 0 ;;
  esac

  # Private key / cert files
  case "$base" in
    *.pem|*.key|*.p12|*.pfx) return 0 ;;
  esac

  # SSH key files
  case "$base" in
    id_rsa|id_rsa.*|id_dsa|id_dsa.*|id_ecdsa|id_ecdsa.*|id_ed25519|id_ed25519.*) return 0 ;;
  esac

  # Anything that looks like *credentials.json
  case "$base" in
    *credentials.json) return 0 ;;
  esac

  # Path-rooted patterns. `*` in case glob already spans `/`.
  case "$path" in
    *.aws/credentials) return 0 ;;
    *.gnupg/*) return 0 ;;
    *.ssh/known_hosts) return 0 ;;
    *.ssh/id_*) return 0 ;;
  esac

  return 1
}

if _is_guarded "$_lower_base" "$_lower_path"; then
  printf '[hook: %s] blocked: %s is on the credential-files guard list. Set CLAUDE_HOOKS_DISABLE=%s if intentional.\n' "$_NAME" "$_path" "$_NAME" >&2
  _hook_log block "$_MATCHER" "guarded-path"
  exit 2
fi

_hook_log allow "$_MATCHER" "ok"
exit 0
