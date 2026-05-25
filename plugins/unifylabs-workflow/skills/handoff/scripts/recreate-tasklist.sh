#!/usr/bin/env bash
#
# recreate-tasklist.sh — parse a handoff's §5 TaskList snapshot and emit
# shell-quoted TaskCreate / TaskUpdate command lines (design spec §8.6).
#
# Input:  $1 = path to handoff doc.
# Output: stdout — one TaskCreate per task in source order, then TaskUpdate <n> completed
#         for each completed task, then TaskUpdate <n> in_progress for the (at most one) in_progress task.
# Exit:   0 on success; 2 usage error; 3 unknown status; 4 multiple in_progress.

set -euo pipefail
IFS=$'\n\t'

[ $# -ge 1 ] || { echo "usage: recreate-tasklist.sh <handoff-path>" >&2; exit 2; }
HANDOFF="$1"
[ -f "$HANDOFF" ] || { echo "handoff not found: $HANDOFF" >&2; exit 2; }

# Extract §5 block: lines between '## §5 TaskList snapshot' and the next '## ' header or '---'.
tasks_block=$(awk '
  /^## §5 TaskList snapshot/ { f=1; next }
  /^## / || /^---$/          { if (f) { f=0 } }
  f { print }
' "$HANDOFF")

in_progress_count=0
in_progress_idx=0
completed_idxs=()
idx=0
declare -a SUBJECTS DESCRIPTIONS

while IFS= read -r line; do
  [ -n "$line" ] || continue
  # Expected shape: `- [status] subject — description`
  if [[ "$line" =~ ^-\ \[(pending|in_progress|completed)\]\ (.+)$ ]]; then
    status="${BASH_REMATCH[1]}"
    rest="${BASH_REMATCH[2]}"
    if [[ "$rest" == *" — "* ]]; then
      subject="${rest%% — *}"
      description="${rest#* — }"
    else
      subject="$rest"
      description=""
    fi
    idx=$((idx + 1))
    SUBJECTS[$idx]="$subject"
    DESCRIPTIONS[$idx]="$description"
    case "$status" in
      in_progress)
        in_progress_count=$((in_progress_count + 1))
        in_progress_idx=$idx
        ;;
      completed)
        completed_idxs+=("$idx")
        ;;
    esac
  elif [[ "$line" =~ ^-\ \[ ]]; then
    echo "unknown task status in line: $line" >&2
    exit 3
  fi
done <<< "$tasks_block"

if [ "$in_progress_count" -gt 1 ]; then
  echo "more than one in_progress task (count=$in_progress_count)" >&2
  exit 4
fi

# Emit TaskCreate lines (source order)
i=1
while [ "$i" -le "$idx" ]; do
  printf 'TaskCreate %q %q\n' "${SUBJECTS[$i]}" "${DESCRIPTIONS[$i]}"
  i=$((i + 1))
done

# Emit TaskUpdate completed (source order)
for ci in "${completed_idxs[@]:-}"; do
  [ -n "$ci" ] || continue
  printf 'TaskUpdate %d completed\n' "$ci"
done

# Emit single TaskUpdate in_progress
if [ "$in_progress_idx" -gt 0 ]; then
  printf 'TaskUpdate %d in_progress\n' "$in_progress_idx"
fi
