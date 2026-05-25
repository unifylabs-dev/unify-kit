#!/usr/bin/env bash
#
# context-awareness.sh — Threshold-driven context-pressure reminder hook.
# Fires on UserPromptSubmit (between turns) and SessionStart (resume prompts).
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Authored: 2026-05-24
# License: MIT (per unify-kit LICENSE)
#
# Behavior (per handoff design spec §7):
#   - UserPromptSubmit: compute effective context % from transcript_path's last
#     assistant record (.message.usage sum). Silent <40%. Tier-matched reminder
#     ≥40% per spec §7.2 table. Suppress within 5-turn window unless tier escalates.
#   - SessionStart: scan project MEMORY.md for pending handoff pointers. Emit
#     pending-handoff reminder for each non-consumed pointer; idempotently strip
#     pointers whose linked doc carries `status: consumed` in its frontmatter.
#
# The hook is awareness, not instruction. It never forces AskUserQuestion;
# Claude consults the discretion table in skills/handoff/SKILL.md §7.4.
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "context-awareness".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.
# MEMORY_MD_OVERRIDE: test-only — overrides the resolved MEMORY.md path (used by test harness).

set -euo pipefail
IFS=$'\n\t'

readonly _NAME="context-awareness"
readonly _MATCHER="*"

case ",${CLAUDE_HOOKS_DISABLE:-}," in
  *",${_NAME},"*)
    printf '[hook: %s disabled via env]\n' "$_NAME" >&2
    exit 0
    ;;
esac

# Fail-safe: a hook bug must never block a prompt submission or session start.
trap 'exit 0' ERR

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

# ---------- Parse hook input ----------
STDIN_RAW="$(cat || true)"
if [ -z "$STDIN_RAW" ]; then
  _hook_log allow "$_MATCHER" "empty-input"
  exit 0
fi

event=$(printf '%s' "$STDIN_RAW" | jq -r '.hook_event_name // "UserPromptSubmit"' 2>/dev/null || echo "UserPromptSubmit")
session_id=$(printf '%s' "$STDIN_RAW" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
transcript_path=$(printf '%s' "$STDIN_RAW" | jq -r '.transcript_path // ""' 2>/dev/null || echo "")
cwd=$(printf '%s' "$STDIN_RAW" | jq -r '.cwd // ""' 2>/dev/null || echo "")
input_model=$(printf '%s' "$STDIN_RAW" | jq -r '.model // ""' 2>/dev/null || echo "")

# ---------- Locate last assistant record (for tokens + model on UserPromptSubmit) ----------
last_assistant=""
if [ -n "$transcript_path" ] && [ -f "$transcript_path" ]; then
  # Reverse the file, find the first assistant record. Use awk for portability
  # (BSD `tac` is absent on macOS; tail -r exists but jq -c piping reversed lines is awkward).
  last_assistant=$(awk '
    /"type":"assistant"/ || /"role":"assistant"/ { lines[NR] = $0; idx[++n] = NR }
    END { if (n > 0) print lines[idx[n]] }
  ' "$transcript_path" 2>/dev/null || echo "")
fi

# ---------- Compute effective context % ----------
tokens=0
if [ -n "$last_assistant" ]; then
  tokens=$(printf '%s' "$last_assistant" | jq -r '
    (.message.usage // {}) as $u
    | (($u.input_tokens // 0) + ($u.output_tokens // 0)
       + ($u.cache_read_input_tokens // 0) + ($u.cache_creation_input_tokens // 0))
  ' 2>/dev/null || echo 0)
fi
# Guard against non-numeric tokens (e.g. "null" -> 0).
case "$tokens" in
  ''|*[!0-9]*) tokens=0 ;;
esac

# ---------- Resolve model + window ----------
model=""
if [ "$event" = "SessionStart" ] && [ -n "$input_model" ]; then
  model="$input_model"
elif [ -n "$last_assistant" ]; then
  model=$(printf '%s' "$last_assistant" | jq -r '.message.model // ""' 2>/dev/null || echo "")
fi
[ -z "$model" ] && model="claude-sonnet-4-6"

# Normalize: strip trailing [1m] / [200k] window-variant suffix.
model_norm=$(printf '%s' "$model" | sed 's/\[.*\]$//')

case "$model_norm" in
  claude-opus-4-7)         window=1000000 ;;
  claude-sonnet-4-6)       window=200000 ;;
  claude-haiku-4-5-*)      window=200000 ;;
  *)                       window=200000 ;;
esac

# Compute percentage; guard against window=0 just in case.
if [ "$window" -gt 0 ]; then
  pct=$(( tokens * 100 / window ))
else
  pct=0
fi

# ---------- Resolve tier ----------
if   [ "$pct" -lt 40 ]; then tier="silent"; tier_rank=0
elif [ "$pct" -lt 50 ]; then tier="40s";    tier_rank=1
elif [ "$pct" -lt 60 ]; then tier="50s";    tier_rank=2
elif [ "$pct" -lt 70 ]; then tier="60s";    tier_rank=3
else                          tier="70+";   tier_rank=4
fi

# ---------- Helpers ----------
_tier_rank() {
  case "$1" in
    silent) printf '0' ;;
    40s)    printf '1' ;;
    50s)    printf '2' ;;
    60s)    printf '3' ;;
    70+)    printf '4' ;;
    *)      printf '0' ;;
  esac
}

