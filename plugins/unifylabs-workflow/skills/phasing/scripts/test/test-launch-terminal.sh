#!/usr/bin/env bash
# test-launch-terminal.sh — backward-compat fixture for the optional 5th-arg
# extension to launch-terminal.sh (spec §7A of P7).
#
# Three cases, each invoked with LAUNCH_TERMINAL_DRY_RUN=1 so the slow
# terminal-detection branches are skipped and the script echoes the computed
# COMMAND + env-marker block instead of spawning anything.
#
# Case A: backward-compat 4-arg form           → expect /phase-execute
# Case B: 5-arg form with 5th = phase-continue  → expect /phase-continue
# Case C: 5-arg form with 5th = empty string    → expect /phase-execute (default)
#
# Each case also asserts CLAUDE_PHASE_SESSION=1 is present in the dry-run
# output (env marker the handoff skill's detect-mode.sh uses to identify
# executor sessions; see plugins/unifylabs-workflow/skills/handoff/references/
# addendum-phase-exec.md).
#
# Exit codes: 0 = all cases PASS; 1 = any case FAIL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCH_TERMINAL="$SCRIPT_DIR/../launch-terminal.sh"

if [ ! -f "$LAUNCH_TERMINAL" ]; then
    echo "FAIL — launch-terminal.sh not found at $LAUNCH_TERMINAL" >&2
    exit 1
fi

# Temp project dir for cd resolution inside launch-terminal.sh.
TEST_PROJECT_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_PROJECT_DIR"' EXIT

fail_count=0

# assert_contains <case-label> <output> <expected-substring>
assert_contains() {
    local label="$1"
    local output="$2"
    local expected="$3"
    if [[ "$output" == *"$expected"* ]]; then
        echo "  PASS — $label contains '$expected'"
    else
        echo "  FAIL — $label missing '$expected'" >&2
        echo "    output: $output" >&2
        fail_count=$((fail_count + 1))
    fi
}

# Case A: 4-arg backward-compat
echo "Case A — 4-arg backward-compat:"
output_a=$(LAUNCH_TERMINAL_DRY_RUN=1 bash "$LAUNCH_TERMINAL" test-run-a 1 "$TEST_PROJECT_DIR" "phase-1-foo")
assert_contains "Case A" "$output_a" "claude /phase-execute test-run-a 1"
assert_contains "Case A" "$output_a" "CLAUDE_PHASE_SESSION=1"

# Case B: 5-arg with phase-continue
echo "Case B — 5-arg with phase-continue:"
output_b=$(LAUNCH_TERMINAL_DRY_RUN=1 bash "$LAUNCH_TERMINAL" test-run-b 2 "$TEST_PROJECT_DIR" "phase-2-foo" "phase-continue")
assert_contains "Case B" "$output_b" "claude /phase-continue test-run-b 2"
assert_contains "Case B" "$output_b" "CLAUDE_PHASE_SESSION=1"

# Case C: 5-arg empty string defaults to phase-execute
echo "Case C — 5-arg empty string defaults to phase-execute:"
output_c=$(LAUNCH_TERMINAL_DRY_RUN=1 bash "$LAUNCH_TERMINAL" test-run-c 3 "$TEST_PROJECT_DIR" "phase-3-foo" "")
assert_contains "Case C" "$output_c" "claude /phase-execute test-run-c 3"
assert_contains "Case C" "$output_c" "CLAUDE_PHASE_SESSION=1"

echo
if [ "$fail_count" -eq 0 ]; then
    echo "ALL PASS — 3/3 backward-compat cases"
    exit 0
else
    echo "FAIL — $fail_count assertion(s) failed across 3 cases" >&2
    exit 1
fi
