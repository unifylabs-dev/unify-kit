#!/usr/bin/env bash
#
# freshness-check.sh — drift detection on session-handoff resume (design spec §8.4).
# Reads a handoff doc, parses §4 World state (git + load-bearing files + optional run-state),
# probes the actual environment, and emits a JSON verdict to stdout.
#
# Input:  $1 = path to handoff doc.
# Output: JSON object — see references/resume-protocol.md §3 for schema.
# Exit:   0 always (caller branches on .overall); 2 on usage error.

set -euo pipefail
IFS=$'\n\t'

[ $# -ge 1 ] || { echo "usage: freshness-check.sh <handoff-path>" >&2; exit 2; }
HANDOFF="$1"
[ -f "$HANDOFF" ] || { echo "handoff not found: $HANDOFF" >&2; exit 2; }

# ---------- §4.1 Git state ----------
git_block=$(awk '/^### 4\.1 Git state/{f=1;next} /^### 4\.|^## /{f=0} f' "$HANDOFF" || true)
expected_branch=$(printf '%s\n' "$git_block" | sed -n 's/^- \*\*Branch:\*\* *//p' | head -1)
expected_head=$(printf '%s\n' "$git_block" | sed -n 's/^- \*\*HEAD SHA:\*\* *//p' | head -1)

if git rev-parse --git-dir >/dev/null 2>&1; then
  actual_head=$(git rev-parse HEAD 2>/dev/null || echo "")
  actual_branch=$(git branch --show-current 2>/dev/null || echo "")
  if [ -z "$(git status --porcelain 2>/dev/null || true)" ]; then
    actual_tree="clean"
  else
    dirty_files=$(git status --porcelain 2>/dev/null | awk '{print $NF}' | paste -sd, - 2>/dev/null || true)
    actual_tree="dirty:${dirty_files}"
  fi
  if [ -z "$expected_head" ] && [ -z "$expected_branch" ]; then
    git_status="skipped"
  elif [ "$expected_head" = "$actual_head" ] && [ "$expected_branch" = "$actual_branch" ]; then
    git_status="match"
  else
    git_status="drift"
  fi
else
  git_status="skipped"
  actual_head=""
  actual_branch=""
  actual_tree=""
fi

# ---------- §4.2 Files load-bearing ----------
files_block=$(awk '/^### 4\.2 Files load-bearing/{f=1;next} /^### 4\.|^## /{f=0} f' "$HANDOFF" || true)
load_bearing_json="[]"
while IFS= read -r path; do
  [ -n "$path" ] || continue
  if [ -f "$path" ]; then
    status="exists"
  else
    base=$(basename "$path")
    moved=""
    if git rev-parse --git-dir >/dev/null 2>&1; then
      moved=$(git log --diff-filter=R --follow --name-only --format= -- "$path" 2>/dev/null | head -1 || true)
    fi
    if [ -n "$moved" ]; then
      status="moved"
    elif [ -n "$base" ] && find . -name "$base" -type f -print -quit 2>/dev/null | grep -q .; then
      status="moved"
    else
      status="missing"
    fi
  fi
  load_bearing_json=$(jq -c --arg p "$path" --arg s "$status" '. + [{path:$p,status:$s}]' <<< "$load_bearing_json")
done < <(printf '%s\n' "$files_block" | sed -n 's/^- `\([^`]*\)`.*/\1/p')

# ---------- §4.3 Run state (optional) ----------
runstate_block=$(awk '/^### 4\.3 Run state/{f=1;next} /^## |^---$/{f=0} f' "$HANDOFF" || true)
runjson_status="n/a"
if printf '%s\n' "$runstate_block" | grep -qE '^[[:space:]]*\| *[0-9]+ *\|'; then
  expected_phases=$(printf '%s\n' "$runstate_block" \
    | awk -F'|' '/^[[:space:]]*\| *[0-9]+ *\|/ {
        gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$4);
        printf "%s:%s\n", $2, $4
      }')
  run_json_path=$(printf '%s\n' "$runstate_block" | sed -n 's/^[[:space:]]*- \*\*run\.json path:\*\* *//p' | head -1)
  if [ -n "$run_json_path" ] && [ -f "$run_json_path" ]; then
    actual_phases=$(jq -r '.phases[] | "\(.n):\(.status)"' "$run_json_path" 2>/dev/null || echo "")
    if [ "$expected_phases" = "$actual_phases" ]; then
      runjson_status="match"
    else
      runjson_status="drift"
    fi
  else
    runjson_status="drift"
  fi
fi

# ---------- Roll-up: overall ----------
overall="clean"
if printf '%s' "$load_bearing_json" | jq -e 'any(.status=="missing")' >/dev/null; then
  overall="fatal"
else
  drift=0
  [ "$git_status" = "drift" ] && drift=1
  [ "$runjson_status" = "drift" ] && drift=1
  if printf '%s' "$load_bearing_json" | jq -e 'any(.status=="moved")' >/dev/null; then
    drift=1
  fi
  if [ -n "$actual_tree" ] && [ "$actual_tree" != "clean" ]; then
    drift=1
  fi
  [ "$drift" = "1" ] && overall="drift_detected"
fi

# ---------- Emit JSON ----------
jq -n \
  --arg gs "$git_status" \
  --arg eh "$expected_head" \
  --arg ah "$actual_head" \
  --arg eb "$expected_branch" \
  --arg ab "$actual_branch" \
  --arg wt "${actual_tree:-}" \
  --argjson lb "$load_bearing_json" \
  --arg rs "$runjson_status" \
  --arg overall "$overall" \
  '{
    git_check: {
      status: $gs,
      expected_head: $eh,
      actual_head: $ah,
      expected_branch: $eb,
      actual_branch: $ab,
      working_tree: $wt
    },
    load_bearing_files: $lb,
    run_json_check: { status: $rs },
    overall: $overall
  }'