_detect_mode() {
  # Run detect-mode.sh inside cwd subshell. Resilient to crashes.
  local m
  m=$(cd "${cwd:-.}" 2>/dev/null && \
      bash "${CLAUDE_PLUGIN_ROOT:-}/skills/handoff/scripts/detect-mode.sh" 2>/dev/null \
      | jq -r '.mode // "generic"' 2>/dev/null) || m="generic"
  [ -z "$m" ] && m="generic"
  printf '%s' "$m"
}

_relative_time() {
  # Convert an ISO-8601 UTC timestamp to a coarse "Xm/h/d ago" string.
  # Best-effort; falls back to the raw ISO if date parse fails.
  local iso="$1" then_s now_s delta
  if then_s=$(date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$iso" '+%s' 2>/dev/null); then
    now_s=$(date -u '+%s')
    delta=$(( now_s - then_s ))
    if   [ "$delta" -lt 3600 ];   then printf '%dm ago' $(( delta / 60 ))
    elif [ "$delta" -lt 86400 ];  then printf '%dh ago' $(( delta / 3600 ))
    else                               printf '%dd ago' $(( delta / 86400 ))
    fi
  else
    printf '%s' "$iso"
  fi
}

# ---------- Event branching ----------

if [ "$event" = "UserPromptSubmit" ]; then
  if [ "$tier" = "silent" ]; then
    _hook_log allow "$_MATCHER" "silent-${pct}%"
    exit 0
  fi

  # Suppression check: per-session state file.
  state_file="${TMPDIR:-/tmp}/claude-context-awareness-${session_id}.state"
  current_turn=$(wc -l < "$transcript_path" 2>/dev/null || echo 0)
  current_turn=${current_turn// /}  # strip wc padding
  [ -z "$current_turn" ] && current_turn=0

  if [ -f "$state_file" ]; then
    last_turn=$(jq -r '.last_turn_count // 0' "$state_file" 2>/dev/null || echo 0)
    last_tier=$(jq -r '.last_threshold_tier // "silent"' "$state_file" 2>/dev/null || echo "silent")
    last_rank=$(_tier_rank "$last_tier")
    delta=$(( current_turn - last_turn ))
    if [ "$delta" -ge 0 ] && [ "$delta" -lt 5 ] && [ "$tier_rank" -le "$last_rank" ]; then
      _hook_log allow "$_MATCHER" "suppressed-${tier}-delta=${delta}"
      exit 0
    fi
  fi

  mode=$(_detect_mode)

  case "$tier" in
    40s)
      printf 'Context-awareness: ~%d%%. Mode: %s. Apply discretion rules from handoff skill — surface to user only if situation warrants per rules table.\n' "$pct" "$mode"
      ;;
    50s)
      printf 'Context-awareness: ~%d%%. Mode: %s. Quality risk moderate. Default to surfacing at next natural pause unless work is clearly wrapping up.\n' "$pct" "$mode"
      ;;
    60s)
      printf 'Context-awareness: ~%d%%. Mode: %s. Quality risk significant. Strongly recommend surfacing /handoff option at next natural pause. EMERGENCY tier will apply if invoked.\n' "$pct" "$mode"
      ;;
    70+)
      printf "Context-awareness: ~%d%%. Mode: %s. Quality risk HIGH. Surface /handoff immediately unless user explicitly said 'just finish this'. EMERGENCY tier mandatory.\n" "$pct" "$mode"
      ;;
  esac

  # Atomic state update.
  printf '{"last_turn_count": %d, "last_threshold_tier": "%s"}\n' "$current_turn" "$tier" \
    > "${state_file}.tmp" \
    && mv "${state_file}.tmp" "$state_file"

  _hook_log allow "$_MATCHER" "injected-${tier}-${pct}%"
  exit 0
