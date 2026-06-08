#!/usr/bin/env bash
#
# test-security-hooks.sh — Tier-1 security/integrity hook ENFORCEMENT harness.
#
# Drives the SEVEN VERBATIM security hooks (never a reimplementation) with the
# real hook-event JSON envelope a Workflow-spawned agent's tool call produces,
# and asserts each hook's REAL enforcement signal:
#   - exit 2  = BLOCK   (PreToolUse/PostToolUse deny; SessionStart hard-stop)
#   - exit 0  = ALLOW
#   - advisory hook (marketplace-drift-check): FIRES a stderr warning, exit 0.
#
# House idiom mirrors test-context-awareness.sh: PASS/FAIL tally, printf|grep
# assertion helpers, per-case TMPDIR isolation, exit 1 on any fail.
#
# RED-CAPABLE ("gate-the-gate", like P0): set HARNESS_SELFTEST_RED=1 to invert
# every expectation. If the harness is wired correctly it MUST then fail — that
# proves the assertions actually bind to real hook behavior rather than passing
# vacuously. CI runs the harness twice: once normal (must pass), once RED (must
# fail). See the loop-harness sibling job in plugin-install-fixture.yml.
#
# Hooks covered (event · block-case → exit · allow/fire-case → exit):
#   file-guard.sh            PreToolUse Edit|Write   .env→2          README.md→0
#   dangerous-actions-blocker.sh PreToolUse Bash     rm -rf /→2      ls -la→0
#   pre-commit-secrets.sh    PreToolUse Bash(commit) staged secret→2 clean→0
#   output-secrets-scanner.sh PostToolUse *          secret payload→2 clean→0
#   claudemd-scanner.sh      SessionStart            bidi CLAUDE.md→2 clean→0
#                                                    (+ warn-only injection→0)
#   mcp-config-integrity.sh  SessionStart            mutated .mcp.json→2 same→0
#   marketplace-drift-check.sh SessionStart ADVISORY drift WARNS+exit0 / allowlisted silent+exit0
#
# Secret/bidi literal handling: every planted AWS-key / bidi-override literal is
# constructed at RUNTIME by concatenating split prefixes (mirroring the hooks'
# own `'AKI''A...'` idiom) or written via UTF-8 escape bytes. The SOURCE BYTES
# of this file therefore never contain a contiguous AWS-key shape, an
# Anthropic-key prefix, or a raw bidi mark, so the kit's scrub-check
# forbidden-strings scan (spec 09 §2 patterns, which DOES
# include plugins/**) stays green. The harness also never echoes a planted
# secret to stdout/stderr — the live PostToolUse output-secrets-scanner in a
# Claude session would otherwise (correctly) block the harness's own output.

set -euo pipefail
IFS=$'\n\t'

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES="$(cd "$(dirname "$0")/fixtures/security" && pwd)"

# Hooks resolve helpers via ${CLAUDE_PLUGIN_ROOT}; set it so any subshell can find siblings.
export CLAUDE_PLUGIN_ROOT="$(cd "$HOOK_DIR/.." && pwd)"

# RED self-test: invert every expectation so a correctly-wired harness FAILS.
RED="${HARNESS_SELFTEST_RED:-0}"

PASS=0
FAIL=0
FAILURES=()

# Construct planted secret bytes at RUNTIME — never as a contiguous source literal.
# AWS access-key shape the secret-scanners match: AKIA followed by 16 [0-9A-Z].
_aws_key() { printf '%s%s' "$(printf 'AKI'; printf 'A')" 'IOSFODNN7EXAMPLE1'; }

# ---------------------------------------------------------------------------
# Assertion helpers. Each captures rc WITHOUT aborting under set -e
# (set +e around the hook invocation, then restore). Stderr is captured to a
# per-call temp file and matched with grep -F; we never print planted secrets.
# ---------------------------------------------------------------------------

# run_hook <hook-path> <stdin-payload> [extra env assignments...] -> sets RC, ERRFILE
_RC=0
_ERRFILE=""
run_hook() {
  local hook="$1" payload="$2"; shift 2
  _ERRFILE="$(mktemp)"
  set +e
  if [ "$#" -gt 0 ]; then
    printf '%s' "$payload" | env "$@" bash "$hook" >/dev/null 2>"$_ERRFILE"
  else
    printf '%s' "$payload" | bash "$hook" >/dev/null 2>"$_ERRFILE"
  fi
  _RC=$?
  set -e
}

# run_hook_in <cwd> <hook-path> <stdin-payload> [extra env...] — for hooks that
# scan the working directory (claudemd-scanner, mcp-config-integrity).
run_hook_in() {
  local dir="$1" hook="$2" payload="$3"; shift 3
  _ERRFILE="$(mktemp)"
  set +e
  if [ "$#" -gt 0 ]; then
    ( cd "$dir" && printf '%s' "$payload" | env "$@" bash "$hook" >/dev/null 2>"$_ERRFILE" )
  else
    ( cd "$dir" && printf '%s' "$payload" | bash "$hook" >/dev/null 2>"$_ERRFILE" )
  fi
  _RC=$?
  set -e
}

