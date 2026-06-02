#!/usr/bin/env bash
#
# test-verifier-backstop.sh — fixture-driven ENFORCEMENT harness for
# hooks/verifier-backstop.sh, the deterministic no-LLM half of the M1
# verification spine (an ADDITIVE Stop hook).
#
# House idiom mirrors test-context-awareness.sh / test-security-hooks.sh:
# jq-built stdin payloads, per-case mktemp isolation + a unique session_id,
# PASS/FAIL tally, exit 1 on any fail. The engaged fixtures are templates under
# fixtures/backstop-{green,red,empty,override}/; the harness COPIES each into a
# fresh mktemp -d, `git init`s + commits it (so the hook's git tree-state
# fingerprint works), and arms the session via env UNIFY_VERIFY_BACKSTOP=1.
#
# Cases (each early-exit / block is the hook's REAL signal, never a prose claim):
#   a. GREEN engaged                 -> exit 0, no decision:block
#   b. RED engaged                   -> exit 0 + stdout has "decision":"block"
#                                       and the failing command in the reason
#                                       [THE load-bearing assertion]
#   c. RED engaged + stop_hook_active=true -> exit 0, no block (loop guard)
#   d. empty-resolution engaged, no override -> exit 0, no block (fail-open no-op)
#   e. override w/ failing command (empty resolveVerifier) -> exit 0 + block
#   f. NOT engaged over the RED fixture -> exit 0, no block (consumer-safe off)
#   g. marker cost-gate: GREEN twice on an unchanged tree -> 2nd run does NOT
#      re-exec the verifier (asserted via a sentinel the GREEN command touches)
#
# RED-CAPABLE ("gate-the-gate", like P0/P4): point UNIFY_BACKSTOP_HOOK at an
# always-exit-0 stub and cases (b) and (e) MUST fail — that proves the block
# assertions bind to real hook behavior, not a vacuous pass. Default target is
# the real hook one level up.
#
# Toolchain: node (resolver shim), git (fingerprint + fixture repos), jq
# (payloads + assertions). PATH is augmented with the known node@22 dir so a
# bare-`node`-less macOS still resolves the shim; the hook itself also honors
# UNIFY_VERIFY_NODE. The harness preflights git + jq + node and aborts loudly
# if any is missing (a missing tool would make the fail-open no-op look like a
# real pass).

set -uo pipefail
IFS=$'\n\t'

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES="$(cd "$(dirname "$0")/fixtures" && pwd)"

# Default target is the real hook; the gate-the-gate stub overrides via env.
HOOK="${UNIFY_BACKSTOP_HOOK:-$HOOK_DIR/verifier-backstop.sh}"

# The hook resolves siblings + the shim via ${CLAUDE_PLUGIN_ROOT}.
export CLAUDE_PLUGIN_ROOT="$(cd "$HOOK_DIR/.." && pwd)"

# Resolve a WORKING node for the resolver shim. On a bare-node-less macOS,
# `node` may be absent from PATH or (this machine's case) a broken Cellar
# symlink whose `--version` aborts on a missing icu4c lib — so we probe each
# candidate with `--version` and keep the first that actually runs, then prepend
# its dir to PATH and hand the hook the same explicit path via UNIFY_VERIFY_NODE.
# CI's actions/setup-node puts a clean `node` first, which the PATH probe picks.
_node_ok() { [ -x "$1" ] && "$1" --version >/dev/null 2>&1; }
UNIFY_VERIFY_NODE=""
for _ncand in \
  "$(command -v node 2>/dev/null || true)" \
  /opt/homebrew/opt/node@22/bin/node \
  /usr/local/bin/node \
  /opt/homebrew/bin/node; do
  [ -n "$_ncand" ] || continue
  if _node_ok "$_ncand"; then UNIFY_VERIFY_NODE="$_ncand"; break; fi
done
if [ -n "$UNIFY_VERIFY_NODE" ]; then
  PATH="$(dirname "$UNIFY_VERIFY_NODE"):$PATH"
  export PATH UNIFY_VERIFY_NODE
fi

# Per-session backstop marker state lives under a writable dir; isolate it to a
# harness-private HOME so reruns + the real consumer state never collide.
STATE_HOME="$(mktemp -d)"
export HOME="$STATE_HOME"
mkdir -p "$HOME/.claude"

PASS=0
FAIL=0
FAILURES=()

