#!/usr/bin/env bash
#
# dangerous-actions-blocker.sh — Block destructive Bash commands at PreToolUse.
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/hooks/bash/dangerous-actions-blocker.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "dangerous-actions-blocker".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="dangerous-actions-blocker"
readonly _MATCHER="Bash"

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

# Read the hook payload from stdin (Claude Code passes a JSON envelope).
_payload="$(cat)"

if ! command -v python3 >/dev/null 2>&1; then
  printf '[hook: %s] python3 not found; cannot parse payload safely — allowing.\n' "$_NAME" >&2
  _hook_log allow "$_MATCHER" "no-python3"
  exit 0
fi

_cmd="$(printf '%s' "$_payload" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("command", ""))
except Exception:
    pass
' 2>/dev/null || true)"

if [[ -z "$_cmd" ]]; then
  _hook_log allow "$_MATCHER" "no-command"
  exit 0
fi

# Allow-by-default; block on any pattern match. Patterns target unambiguously
# destructive shapes; ambiguous expressions are deliberately not flagged.
_is_dangerous() {
  local cmd="$1"
  # rm -rf rooted at /, /*, or ~ (rf or fr ordering)
  if [[ "$cmd" =~ rm[[:space:]]+-[[:alpha:]]*r[[:alpha:]]*f[[:alpha:]]*[[:space:]]+(/|/\*|~)([[:space:]]|$|/) ]]; then return 0; fi
  if [[ "$cmd" =~ rm[[:space:]]+-[[:alpha:]]*f[[:alpha:]]*r[[:alpha:]]*[[:space:]]+(/|/\*|~)([[:space:]]|$|/) ]]; then return 0; fi
  # rm with --no-preserve-root, rooted target
  if [[ "$cmd" =~ rm[[:space:]]+.*--no-preserve-root.*[[:space:]](/|~)([[:space:]]|$|/) ]]; then return 0; fi
  # SQL DROP DATABASE/TABLE/SCHEMA (case-insensitive)
  if [[ "$cmd" =~ [Dd][Rr][Oo][Pp][[:space:]]+([Dd][Aa][Tt][Aa][Bb][Aa][Ss][Ee]|[Tt][Aa][Bb][Ll][Ee]|[Ss][Cc][Hh][Ee][Mm][Aa])[[:space:]] ]]; then return 0; fi
  # chmod 777 on root or home
  if [[ "$cmd" =~ chmod[[:space:]]+(-[[:alpha:]]*[Rr][[:alpha:]]*[[:space:]]+)?777[[:space:]]+(/|~) ]]; then return 0; fi
  # dd of=/dev/<block-device>
  if [[ "$cmd" =~ dd[[:space:]]+.*if=/dev/(zero|random|urandom).*of=/dev/(sd|disk|nvme|hd|mmc) ]]; then return 0; fi
  # find / ... -delete (rooted recursive delete)
  if [[ "$cmd" =~ find[[:space:]]+/[[:space:]].*-delete ]]; then return 0; fi
  # mkfs on a block device
  if [[ "$cmd" =~ mkfs\.[a-z0-9]+[[:space:]]+/dev/ ]]; then return 0; fi
  return 1
}

if _is_dangerous "$_cmd"; then
  printf '[hook: %s] blocked: candidate command matches a destructive pattern. Set CLAUDE_HOOKS_DISABLE=%s if intentional.\n' "$_NAME" "$_NAME" >&2
  _hook_log block "$_MATCHER" "destructive-pattern"
  exit 2
fi

_hook_log allow "$_MATCHER" "ok"
exit 0
