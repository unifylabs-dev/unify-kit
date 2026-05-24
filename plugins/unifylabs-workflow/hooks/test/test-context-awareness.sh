#!/usr/bin/env bash
#
# test-context-awareness.sh — fixture-driven test for hooks/context-awareness.sh
#
# Covers 6 cases per phase-3 spec §3A:
#   1. 35% UserPromptSubmit -> silent (empty stdout)
#   2. 45% UserPromptSubmit -> 40s reminder
#   3. 55% UserPromptSubmit -> 50s reminder
#   4. 70% UserPromptSubmit -> 70+ reminder
#   5. SessionStart with MEMORY.md pending pointer -> pending-handoff reminder
#   6. 45% UserPromptSubmit with pre-existing suppression state -> silent
#
# Each case isolates its state file under TMPDIR via a unique session_id;
# case-end cleanup removes the state file so reruns are deterministic.

set -euo pipefail
IFS=$'\n\t'

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$HOOK_DIR/context-awareness.sh"
FIXTURES="$(cd "$(dirname "$0")/fixtures" && pwd)"

# Make detect-mode resolvable without setting CLAUDE_PLUGIN_ROOT externally:
# the hook expands ${CLAUDE_PLUGIN_ROOT}; set it so the subshell can find detect-mode.sh.
export CLAUDE_PLUGIN_ROOT="$(cd "$HOOK_DIR/.." && pwd)"

PASS=0
FAIL=0
FAILURES=()

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if printf '%s' "$haystack" | grep -qF "$needle"; then
    PASS=$((PASS + 1))
    printf '  PASS  %s contains %q\n' "$label" "$needle"
  else
    FAIL=$((FAIL + 1))
    FAILURES+=("$label: expected substring not found: $needle")
    printf '  FAIL  %s did NOT contain %q\n' "$label" "$needle" >&2
    printf '         actual: %s\n' "$haystack" >&2
  fi
}

assert_empty() {
  local label="$1" haystack="$2"
  if [ -z "$haystack" ]; then
    PASS=$((PASS + 1))
    printf '  PASS  %s emitted empty stdout\n' "$label"
  else
    FAIL=$((FAIL + 1))
    FAILURES+=("$label: expected empty stdout, got: $haystack")
    printf '  FAIL  %s expected empty, got: %s\n' "$label" "$haystack" >&2
  fi
}

# Helper: build hook input JSON for UserPromptSubmit.
ups_input() {
  local sid="$1" transcript="$2"
  jq -n \
    --arg sid "$sid" \
    --arg tp "$transcript" \
    --arg cwd "$(pwd)" \
    '{hook_event_name: "UserPromptSubmit", session_id: $sid, transcript_path: $tp, cwd: $cwd, permission_mode: "auto", prompt: "test prompt"}'
}

# Helper: build hook input JSON for SessionStart.
ss_input() {
  local sid="$1" transcript="$2"
  jq -n \
    --arg sid "$sid" \
    --arg tp "$transcript" \
    --arg cwd "$(pwd)" \
    '{hook_event_name: "SessionStart", session_id: $sid, transcript_path: $tp, cwd: $cwd, model: "claude-sonnet-4-6", source: "startup"}'
}

# Helper: clean up a session's state file under TMPDIR.
cleanup_state() {
  local sid="$1"
  rm -f "${TMPDIR:-/tmp}/claude-context-awareness-${sid}.state"
}

# Helper: override the MEMORY.md path the hook resolves for SessionStart.
# We inject MEMORY_MD_OVERRIDE so we don't have to fabricate the project-hash dir.
# Important: env var must be set on the bash invocation that runs the hook,
# not on the printf that pipes input — `VAR=x cmd1 | cmd2` only affects cmd1.
run_hook_with_memory_override() {
  local input="$1" memory_md="$2"
  printf '%s' "$input" | MEMORY_MD_OVERRIDE="$memory_md" bash "$HOOK"
}

run_hook() {
  local input="$1"
  printf '%s' "$input" | bash "$HOOK"
}