# ---------------------------------------------------------------------------
# Assertion helpers.
# ---------------------------------------------------------------------------
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1)); printf '  PASS  %s (== %q)\n' "$label" "$expected"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("$label: expected $expected got $actual")
    printf '  FAIL  %s expected %q got %q\n' "$label" "$expected" "$actual" >&2
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if printf '%s' "$haystack" | grep -qF -- "$needle"; then
    PASS=$((PASS + 1)); printf '  PASS  %s contains %q\n' "$label" "$needle"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("$label: missing substring: $needle")
    printf '  FAIL  %s did NOT contain %q\n' "$label" "$needle" >&2
    printf '         actual: %s\n' "$haystack" >&2
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if printf '%s' "$haystack" | grep -qF -- "$needle"; then
    FAIL=$((FAIL + 1)); FAILURES+=("$label: unexpected substring: $needle")
    printf '  FAIL  %s unexpectedly contained %q\n' "$label" "$needle" >&2
    printf '         actual: %s\n' "$haystack" >&2
  else
    PASS=$((PASS + 1)); printf '  PASS  %s does not contain %q\n' "$label" "$needle"
  fi
}

# ---------------------------------------------------------------------------
# Preflight: git/jq/node are required. Without them the hook fails-OPEN, and a
# no-op would masquerade as a real pass.
# ---------------------------------------------------------------------------
PREFLIGHT_OK=1
for tool in git jq; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'PREFLIGHT FAIL: %s not on PATH.\n' "$tool" >&2; PREFLIGHT_OK=0; }
done
if [ -z "${UNIFY_VERIFY_NODE:-}" ] || ! "$UNIFY_VERIFY_NODE" --version >/dev/null 2>&1; then
  printf 'PREFLIGHT FAIL: node not resolvable (the resolver shim needs it).\n' >&2
  PREFLIGHT_OK=0
fi
if [ "$PREFLIGHT_OK" -ne 1 ]; then
  printf 'Aborting before any case ran — fix the toolchain, then re-run.\n' >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Fixture repo builder: copy a template fixture into a fresh git repo so the
# hook's "git rev-parse HEAD" + "git status --porcelain" fingerprint resolves.
# Echoes the repo path on stdout.
# ---------------------------------------------------------------------------
make_repo() {
  local fixture="$1"
  local repo; repo="$(mktemp -d)"
  cp -R "$FIXTURES/$fixture/." "$repo/"
  git -C "$repo" init -q
  git -C "$repo" config user.email harness@example.com
  git -C "$repo" config user.name harness
  git -C "$repo" add -A
  git -C "$repo" commit -q -m "fixture" >/dev/null 2>&1
  printf '%s' "$repo"
}

# stop_payload <repo> <session_id> [stop_hook_active]
stop_payload() {
  local cwd="$1" sid="$2" active="${3:-false}"
  jq -n --arg cwd "$cwd" --arg sid "$sid" --argjson active "$active" \
    '{hook_event_name:"Stop", session_id:$sid, cwd:$cwd, stop_hook_active:$active, transcript_path:""}'
}

# run_backstop <payload> [extra env=val ...] -> sets _OUT, _RC
_OUT=""
_RC=0
run_backstop() {
  local payload="$1"; shift
  _OUT="$(printf '%s' "$payload" | env "$@" bash "$HOOK" 2>/dev/null)"
  _RC=$?
}

printf 'Running test-verifier-backstop.sh\n'
printf 'HOOK: %s\n' "$HOOK"
printf 'FIXTURES: %s\n\n' "$FIXTURES"

# ===========================================================================
# Case a: GREEN engaged -> exit 0, no decision:block
# ===========================================================================
printf 'Case a: GREEN engaged -> exit 0, no block\n'
REPO_A="$(make_repo backstop-green)"
SENTINEL_A="$(mktemp)"; : > "$SENTINEL_A"
run_backstop "$(stop_payload "$REPO_A" "sess-a")" \
  UNIFY_VERIFY_BACKSTOP=1 "BACKSTOP_SENTINEL=$SENTINEL_A"
assert_eq        "case-a-green-exit0"  "0" "$_RC"
assert_not_contains "case-a-green-noblock" "$_OUT" '"decision":"block"'
printf '\n'

# ===========================================================================
# Case b: RED engaged -> exit 0 + decision:block naming the failing command
# (THE load-bearing assertion)
# ===========================================================================
printf 'Case b: RED engaged -> exit 0 + decision:block + failing command in reason\n'
REPO_B="$(make_repo backstop-red)"
run_backstop "$(stop_payload "$REPO_B" "sess-b")" UNIFY_VERIFY_BACKSTOP=1
assert_eq        "case-b-red-exit0"     "0" "$_RC"
assert_contains  "case-b-red-block"     "$_OUT" '"decision":"block"'
assert_contains  "case-b-red-cmd-in-reason" "$_OUT" 'echo backstop-red-marker && exit 7'
printf '\n'

