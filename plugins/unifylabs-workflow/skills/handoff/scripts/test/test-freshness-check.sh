#!/usr/bin/env bash
#
# test-freshness-check.sh — fixture-driven tests for freshness-check.sh (§8.4 contract).
# Each case builds an isolated sandbox + handoff fixture from a template, then asserts
# on the JSON `overall` field plus load-bearing-files shape.

set -euo pipefail
IFS=$'\n\t'

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="${HERE}/../freshness-check.sh"
FIX="${HERE}/fixtures/freshness-check"

[ -x "$SCRIPT" ] || { echo "freshness-check.sh not executable at $SCRIPT" >&2; exit 1; }

SBX=$(mktemp -d 2>/dev/null || mktemp -d -t fc)
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

# ----- Build a fresh repo with one commit; capture HEAD_INITIAL -----
make_repo() {
  local repo="$1"
  rm -rf "$repo"
  mkdir -p "$repo"
  (
    cd "$repo"
    git init -q -b main
    git config user.email test@example.com
    git config user.name "Test"
    echo "load" > load-bearing.txt
    git add load-bearing.txt
    GIT_COMMITTER_DATE='2026-05-24T00:00:00Z' GIT_AUTHOR_DATE='2026-05-24T00:00:00Z' \
      git commit -q -m "initial commit"
  )
}

# ----- Render a fixture by substituting placeholders -----
render() {
  local tmpl="$1" out="$2"
  shift 2
  local content
  content=$(cat "$tmpl")
  while [ $# -gt 0 ]; do
    local key="$1" val="$2"
    # Replace using bash builtin (no sed delimiter pain)
    content="${content//\{\{${key}\}\}/${val}}"
    shift 2
  done
  printf '%s' "$content" > "$out"
}

# ============================================================
# Case 1 — clean
# ============================================================
echo "case: clean"
REPO="$SBX/clean-repo"
make_repo "$REPO"
HEAD=$(cd "$REPO" && git rev-parse HEAD)
BRANCH=$(cd "$REPO" && git branch --show-current)
HANDOFF="$SBX/clean.md"
render "$FIX/clean.md.tmpl" "$HANDOFF" \
  REPO "$REPO" HEAD "$HEAD" BRANCH "$BRANCH"

out=$(cd "$REPO" && bash "$SCRIPT" "$HANDOFF")
overall=$(printf '%s' "$out" | jq -r '.overall')
git_status=$(printf '%s' "$out" | jq -r '.git_check.status')
lb_count=$(printf '%s' "$out" | jq -r '.load_bearing_files | length')
lb_status=$(printf '%s' "$out" | jq -r '.load_bearing_files[0].status')

assert_eq "clean: overall=clean" "clean" "$overall"
assert_eq "clean: git_check.status=match" "match" "$git_status"
assert_eq "clean: load_bearing[0].status=exists" "exists" "$lb_status"
assert_eq "clean: load_bearing length=1" "1" "$lb_count"

# ============================================================
# Case 2 — drift (HEAD advanced past expected_head)
# ============================================================
echo "case: drift"
REPO="$SBX/drift-repo"
make_repo "$REPO"
OLD_HEAD=$(cd "$REPO" && git rev-parse HEAD)
BRANCH=$(cd "$REPO" && git branch --show-current)
# Advance HEAD with a second commit
(
  cd "$REPO"
  echo "more" >> load-bearing.txt
  git add load-bearing.txt
  GIT_COMMITTER_DATE='2026-05-24T01:00:00Z' GIT_AUTHOR_DATE='2026-05-24T01:00:00Z' \
    git commit -q -m "second commit"
)
HANDOFF="$SBX/drift.md"
render "$FIX/drift.md.tmpl" "$HANDOFF" \
  REPO "$REPO" BRANCH "$BRANCH" OLD_HEAD "$OLD_HEAD"

out=$(cd "$REPO" && bash "$SCRIPT" "$HANDOFF")
overall=$(printf '%s' "$out" | jq -r '.overall')
git_status=$(printf '%s' "$out" | jq -r '.git_check.status')

assert_eq "drift: overall=drift_detected" "drift_detected" "$overall"
assert_eq "drift: git_check.status=drift" "drift" "$git_status"

# ============================================================
# Case 3 — fatal (missing load-bearing file + run.json drift)
# ============================================================
echo "case: fatal"
REPO="$SBX/fatal-repo"
make_repo "$REPO"
HEAD=$(cd "$REPO" && git rev-parse HEAD)
BRANCH=$(cd "$REPO" && git branch --show-current)
# Set up a run.json whose phase array DIFFERS from what fixture expects
mkdir -p "$REPO/.claude/phasing/test-fatal-run"
cat > "$REPO/.claude/phasing/test-fatal-run/run.json" <<EOF
{
  "run_id": "test-fatal-run",
  "overall_status": "in_progress",
  "phases": [
    {"n": 0, "name": "Foundation", "status": "pending"},
    {"n": 1, "name": "Build", "status": "pending"}
  ]
}
EOF

HANDOFF="$SBX/fatal.md"
render "$FIX/fatal.md.tmpl" "$HANDOFF" \
  REPO "$REPO" HEAD "$HEAD" BRANCH "$BRANCH"

out=$(cd "$REPO" && bash "$SCRIPT" "$HANDOFF")
overall=$(printf '%s' "$out" | jq -r '.overall')
missing_count=$(printf '%s' "$out" | jq -r '[.load_bearing_files[] | select(.status=="missing")] | length')
rj_status=$(printf '%s' "$out" | jq -r '.run_json_check.status')

assert_eq "fatal: overall=fatal" "fatal" "$overall"
assert_eq "fatal: missing files count=1" "1" "$missing_count"
assert_eq "fatal: run_json_check.status=drift" "drift" "$rj_status"

# ============================================================
echo
echo "summary: $pass pass, $fail fail"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
echo "all PASS"