printf 'Running test-context-awareness.sh\n'
printf 'HOOK: %s\n' "$HOOK"
printf 'FIXTURES: %s\n\n' "$FIXTURES"

# ---------- Case 1: 35% UserPromptSubmit -> silent ----------
SID="test-35pct"
cleanup_state "$SID"
printf 'Case 1: 35%% UserPromptSubmit -> silent\n'
INPUT=$(ups_input "$SID" "$FIXTURES/transcript-35pct.jsonl")
OUT=$(run_hook "$INPUT")
assert_empty "case-1-35pct-silent" "$OUT"
cleanup_state "$SID"
printf '\n'

# ---------- Case 2: 45% UserPromptSubmit -> 40s reminder ----------
SID="test-45pct"
cleanup_state "$SID"
printf 'Case 2: 45%% UserPromptSubmit -> 40s reminder\n'
INPUT=$(ups_input "$SID" "$FIXTURES/transcript-45pct.jsonl")
OUT=$(run_hook "$INPUT")
assert_contains "case-2-45pct" "$OUT" "~45%"
assert_contains "case-2-45pct" "$OUT" "Apply discretion rules"
cleanup_state "$SID"
printf '\n'

# ---------- Case 3: 55% UserPromptSubmit -> 50s reminder ----------
SID="test-55pct"
cleanup_state "$SID"
printf 'Case 3: 55%% UserPromptSubmit -> 50s reminder\n'
INPUT=$(ups_input "$SID" "$FIXTURES/transcript-55pct.jsonl")
OUT=$(run_hook "$INPUT")
assert_contains "case-3-55pct" "$OUT" "~55%"
assert_contains "case-3-55pct" "$OUT" "Quality risk moderate"
cleanup_state "$SID"
printf '\n'

# ---------- Case 4: 70% UserPromptSubmit -> 70+ reminder ----------
SID="test-70pct"
cleanup_state "$SID"
printf 'Case 4: 70%% UserPromptSubmit -> 70+ reminder\n'
INPUT=$(ups_input "$SID" "$FIXTURES/transcript-70pct.jsonl")
OUT=$(run_hook "$INPUT")
assert_contains "case-4-70pct" "$OUT" "~70%"
assert_contains "case-4-70pct" "$OUT" "EMERGENCY tier mandatory"
cleanup_state "$SID"
printf '\n'

# ---------- Case 5: SessionStart with pending pointer -> pending reminder ----------
SID="test-pending"
cleanup_state "$SID"
printf 'Case 5: SessionStart with MEMORY.md pending pointer -> pending reminder\n'
INPUT=$(ss_input "$SID" "$FIXTURES/transcript-35pct.jsonl")
OUT=$(run_hook_with_memory_override "$INPUT" "$FIXTURES/memory-with-pending.md")
assert_contains "case-5-pending" "$OUT" "Pending handoff detected:"
assert_contains "case-5-pending" "$OUT" "ASK the user via AskUserQuestion"
cleanup_state "$SID"
printf '\n'

# ---------- Case 6: 45% UserPromptSubmit with pre-existing suppression state -> silent ----------
SID="test-suppressed"
cleanup_state "$SID"
printf 'Case 6: 45%% UserPromptSubmit + suppression state -> silent\n'
# Pre-place suppression state: same tier (40s), recent turn count.
# Transcript has 3 lines, so we set last_turn_count=2 -> delta=1, < 5.
cp "$FIXTURES/state-suppressed.state" "${TMPDIR:-/tmp}/claude-context-awareness-${SID}.state"
INPUT=$(ups_input "$SID" "$FIXTURES/transcript-45pct.jsonl")
OUT=$(run_hook "$INPUT")
assert_empty "case-6-suppressed" "$OUT"
cleanup_state "$SID"
printf '\n'

# ---------- Summary ----------
TOTAL=$((PASS + FAIL))
printf '=====================================\n'
printf 'Total: %d  Pass: %d  Fail: %d\n' "$TOTAL" "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '\nFailures:\n'
  for f in "${FAILURES[@]}"; do
    printf '  - %s\n' "$f"
  done
  exit 1
fi
printf 'all PASS\n'
exit 0
