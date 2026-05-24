#!/usr/bin/env bash
#
# test-recreate-tasklist.sh — fixture-driven tests for recreate-tasklist.sh (§8.6 contract).

set -euo pipefail
IFS=$'\n\t'

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="${HERE}/../recreate-tasklist.sh"
FIX="${HERE}/fixtures/recreate-tasklist"

[ -x "$SCRIPT" ] || { echo "recreate-tasklist.sh not executable at $SCRIPT" >&2; exit 1; }

SBX=$(mktemp -d 2>/dev/null || mktemp -d -t rt)
trap 'rm -rf "$SBX"' EXIT

fail=0
pass=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  PASS  %s\n' "$label"
    pass=$((pass + 1))
  else
    printf '  FAIL  %s — expected=%q actual=%q\n' "$label" "$expected" "$actual" >&2
    fail=$((fail + 1))
  fi
}

# ============================================================
# Case 1 — happy path: 3 tasks, 1 in_progress, 0 completed
# ============================================================
echo "case: happy path (3 tasks, 1 in_progress)"
OUT="$SBX/out-happy.sh"
bash "$SCRIPT" "$FIX/handoff-with-tasks.md" > "$OUT"

tc_lines=$(grep -c '^TaskCreate ' "$OUT" || true)
tu_in_progress=$(grep -c '^TaskUpdate [0-9]\+ in_progress$' "$OUT" || true)
tu_completed=$(grep -c '^TaskUpdate [0-9]\+ completed$' "$OUT" || true)
inprog_idx=$(grep '^TaskUpdate [0-9]\+ in_progress$' "$OUT" | awk '{print $2}')

assert_eq "happy: TaskCreate count=3" "3" "$tc_lines"
assert_eq "happy: TaskUpdate in_progress count=1" "1" "$tu_in_progress"
assert_eq "happy: TaskUpdate completed count=0" "0" "$tu_completed"
assert_eq "happy: in_progress index=2" "2" "$inprog_idx"

# Verify TaskCreate lines, when eval'd, yield the original subjects/descriptions
TaskCreate() { printf '%s|%s\n' "$1" "$2"; }
mapfile -t materialized < <(
  while IFS= read -r line; do
    [[ "$line" == TaskCreate* ]] || continue
    eval "$line"
  done < "$OUT"
)
assert_eq "happy: tc[0] subject" "fetch user records" "${materialized[0]%%|*}"
assert_eq "happy: tc[0] description" "Query users by tenant_id" "${materialized[0]#*|}"
assert_eq "happy: tc[1] subject" "validate schema" "${materialized[1]%%|*}"
assert_eq "happy: tc[2] subject" "apply transformation" "${materialized[2]%%|*}"

# ============================================================
# Case 2 — negative: two in_progress tasks → script exits non-zero
# ============================================================
echo "case: negative (two in_progress)"
set +e
out_err=$(bash "$SCRIPT" "$FIX/handoff-two-inprogress.md" 2>&1 1>/dev/null)
rc=$?
set -e
assert_eq "negative: exit non-zero" "non-zero" "$([ $rc -ne 0 ] && echo non-zero || echo zero)"
if printf '%s' "$out_err" | grep -q "more than one in_progress"; then
  printf '  PASS  negative: stderr contains 'more than one in_progress'\n'
  pass=$((pass + 1))
else
  printf '  FAIL  negative: stderr missing 'more than one in_progress' — got: %s\n' "$out_err" >&2
  fail=$((fail + 1))
fi

# ============================================================
echo
echo "summary: $pass pass, $fail fail"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
echo "PASS"