# assert_blocks <label> <reason-substring> — expects RC==2 AND stderr matches reason.
# Under RED, expectation inverts: we PASS only if it did NOT block cleanly.
assert_blocks() {
  local label="$1" reason="$2"
  local ok=0
  if [ "$_RC" -eq 2 ] && grep -qF -- "$reason" "$_ERRFILE"; then ok=1; fi
  _record "$label (block: rc==2 & stderr~'$reason')" "$ok"
  rm -f "$_ERRFILE"
}

# assert_allows <label> — expects RC==0.
assert_allows() {
  local label="$1"
  local ok=0
  if [ "$_RC" -eq 0 ]; then ok=1; fi
  _record "$label (allow: rc==0)" "$ok"
  rm -f "$_ERRFILE"
}

# assert_fires <label> <substring> — expects RC==0 AND stderr CONTAINS substring
# (the advisory hook: it cannot block, it WARNS). Used for marketplace-drift.
assert_fires() {
  local label="$1" needle="$2"
  local ok=0
  if [ "$_RC" -eq 0 ] && grep -qF -- "$needle" "$_ERRFILE"; then ok=1; fi
  _record "$label (fires: rc==0 & stderr~'$needle')" "$ok"
  rm -f "$_ERRFILE"
}

# assert_silent_allow <label> — expects RC==0 AND no stderr output at all.
assert_silent_allow() {
  local label="$1"
  local ok=0
  if [ "$_RC" -eq 0 ] && [ ! -s "$_ERRFILE" ]; then ok=1; fi
  _record "$label (silent-allow: rc==0 & empty stderr)" "$ok"
  rm -f "$_ERRFILE"
}

# _record <label> <ok 0|1> — applies RED inversion + tallies.
_record() {
  local label="$1" ok="$2"
  if [ "$RED" = "1" ]; then
    # invert: a correct harness expectation becomes a deliberate failure
    if [ "$ok" = "1" ]; then ok=0; else ok=1; fi
  fi
  if [ "$ok" = "1" ]; then
    PASS=$((PASS + 1))
    printf '  PASS  %s\n' "$label"
  else
    FAIL=$((FAIL + 1))
    FAILURES+=("$label")
    printf '  FAIL  %s (rc=%s)\n' "$label" "$_RC" >&2
  fi
}

# ---------------------------------------------------------------------------
# Preflight: file-guard / dangerous-actions-blocker / the secret-scanners
# fail-CLOSED (exit 2) when python3 or git is absent. The ALLOW cases below
# would then surface a spurious exit-2 and the harness would fail loudly —
# so check up front and explain, rather than letting a missing dep look like
# a real hook regression.
# ---------------------------------------------------------------------------
PREFLIGHT_OK=1
if ! command -v python3 >/dev/null 2>&1; then
  printf 'PREFLIGHT FAIL: python3 not on PATH. file-guard / dangerous-actions /\n' >&2
  printf '  output-secrets-scanner parse the JSON envelope with python3 and\n' >&2
  printf '  fail-CLOSED (exit 2) without it — every ALLOW case would falsely\n' >&2
  printf '  look like a block. Install python3 (CI ubuntu-latest ships it).\n' >&2
  PREFLIGHT_OK=0
fi
if ! command -v git >/dev/null 2>&1; then
  printf 'PREFLIGHT FAIL: git not on PATH. pre-commit-secrets fail-CLOSEs (exit 2)\n' >&2
  printf '  without git, and the temp-repo cases cannot be staged.\n' >&2
  PREFLIGHT_OK=0
fi
if [ "$PREFLIGHT_OK" -ne 1 ]; then
  printf 'Aborting before any case ran — fix the toolchain, then re-run.\n' >&2
  exit 1
fi

if [ "$RED" = "1" ]; then
  printf 'Running test-security-hooks.sh [RED SELF-TEST — expects overall FAIL]\n'
else
  printf 'Running test-security-hooks.sh\n'
fi
printf 'HOOK_DIR: %s\n' "$HOOK_DIR"
printf 'FIXTURES: %s\n\n' "$FIXTURES"

# ===========================================================================
# 1. file-guard.sh  (PreToolUse, matcher Edit|Write)
# ===========================================================================
printf '1. file-guard.sh (PreToolUse Edit|Write)\n'
GUARD_DIR="$(mktemp -d)"
run_hook "$HOOK_DIR/file-guard.sh" \
  "$(jq -n --arg p "$GUARD_DIR/.env" '{tool_name:"Edit",tool_input:{file_path:$p}}')"
