#!/usr/bin/env bash
#
# test-context-awareness.sh — fixture-driven test for hooks/context-awareness.sh
#
# Window-fraction model (revised 2026-06-01). The hook prefers the harness-native
# `context_window.used_percentage`; it falls back to (last main-thread assistant
# token usage ÷ model window) only when the payload omits that field. Tiers:
#   silent <60% · warn 60–74% · suggest-handoff 75–84% · urgent ≥85%.
#
# Cases:
#   Native path (primary):
#     1. native 50%  -> silent
#     2. native 62%  -> warn
#     3. native 78%  -> handoff
#     4. native 91%  -> urgent (EMERGENCY)
#   Computed fallback (transcript ÷ window):
#     5. sonnet 100k/200k = 50% -> silent
#     6. sonnet 140k/200k = 70% -> warn
#     7. sonnet 160k/200k = 80% -> handoff
#     8. opus-4-8[1m] 700k/1M = 70% -> warn  (exercises the opus arm + [1m] strip)
#   SessionStart + state:
#     9. SessionStart with MEMORY.md pending pointer -> pending-handoff reminder
#    10. computed warn + pre-existing same-tier suppression state -> silent
#    11. escalation: suppressed (warn) session, native 91% -> urgent fires anyway
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

# Helper: UserPromptSubmit input carrying the harness-native window-fraction signal.
ups_native() {
  local sid="$1" pct="$2" transcript="${3:-}"
  jq -n \
    --arg sid "$sid" \
    --argjson pct "$pct" \
    --arg tp "$transcript" \
    --arg cwd "$(pwd)" \
    '{hook_event_name: "UserPromptSubmit", session_id: $sid, transcript_path: $tp, cwd: $cwd, permission_mode: "auto", prompt: "test prompt", context_window: {used_percentage: $pct}}'
}

# Helper: UserPromptSubmit input with NO native signal -> forces the computed fallback.
ups_computed() {
  local sid="$1" transcript="$2"
  jq -n \
    --arg sid "$sid" \
    --arg tp "$transcript" \
    --arg cwd "$(pwd)" \
    '{hook_event_name: "UserPromptSubmit", session_id: $sid, transcript_path: $tp, cwd: $cwd, permission_mode: "auto", prompt: "test prompt"}'
}

# Helper: SessionStart input.
ss_input() {
  local sid="$1" transcript="$2"
  jq -n \
    --arg sid "$sid" \
    --arg tp "$transcript" \
    --arg cwd "$(pwd)" \
    '{hook_event_name: "SessionStart", session_id: $sid, transcript_path: $tp, cwd: $cwd, model: "claude-opus-4-8[1m]", source: "startup"}'
}

cleanup_state() {
  local sid="$1"
  rm -f "${TMPDIR:-/tmp}/claude-context-awareness-${sid}.state"
}

# Important: the env var must be set on the bash invocation that runs the hook,
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

# ---------- Case 1: native 50%% -> silent ----------
SID="test-native-50"; cleanup_state "$SID"
printf 'Case 1: native 50%% -> silent\n'
OUT=$(run_hook "$(ups_native "$SID" 50)")
assert_empty "case-1-native-50-silent" "$OUT"
cleanup_state "$SID"; printf '\n'

# ---------- Case 2: native 62%% -> warn ----------
SID="test-native-62"; cleanup_state "$SID"
printf 'Case 2: native 62%% -> warn\n'
OUT=$(run_hook "$(ups_native "$SID" 62)")
assert_contains "case-2-native-62" "$OUT" "~62%"
assert_contains "case-2-native-62" "$OUT" "Quality risk moderate"
cleanup_state "$SID"; printf '\n'

# ---------- Case 3: native 78%% -> handoff ----------
SID="test-native-78"; cleanup_state "$SID"
printf 'Case 3: native 78%% -> handoff\n'
OUT=$(run_hook "$(ups_native "$SID" 78)")
assert_contains "case-3-native-78" "$OUT" "~78%"
assert_contains "case-3-native-78" "$OUT" "Quality risk significant"
cleanup_state "$SID"; printf '\n'

# ---------- Case 4: native 91%% -> urgent ----------
SID="test-native-91"; cleanup_state "$SID"
printf 'Case 4: native 91%% -> urgent\n'
OUT=$(run_hook "$(ups_native "$SID" 91)")
assert_contains "case-4-native-91" "$OUT" "~91%"
assert_contains "case-4-native-91" "$OUT" "Quality risk HIGH"
assert_contains "case-4-native-91" "$OUT" "EMERGENCY"
cleanup_state "$SID"; printf '\n'

