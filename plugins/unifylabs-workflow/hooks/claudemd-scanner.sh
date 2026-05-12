#!/usr/bin/env bash
#
# claudemd-scanner.sh — Scan workspace CLAUDE.md files for prompt-injection patterns at SessionStart.
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/hooks/bash/claudemd-scanner.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "claudemd-scanner".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.
#
# This hook is an observability layer: most matches print a warning to stderr and exit 0
# so the session can still start. The single exception is unicode bidi-override marks,
# which exit 2 because a hidden bidi reorder in CLAUDE.md is unambiguously hostile.

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="claudemd-scanner"
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

# Drain stdin (SessionStart payload not needed for this scan).
cat >/dev/null

# Find candidates. Skip vendored / VCS noise.
_files=()
while IFS= read -r f; do
  [[ -n "$f" ]] && _files+=("$f")
done < <(find . -type f -name 'CLAUDE.md' \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' 2>/dev/null || true)

if [[ "${#_files[@]}" -eq 0 ]]; then
  _hook_log allow "$_MATCHER" "no-claude-md"
  exit 0
fi

_warn=0
_bidi=0

# U+202E RIGHT-TO-LEFT OVERRIDE and friends. Hard-block.
readonly _BIDI_RE=$'[\xe2\x80\xaa\xe2\x80\xab\xe2\x80\xac\xe2\x80\xad\xe2\x80\xae\xe2\x81\xa6\xe2\x81\xa7\xe2\x81\xa8\xe2\x81\xa9]'

for _f in "${_files[@]}"; do
  # Each pattern grep is independent; failures don't propagate (set -e is OK because grep is in if).
  if grep -q -- 'IGNORE PREVIOUS INSTRUCTIONS' "$_f" 2>/dev/null; then
    printf '[hook: %s] warning: %s contains "IGNORE PREVIOUS INSTRUCTIONS"\n' "$_NAME" "$_f" >&2
    _warn=1
  fi
  if grep -qi -- 'system prompt:' "$_f" 2>/dev/null; then
    printf '[hook: %s] warning: %s contains "system prompt:"\n' "$_NAME" "$_f" >&2
    _warn=1
  fi
  if grep -q -- '<admin>' "$_f" 2>/dev/null; then
    printf '[hook: %s] warning: %s contains "<admin>" tag\n' "$_NAME" "$_f" >&2
    _warn=1
  fi
  if grep -qP -- '\\n\\nHuman:' "$_f" 2>/dev/null; then
    printf '[hook: %s] warning: %s contains escaped Human: turn marker\n' "$_NAME" "$_f" >&2
    _warn=1
  fi
  # Suspicious base64 blob: a single line of 200+ base64 characters.
  if grep -qE '^[A-Za-z0-9+/]{200,}={0,2}$' "$_f" 2>/dev/null; then
    printf '[hook: %s] warning: %s contains a long base64-shaped blob (>=200 chars)\n' "$_NAME" "$_f" >&2
    _warn=1
  fi
  if LC_ALL=C grep -qE -- "$_BIDI_RE" "$_f" 2>/dev/null; then
    printf '[hook: %s] BLOCKING: %s contains a unicode bidi-override character\n' "$_NAME" "$_f" >&2
    _bidi=1
  fi
done

if [[ "$_bidi" -eq 1 ]]; then
  _hook_log block "$_MATCHER" "unicode-bidi"
  exit 2
fi

if [[ "$_warn" -eq 1 ]]; then
  _hook_log warn "$_MATCHER" "injection-pattern"
  exit 0
fi

_hook_log allow "$_MATCHER" "ok"
exit 0