assert_blocks "file-guard .env" "blocked"
run_hook "$HOOK_DIR/file-guard.sh" \
  "$(jq -n --arg p "$GUARD_DIR/README.md" '{tool_name:"Edit",tool_input:{file_path:$p}}')"
assert_allows "file-guard README.md"
rm -rf "$GUARD_DIR"
printf '\n'

# ===========================================================================
# 2. dangerous-actions-blocker.sh  (PreToolUse, matcher Bash)
# ===========================================================================
printf '2. dangerous-actions-blocker.sh (PreToolUse Bash)\n'
run_hook "$HOOK_DIR/dangerous-actions-blocker.sh" \
  "$(jq -n '{tool_name:"Bash",tool_input:{command:"rm -rf /"}}')"
assert_blocks "dangerous-actions rm -rf /" "blocked"
run_hook "$HOOK_DIR/dangerous-actions-blocker.sh" \
  "$(jq -n '{tool_name:"Bash",tool_input:{command:"ls -la"}}')"
assert_allows "dangerous-actions ls -la"
printf '\n'

# ===========================================================================
# 3. pre-commit-secrets.sh  (PreToolUse, matcher Bash(git commit:*))
#    Real git repo + staged diff; the hook runs `git diff --cached` in cwd.
# ===========================================================================
printf '3. pre-commit-secrets.sh (PreToolUse Bash(git commit:*))\n'
COMMIT_ENV="$(jq -n '{tool_name:"Bash",tool_input:{command:"git commit -m x"}}')"

# BLOCK: stage a file whose added line carries the planted (runtime-built) AWS key.
SECRET_REPO="$(mktemp -d)"
( cd "$SECRET_REPO" && git init -q && git config user.email t@example.test && git config user.name tester )
printf 'aws_access_key_id = %s\n' "$(_aws_key)" > "$SECRET_REPO/app-config.txt"
( cd "$SECRET_REPO" && git add app-config.txt )
run_hook_in "$SECRET_REPO" "$HOOK_DIR/pre-commit-secrets.sh" "$COMMIT_ENV"
assert_blocks "pre-commit staged AWS key" "secret-pattern"
rm -rf "$SECRET_REPO"

# ALLOW: clean staged diff, no secret.
CLEAN_REPO="$(mktemp -d)"
( cd "$CLEAN_REPO" && git init -q && git config user.email t@example.test && git config user.name tester )
printf 'feature_flag = enabled\njust ordinary config\n' > "$CLEAN_REPO/app-config.txt"
( cd "$CLEAN_REPO" && git add app-config.txt )
run_hook_in "$CLEAN_REPO" "$HOOK_DIR/pre-commit-secrets.sh" "$COMMIT_ENV"
assert_allows "pre-commit clean staged diff"
rm -rf "$CLEAN_REPO"
printf '\n'

# ===========================================================================
# 4. output-secrets-scanner.sh  (PostToolUse, matcher *)
#    Substring-scans the whole envelope; planted secret lives in the payload.
# ===========================================================================
printf '4. output-secrets-scanner.sh (PostToolUse *)\n'
# BLOCK: PostToolUse envelope whose tool_response string carries the planted key.
DIRTY_PAYLOAD="$(jq -n \
  --arg out "command output:\nregion=us-east-1\nkey=$(_aws_key)\ndone" \
  '{hook_event_name:"PostToolUse",tool_name:"Bash",tool_input:{command:"cat creds"},tool_response:{stdout:$out}}')"
run_hook "$HOOK_DIR/output-secrets-scanner.sh" "$DIRTY_PAYLOAD"
assert_blocks "output-secrets planted key in payload" "secret-pattern"

# ALLOW: clean tool output.
CLEAN_PAYLOAD="$(jq -n \
  '{hook_event_name:"PostToolUse",tool_name:"Bash",tool_input:{command:"echo hi"},tool_response:{stdout:"hello world\nall good, nothing secret"}}')"
run_hook "$HOOK_DIR/output-secrets-scanner.sh" "$CLEAN_PAYLOAD"
assert_allows "output-secrets clean payload"
printf '\n'

# ===========================================================================
# 5. claudemd-scanner.sh  (SessionStart, matcher *)
#    Scans CLAUDE.md files under cwd. Bidi-override = hard block (exit 2);
#    injection phrases = warn-only (exit 0).
# ===========================================================================
printf '5. claudemd-scanner.sh (SessionStart)\n'
ss_input() { jq -n --arg cwd "$1" '{hook_event_name:"SessionStart",session_id:"sec-test",cwd:$cwd,source:"startup",model:"claude-opus-4-8[1m]"}'; }