# ===========================================================================
# Case c: RED engaged + stop_hook_active=true -> exit 0, no block (loop guard)
# ===========================================================================
printf 'Case c: RED engaged + stop_hook_active=true -> exit 0, no block\n'
REPO_C="$(make_repo backstop-red)"
run_backstop "$(stop_payload "$REPO_C" "sess-c" true)" UNIFY_VERIFY_BACKSTOP=1
assert_eq           "case-c-loopguard-exit0" "0" "$_RC"
assert_not_contains "case-c-loopguard-noblock" "$_OUT" '"decision":"block"'
printf '\n'

# ===========================================================================
# Case d: empty-resolution engaged, no override -> exit 0, no block (no-op)
# ===========================================================================
printf 'Case d: empty-resolution engaged, no override -> exit 0, no block\n'
REPO_D="$(make_repo backstop-empty)"
run_backstop "$(stop_payload "$REPO_D" "sess-d")" UNIFY_VERIFY_BACKSTOP=1
assert_eq           "case-d-empty-exit0" "0" "$_RC"
assert_not_contains "case-d-empty-noblock" "$_OUT" '"decision":"block"'
printf '\n'

# ===========================================================================
# Case e: override w/ failing command (empty resolveVerifier) -> exit 0 + block
# ===========================================================================
printf 'Case e: override failing command (empty resolver) -> exit 0 + block\n'
REPO_E="$(make_repo backstop-override)"
run_backstop "$(stop_payload "$REPO_E" "sess-e")" UNIFY_VERIFY_BACKSTOP=1
assert_eq        "case-e-override-exit0" "0" "$_RC"
assert_contains  "case-e-override-block" "$_OUT" '"decision":"block"'
assert_contains  "case-e-override-cmd-in-reason" "$_OUT" 'echo backstop-override-marker && exit 9'
printf '\n'

# ===========================================================================
# Case f: NOT engaged (no UNIFY_VERIFY_BACKSTOP) over RED fixture -> no block
# ===========================================================================
printf 'Case f: NOT engaged over RED fixture -> exit 0, no block\n'
REPO_F="$(make_repo backstop-red)"
# UNIFY_VERIFY_BACKSTOP intentionally unset on the hook invocation.
run_backstop "$(stop_payload "$REPO_F" "sess-f")" UNIFY_VERIFY_BACKSTOP=
assert_eq           "case-f-off-exit0" "0" "$_RC"
assert_not_contains "case-f-off-noblock" "$_OUT" '"decision":"block"'
printf '\n'

# ===========================================================================
# Case g: marker cost-gate — GREEN twice on an unchanged tree -> 2nd run does
# NOT re-exec the verifier (sentinel line count stays 1).
# ===========================================================================
printf 'Case g: marker cost-gate — GREEN twice, 2nd run skips re-exec\n'
REPO_G="$(make_repo backstop-green)"
SENTINEL_G="$(mktemp)"; : > "$SENTINEL_G"
run_backstop "$(stop_payload "$REPO_G" "sess-g")" \
  UNIFY_VERIFY_BACKSTOP=1 "BACKSTOP_SENTINEL=$SENTINEL_G"
assert_eq "case-g-first-exit0" "0" "$_RC"
# grep -c prints the count AND exits 1 on no match; `|| true` keeps a clean
# single-line "0" rather than appending a fallback echo (which would double it).
N1=$(grep -cF 'green-ran' "$SENTINEL_G" 2>/dev/null || true)
assert_eq "case-g-first-ran-once" "1" "$N1"
# 2nd run on the SAME (unchanged) tree + SAME session_id: marker matches -> skip.
run_backstop "$(stop_payload "$REPO_G" "sess-g")" \
  UNIFY_VERIFY_BACKSTOP=1 "BACKSTOP_SENTINEL=$SENTINEL_G"
assert_eq "case-g-second-exit0" "0" "$_RC"
N2=$(grep -cF 'green-ran' "$SENTINEL_G" 2>/dev/null || true)
assert_eq "case-g-second-no-reexec" "1" "$N2"
printf '\n'

# ---------------------------------------------------------------------------
# Summary.
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
printf '=====================================\n'
printf 'Total: %d  Pass: %d  Fail: %d\n' "$TOTAL" "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '\nFailures:\n'
  for f in "${FAILURES[@]}"; do printf '  - %s\n' "$f"; done
  exit 1
fi
printf 'all PASS\n'
exit 0
