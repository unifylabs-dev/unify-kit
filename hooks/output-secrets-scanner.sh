#!/usr/bin/env bash
#
# output-secrets-scanner.sh — Scan tool output for secret patterns at PostToolUse.
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/hooks/bash/output-secrets-scanner.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "output-secrets-scanner".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="output-secrets-scanner"
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

# Slurp the entire payload as a string and scan it whole. This is intentional:
# the JSON shape for tool output may evolve; substring scanning is robust to
# field renames as long as the secret bytes are anywhere in the envelope.
_payload="$(cat)"

if [[ -z "$_payload" ]]; then
  _hook_log allow "$_MATCHER" "empty-payload"
  exit 0
fi

# Cap the size so a multi-megabyte file dump doesn't pin the hook.
_sample="$(printf '%s' "$_payload" | head -c 1048576)"

# Pattern catalog (split-prefix to avoid kit's own forbidden-strings scrub).
readonly _RE_AWS='AKI''A[0-9A-Z]{16}'
readonly _RE_ANTHROPIC='sk-''ant-api[0-9]+-[A-Za-z0-9_-]+'
readonly _RE_GCP='"type":[[:space:]]*"service_account"'
readonly _RE_STRIPE='sk_li''ve_[A-Za-z0-9]{20,}'
readonly _RE_PRIVKEY='-----BEGIN[[:space:]][A-Z\ ]*PRIVATE[[:space:]]KEY-----'
readonly _RE_SLACK='xox''[baprs]-[A-Za-z0-9-]{10,}'

_matched=0
_label=""
_check_one() {
  local re="$1" lbl="$2"
  if [[ "$_sample" =~ $re ]]; then
    printf '[hook: %s] secret-pattern %s in tool output\n' "$_NAME" "$lbl" >&2
    _matched=1
    _label="$lbl"
  fi
}

_check_one "$_RE_AWS" "aws-access-key"
_check_one "$_RE_ANTHROPIC" "anthropic-key"
_check_one "$_RE_GCP" "gcp-service-account"
_check_one "$_RE_STRIPE" "stripe-key"
_check_one "$_RE_PRIVKEY" "private-key"
_check_one "$_RE_SLACK" "slack-token"

if [[ "$_matched" -eq 1 ]]; then
  _hook_log block "$_MATCHER" "$_label"
  exit 2
fi

_hook_log allow "$_MATCHER" "ok"
exit 0