fi

if [ "$event" = "SessionStart" ]; then
  # Resolve MEMORY.md path. Allow override for tests.
  if [ -n "${MEMORY_MD_OVERRIDE:-}" ]; then
    memory_md="$MEMORY_MD_OVERRIDE"
  else
    if [ -z "$cwd" ]; then
      _hook_log allow "$_MATCHER" "no-cwd"
      exit 0
    fi
    project_hash=$(printf '%s' "$cwd" | sed 's|/|-|g')
    memory_md="${HOME}/.claude/projects/${project_hash}/memory/MEMORY.md"
  fi

  if [ ! -f "$memory_md" ]; then
    _hook_log allow "$_MATCHER" "no-memory-md"
    exit 0
  fi

  # Read pending pointer lines (preserve line numbers for idempotent cleanup).
  mapfile -t pending_lines < <(grep -n '^- \[Pending handoff' "$memory_md" 2>/dev/null || true)

  if [ "${#pending_lines[@]}" -eq 0 ]; then
    _hook_log allow "$_MATCHER" "no-pending"
    exit 0
  fi

  consumed_line_numbers=()
  emitted=0

  for entry in "${pending_lines[@]}"; do
    # Split "LINENO:CONTENT"
    lineno="${entry%%:*}"
    line="${entry#*:}"

    # Extract topic between "Pending handoff — " and "](" .
    topic=$(printf '%s' "$line" | sed -n 's/^- \[Pending handoff — \(.*\)\](.*$/\1/p')
    # Extract path between "](" and ")".
    path=$(printf '%s' "$line" | sed -n 's/^- \[Pending handoff — [^]]*\](\([^)]*\)).*/\1/p')
    # Extract ISO timestamp from "created <ISO>,".
    iso=$(printf '%s' "$line" | sed -n 's/.*created \([0-9TZ:-]\{20\}\).*/\1/p')

    [ -z "$topic" ] && topic="(unknown)"
    [ -z "$path" ] && path="(unknown)"

    # Check status: consumed via frontmatter line — idempotent cleanup.
    if [ -n "$path" ] && [ -f "$path" ] && grep -q '^status: consumed$' "$path" 2>/dev/null; then
      consumed_line_numbers+=("$lineno")
      continue
    fi

    rel_time=""
    if [ -n "$iso" ]; then
      rel_time=$(_relative_time "$iso")
    fi
    [ -z "$rel_time" ] && rel_time="(unknown)"

    printf 'Pending handoff detected: %s\nTopic: %s\nCreated: %s\nASK the user via AskUserQuestion whether this session resumes %s before doing other work. Apply freshness check BEFORE loading handoff content. Do not load handoff content until user confirms resume.\n\n' \
      "$path" "$topic" "$rel_time" "$topic"
    emitted=$((emitted + 1))
  done

  # Atomic cleanup: remove lines whose linked doc is consumed.
  if [ "${#consumed_line_numbers[@]}" -gt 0 ]; then
    # Build awk expression `NR != L1 && NR != L2 ...`
    awk_expr=""
    for ln in "${consumed_line_numbers[@]}"; do
      if [ -z "$awk_expr" ]; then
        awk_expr="NR != $ln"
      else
        awk_expr="$awk_expr && NR != $ln"
      fi
    done
    tmp_memory="${memory_md}.tmp.$$"
    if awk "$awk_expr" "$memory_md" > "$tmp_memory" 2>/dev/null; then
      mv "$tmp_memory" "$memory_md"
    else
      rm -f "$tmp_memory"
    fi
  fi

  _hook_log allow "$_MATCHER" "pending-N=${emitted}-cleaned=${#consumed_line_numbers[@]}"
  exit 0
fi

# Unknown event — silent, fail-safe.
_hook_log allow "$_MATCHER" "unknown-event-${event}"
exit 0