# BLOCK: temp dir whose CLAUDE.md carries a U+202E bidi-override (from fixture).
BIDI_DIR="$(mktemp -d)"
cp "$FIXTURES/claude-md-bidi.md" "$BIDI_DIR/CLAUDE.md"
run_hook_in "$BIDI_DIR" "$HOOK_DIR/claudemd-scanner.sh" "$(ss_input "$BIDI_DIR")"
assert_blocks "claudemd bidi-override" "BLOCKING"
rm -rf "$BIDI_DIR"

# ALLOW: clean CLAUDE.md.
CLEAN_DIR="$(mktemp -d)"
cp "$FIXTURES/claude-md-clean.md" "$CLEAN_DIR/CLAUDE.md"
run_hook_in "$CLEAN_DIR" "$HOOK_DIR/claudemd-scanner.sh" "$(ss_input "$CLEAN_DIR")"
assert_silent_allow "claudemd clean"
rm -rf "$CLEAN_DIR"

# WARN-ONLY: injection phrase warns on stderr but still exits 0.
WARN_DIR="$(mktemp -d)"
cp "$FIXTURES/claude-md-warn.md" "$WARN_DIR/CLAUDE.md"
run_hook_in "$WARN_DIR" "$HOOK_DIR/claudemd-scanner.sh" "$(ss_input "$WARN_DIR")"
assert_fires "claudemd injection warn-only (non-blocking)" "warning"
rm -rf "$WARN_DIR"
printf '\n'

# ===========================================================================
# 6. mcp-config-integrity.sh  (SessionStart, matcher *)
#    HOME override isolates the real ~/.claude/.mcp-hashes baseline store.
#    First run records baseline (exit 0); unchanged re-run allows (exit 0);
#    mutated .mcp.json drifts (exit 2).
# ===========================================================================
printf '6. mcp-config-integrity.sh (SessionStart)\n'
MCP_HOME="$(mktemp -d)"
MCP_PROJ="$(mktemp -d)"
cp "$FIXTURES/mcp-baseline.json" "$MCP_PROJ/.mcp.json"
MCP_INPUT="$(jq -n --arg cwd "$MCP_PROJ" '{hook_event_name:"SessionStart",session_id:"sec-test",cwd:$cwd,source:"startup"}')"

# First run: records baseline -> allow.
run_hook_in "$MCP_PROJ" "$HOOK_DIR/mcp-config-integrity.sh" "$MCP_INPUT" "HOME=$MCP_HOME"
assert_allows "mcp-integrity first-run baseline"

# Unchanged re-run -> allow.
run_hook_in "$MCP_PROJ" "$HOOK_DIR/mcp-config-integrity.sh" "$MCP_INPUT" "HOME=$MCP_HOME"
assert_allows "mcp-integrity unchanged"

# Mutate the config -> drift -> block.
cp "$FIXTURES/mcp-mutated.json" "$MCP_PROJ/.mcp.json"
run_hook_in "$MCP_PROJ" "$HOOK_DIR/mcp-config-integrity.sh" "$MCP_INPUT" "HOME=$MCP_HOME"
assert_blocks "mcp-integrity drift after mutation" "integrity changed"
rm -rf "$MCP_HOME" "$MCP_PROJ"
printf '\n'

# ===========================================================================
# 7. marketplace-drift-check.sh  (SessionStart, ADVISORY — NEVER BLOCKS)
#    This hook cannot block (exit 0 always). We assert it FIRES its warning
#    when an unmanaged (non-symlink) ~/.claude/skills/<x>/SKILL.md exists, and
#    stays silent when that skill is allowlisted. HOME override isolates the
#    real ~/.claude/skills tree.
# ===========================================================================
printf '7. marketplace-drift-check.sh (SessionStart, ADVISORY/fire-not-block)\n'
MKT_INPUT="$(jq -n '{hook_event_name:"SessionStart",session_id:"sec-test",source:"startup"}')"

# FIRE: a real (non-symlink) skill dir with a SKILL.md, not allowlisted -> warns, exit 0.
MKT_HOME="$(mktemp -d)"
mkdir -p "$MKT_HOME/.claude/skills/drifted-local-skill"
printf 'name: drifted-local-skill\ndescription: a skill that never got promoted\n' \
  > "$MKT_HOME/.claude/skills/drifted-local-skill/SKILL.md"
run_hook "$HOOK_DIR/marketplace-drift-check.sh" "$MKT_INPUT" "HOME=$MKT_HOME"
assert_fires "marketplace drift warns (advisory)" "exists locally but not in marketplace"

# ALLOW (no drift signal): same skill, now allowlisted -> silent, exit 0.
printf 'drifted-local-skill\n' > "$MKT_HOME/.claude/.personal-skills"
run_hook "$HOOK_DIR/marketplace-drift-check.sh" "$MKT_INPUT" "HOME=$MKT_HOME"
assert_silent_allow "marketplace allowlisted (no warning)"
rm -rf "$MKT_HOME"
printf '\n'

# ===========================================================================
# Summary
# ===========================================================================
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
