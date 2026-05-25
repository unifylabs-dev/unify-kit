#!/usr/bin/env bash
#
# test-detect-mode.sh — runtime-state tests for detect-mode.sh (§6.1 + §8.5).
# Each case sets up cwd/env, runs the script, asserts on JSON mode + paths.

set -euo pipefail
IFS=$'\n\t'

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="${HERE}/../detect-mode.sh"

[ -x "$SCRIPT" ] || { echo "detect-mode.sh not executable at $SCRIPT" >&2; exit 1; }

SBX=$(mktemp -d 2>/dev/null || mktemp -d -t dm)
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
# Case A — phasing-orchestrator (run.json with in_progress)
# ============================================================
echo "case A: phasing-orchestrator"
A_DIR="$SBX/case-a"
mkdir -p "$A_DIR/.claude/phasing/some-run"
cat > "$A_DIR/.claude/phasing/some-run/run.json" <<'EOF'
{
  "run_id": "some-run",
  "overall_status": "in_progress",
  "mode": "file",
  "phases": []
}
EOF
# Also drop master-plan.md so paths.master_plan populates
echo "# master plan" > "$A_DIR/.claude/phasing/some-run/master-plan.md"

out_a=$(cd "$A_DIR" && unset CLAUDE_PHASE_SESSION 2>/dev/null; bash "$SCRIPT")
mode_a=$(printf '%s' "$out_a" | jq -r '.mode')
rj_a=$(printf '%s' "$out_a" | jq -r '.paths.run_json')
mp_a=$(printf '%s' "$out_a" | jq -r '.paths.master_plan')

assert_eq "A: mode=phasing-orchestrator" "phasing-orchestrator" "$mode_a"
case "$rj_a" in
  */run.json) printf '  PASS  A: paths.run_json ends with run.json\n'; pass=$((pass+1)) ;;
  *)          printf '  FAIL  A: paths.run_json=%q\n' "$rj_a" >&2; fail=$((fail+1)) ;;
esac
case "$mp_a" in
  */master-plan.md) printf '  PASS  A: paths.master_plan populated for file mode\n'; pass=$((pass+1)) ;;
  *)                printf '  FAIL  A: paths.master_plan=%q\n' "$mp_a" >&2; fail=$((fail+1)) ;;
esac

# ============================================================
# Case B — phasing-executor (env var override)
# ============================================================
echo "case B: phasing-executor"
B_DIR="$SBX/case-b"
mkdir -p "$B_DIR"
# Note: even if run.json existed, the executor env var wins
mkdir -p "$B_DIR/.claude/phasing/run/"
cat > "$B_DIR/.claude/phasing/run/run.json" <<'EOF'
{"overall_status": "in_progress", "mode": "file", "phases": []}
EOF

out_b=$(cd "$B_DIR" && CLAUDE_PHASE_SESSION=1 bash "$SCRIPT")
mode_b=$(printf '%s' "$out_b" | jq -r '.mode')

assert_eq "B: mode=phasing-executor (env-var override)" "phasing-executor" "$mode_b"

# ============================================================
# Case C — generic (empty dir, no env)
# ============================================================
echo "case C: generic"
C_DIR="$SBX/case-c"
mkdir -p "$C_DIR"

out_c=$(cd "$C_DIR" && unset CLAUDE_PHASE_SESSION 2>/dev/null; bash "$SCRIPT")
mode_c=$(printf '%s' "$out_c" | jq -r '.mode')

assert_eq "C: mode=generic" "generic" "$mode_c"

# Also assert schema has all required paths.* keys
echo "schema check"
for key in run_json master_plan phase_spec design_doc_target plan_file gh_issue_number brainstorm_dir; do
  if printf '%s' "$out_c" | jq -e ".paths | has(\"$key\")" >/dev/null; then
    printf '  PASS  paths has %s\n' "$key"
    pass=$((pass+1))
  else
    printf '  FAIL  paths missing %s\n' "$key" >&2
    fail=$((fail+1))
  fi
done

# ============================================================
echo
echo "summary: $pass pass, $fail fail"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
echo "all PASS"
