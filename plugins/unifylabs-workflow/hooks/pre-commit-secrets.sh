#!/usr/bin/env bash
#
# pre-commit-secrets.sh — Scan staged diff for secrets before git commit (PreToolUse).
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/hooks/bash/pre-commit-secrets.sh
#   (upstream is CC BY-SA 4.0 — patterns documented; expression authored independently for this kit)
# Authored: 2026-05-04
# License: MIT (per unify-kit LICENSE)
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "pre-commit-secrets".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="pre-commit-secrets"
readonly _MATCHER="Bash(git commit:*)"

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

# Drain stdin (we don't need to inspect the JSON — the matcher already filtered).
cat >/dev/null

if ! command -v git >/dev/null 2>&1; then
  printf '[hook: %s] git not found in PATH; cannot scan staged diff for secrets. The Bash(git commit:*) matcher fired so something git-like exists — set CLAUDE_HOOKS_DISABLE=%s if you trust this commit-path; blocking conservatively.\n' "$_NAME" "$_NAME" >&2
  _hook_log block "$_MATCHER" "no-git"
  exit 2
fi

# Cap the diff so multi-megabyte commits don't stall the hook.
_diff="$(git diff --cached --diff-filter=ACMR -U0 2>/tmp/pre-commit-secrets.git.err | head -n 10000)"
_rc=${PIPESTATUS[0]}
if (( _rc != 0 )) && (( _rc != 141 )); then
  printf '[hook: %s] git diff failed (rc=%d): %s; blocking conservatively.\n' "$_NAME" "$_rc" "$(cat /tmp/pre-commit-secrets.git.err 2>/dev/null || echo unknown)" >&2
  rm -f /tmp/pre-commit-secrets.git.err
  _hook_log block "$_MATCHER" "git-diff-failed"
  exit 2
fi
rm -f /tmp/pre-commit-secrets.git.err

if [[ -z "$_diff" ]]; then
  _hook_log allow "$_MATCHER" "empty-staged-diff"
  exit 0
fi

# Patterns are stored split-prefix to keep this script clean against the kit's
# own forbidden-strings scrub (the literal pattern bytes shouldn't appear here).
readonly _RE_AWS='AKI''A[0-9A-Z]{16}'
readonly _RE_ANTHROPIC='sk-''ant-api[0-9]+-[A-Za-z0-9_-]+'
readonly _RE_GCP='"type":[[:space:]]*"service_account"'
readonly _RE_STRIPE='sk_li''ve_[A-Za-z0-9]{20,}'
readonly _RE_PRIVKEY='-----BEGIN[[:space:]][A-Z\ ]*PRIVATE[[:space:]]KEY-----'
readonly _RE_SLACK='xox''[baprs]-[A-Za-z0-9-]{10,}'

_check_diff() {
  local diff="$1"
  local file_hint=""
  local matched=0
  local line label

  while IFS= read -r line; do
    if [[ "$line" =~ ^\+\+\+\ b/ ]]; then
      file_hint="${line#+++ b/}"
      continue
    fi
    [[ "$line" =~ ^\+ ]] || continue

    label=""
    if   [[ "$line" =~ $_RE_AWS ]];        then label="aws-access-key"
    elif [[ "$line" =~ $_RE_ANTHROPIC ]];  then label="anthropic-key"
    elif [[ "$line" =~ $_RE_GCP ]];        then label="gcp-service-account"
    elif [[ "$line" =~ $_RE_STRIPE ]];     then label="stripe-key"
    elif [[ "$line" =~ $_RE_PRIVKEY ]];    then label="private-key"
    elif [[ "$line" =~ $_RE_SLACK ]];      then label="slack-token"
    fi

    if [[ -n "$label" ]]; then
      printf '[hook: %s] secret-pattern %s in %s\n' "$_NAME" "$label" "${file_hint:-?}" >&2
      matched=1
    fi
  done <<< "$diff"

  return $matched
}

if ! _check_diff "$_diff"; then
  _hook_log block "$_MATCHER" "secret-pattern"
  exit 2
fi

_hook_log allow "$_MATCHER" "ok"
exit 0