# ---------- Case 5: computed sonnet 50%% -> silent ----------
SID="test-comp-silent"; cleanup_state "$SID"
printf 'Case 5: computed sonnet 100k/200k = 50%% -> silent\n'
OUT=$(run_hook "$(ups_computed "$SID" "$FIXTURES/transcript-silent-sonnet.jsonl")")
assert_empty "case-5-computed-silent" "$OUT"
cleanup_state "$SID"; printf '\n'

# ---------- Case 6: computed sonnet 70%% -> warn ----------
SID="test-comp-warn"; cleanup_state "$SID"
printf 'Case 6: computed sonnet 140k/200k = 70%% -> warn\n'
OUT=$(run_hook "$(ups_computed "$SID" "$FIXTURES/transcript-warn-sonnet.jsonl")")
assert_contains "case-6-computed-warn" "$OUT" "~70%"
assert_contains "case-6-computed-warn" "$OUT" "200k window"
assert_contains "case-6-computed-warn" "$OUT" "Quality risk moderate"
cleanup_state "$SID"; printf '\n'

# ---------- Case 7: computed sonnet 80%% -> handoff ----------
SID="test-comp-handoff"; cleanup_state "$SID"
printf 'Case 7: computed sonnet 160k/200k = 80%% -> handoff\n'
OUT=$(run_hook "$(ups_computed "$SID" "$FIXTURES/transcript-handoff-sonnet.jsonl")")
assert_contains "case-7-computed-handoff" "$OUT" "~80%"
assert_contains "case-7-computed-handoff" "$OUT" "Quality risk significant"
cleanup_state "$SID"; printf '\n'

# ---------- Case 8: computed opus-4-8[1m] 70%% -> warn (opus arm + [1m] strip) ----------
SID="test-comp-opus"; cleanup_state "$SID"
printf 'Case 8: computed opus-4-8[1m] 700k/1M = 70%% -> warn\n'
OUT=$(run_hook "$(ups_computed "$SID" "$FIXTURES/transcript-opus48.jsonl")")
assert_contains "case-8-computed-opus48" "$OUT" "~70%"
assert_contains "case-8-computed-opus48" "$OUT" "1M window"
cleanup_state "$SID"; printf '\n'

# ---------- Case 9: SessionStart with pending pointer -> pending reminder ----------
SID="test-pending"; cleanup_state "$SID"
printf 'Case 9: SessionStart with MEMORY.md pending pointer -> pending reminder\n'
OUT=$(run_hook_with_memory_override "$(ss_input "$SID" "")" "$FIXTURES/memory-with-pending.md")
assert_contains "case-9-pending" "$OUT" "Pending handoff detected:"
assert_contains "case-9-pending" "$OUT" "ASK the user via AskUserQuestion"
cleanup_state "$SID"; printf '\n'

# ---------- Case 10: computed warn + pre-existing same-tier suppression state -> silent ----------
SID="test-suppressed"; cleanup_state "$SID"
printf 'Case 10: computed warn + suppression state -> silent\n'
# warn-sonnet transcript has 3 lines -> current_turn=3; state last_turn_count=2 -> delta=1 (<5), same tier -> suppress.
cp "$FIXTURES/state-suppressed.state" "${TMPDIR:-/tmp}/claude-context-awareness-${SID}.state"
OUT=$(run_hook "$(ups_computed "$SID" "$FIXTURES/transcript-warn-sonnet.jsonl")")
assert_empty "case-10-suppressed" "$OUT"
cleanup_state "$SID"; printf '\n'

# ---------- Case 11: escalation past suppression -> urgent fires ----------
SID="test-escalate"; cleanup_state "$SID"
printf 'Case 11: suppressed (warn) session, native 91%% -> urgent fires anyway\n'
cp "$FIXTURES/state-suppressed.state" "${TMPDIR:-/tmp}/claude-context-awareness-${SID}.state"
# Provide the warn transcript for the turn counter; native 91 overrides pct -> urgent (rank > suppressed warn rank).
OUT=$(run_hook "$(ups_native "$SID" 91 "$FIXTURES/transcript-warn-sonnet.jsonl")")
assert_contains "case-11-escalation" "$OUT" "Quality risk HIGH"
cleanup_state "$SID"; printf '\n'

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
