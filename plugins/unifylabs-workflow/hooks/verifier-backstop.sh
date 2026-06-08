#!/usr/bin/env bash
#
# verifier-backstop.sh — deterministic, no-LLM Stop-hook verifier backstop.
# The non-model half of the M1 verification spine: when an opted-in session
# tries to STOP, this hook re-runs the project's REAL verifier fresh and blocks
# the stop on a live RED (non-zero exit). It NEVER reads a self-written
# results / PASS-FAIL file — only a fresh live re-run counts.
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Authored: 2026-06-02
# License: MIT (per unify-kit LICENSE)
#
# Engagement (DEFAULT-OFF / opt-in; both signals are NON-model-authored):
#   (a) the resolved project root holds a committed .unify-verify.json, AND
#   (b) the session is armed with env UNIFY_VERIFY_BACKSTOP=1.
# If either is missing the hook is a silent consumer-safe no-op (exit 0).
#
# Fail-OPEN everywhere: ANY internal/resolution error, a missing toolchain, no
# git root, an empty resolution with no override, or a stop-retry
# (stop_hook_active=true) all exit 0 (allow the stop). The hook BLOCKS only on a
# live non-zero verifier exit, via a JSON {"decision":"block", ...} on stdout.
#
# Determinism: the trigger + decision path uses NO wall-clock, NO random, NO
# date +%s. The cost/scope gate fingerprints the git tree state (HEAD + a sha of
# `git status --porcelain`), NOT a clock. Wall-clock appears ONLY in the
# optional _hook_log timestamp, never in any trigger/decision branch.
#
# ONE resolver: command resolution delegates to bin/verifier-resolve.mjs, which
# imports the canonical resolveVerifier from
# skills/iterative-review/workflow/lib/verifier-detect.mjs. This hook contains
# NO inline reimplementation of detection (drift-guarded in CI).
#
# CLAUDE_HOOKS_DISABLE: comma-separated list of hook names to disable; this hook is "verifier-backstop".
# CLAUDE_HOOKS_LOG: writable path; if set, append one-line JSON records {ts, hook, decision, matcher, brief}.
# UNIFY_VERIFY_BACKSTOP: arm signal — must be exactly "1" for the hook to engage.
# UNIFY_VERIFY_NODE: optional explicit node binary path (fallback when PATH lookup fails).

set -uo pipefail
IFS=$'\n\t'

readonly _NAME="verifier-backstop"
readonly _MATCHER="*"

# --- Step 1: disable check + fail-OPEN trap --------------------------------
# NOT `set -e` at the top: the ERR trap governs so ANY internal error exits 0
# (allow the stop). The hook only ever BLOCKS via an explicit JSON emission.
trap 'exit 0' ERR

case ",${CLAUDE_HOOKS_DISABLE:-}," in
  *",${_NAME},"*)
    printf '[hook: %s disabled via env]\n' "$_NAME" >&2
    exit 0
    ;;
esac

_hook_log() {
  [[ -z "${CLAUDE_HOOKS_LOG:-}" ]] && return 0
  # Wall-clock is permitted HERE ONLY (an advisory log timestamp) — never in any
  # trigger or decision branch above/below.
  python3 - "$_NAME" "$1" "$_MATCHER" "$2" "$CLAUDE_HOOKS_LOG" <<'PY' 2>/dev/null || true
import json, sys, time
ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
rec = {"ts": ts, "hook": sys.argv[1], "decision": sys.argv[2],
       "matcher": sys.argv[3], "brief": sys.argv[4]}
with open(sys.argv[5], "a") as f:
    f.write(json.dumps(rec) + "\n")
PY
}

# Resolve a node binary: PATH first, then the explicit override, then known
# absolute fallbacks. Echoes the path, or empty if none runs.
_resolve_node() {
  local cand
  for cand in \
    "$(command -v node 2>/dev/null || true)" \
    "${UNIFY_VERIFY_NODE:-}" \
    /opt/homebrew/opt/node@22/bin/node \
    /usr/local/bin/node; do
    [ -n "$cand" ] || continue
    if [ -x "$cand" ] && "$cand" --version >/dev/null 2>&1; then
      printf '%s' "$cand"; return 0
    fi
  done
  return 1
}

# Read a top-level string field from a .unify-verify.json via jq (empty on any
# error / absence). Decision-irrelevant clock-free read.
_cfg_str() { jq -r --arg k "$2" '.[$k] // empty' "$1" 2>/dev/null || true; }

# --- Step 2: read stdin once + loop guard ----------------------------------
_payload="$(cat || true)"

stop_active=$(printf '%s' "$_payload" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")
if [ "$stop_active" = "true" ]; then
  _hook_log allow "$_MATCHER" "stop-hook-active-retry"
  exit 0
fi

session_id=$(printf '%s' "$_payload" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
payload_cwd=$(printf '%s' "$_payload" | jq -r '.cwd // ""' 2>/dev/null || echo "")

# --- Step 5 (resolve the project root first; the engage gate needs it) ------
# Precedence: explicit "workingDir" in a .unify-verify.json discoverable from
# the payload cwd -> git toplevel of the payload cwd -> the payload cwd itself.
# No valid git root AND no explicit dir -> fail-OPEN (never run in the wrong repo).
base_cwd="$payload_cwd"
[ -z "$base_cwd" ] && base_cwd="$PWD"

# A .unify-verify.json may live at the git toplevel; find the toplevel first to
# read an explicit workingDir override.
git_top=""
if command -v git >/dev/null 2>&1; then
  git_top=$(git -C "$base_cwd" rev-parse --show-toplevel 2>/dev/null || true)
fi

# Locate the config to read an explicit workingDir: prefer the git toplevel,
# else the cwd.
cfg_probe=""
if [ -n "$git_top" ] && [ -f "$git_top/.unify-verify.json" ]; then
  cfg_probe="$git_top/.unify-verify.json"
elif [ -f "$base_cwd/.unify-verify.json" ]; then
  cfg_probe="$base_cwd/.unify-verify.json"
fi

explicit_dir=""
if [ -n "$cfg_probe" ]; then
  explicit_dir=$(_cfg_str "$cfg_probe" workingDir)
fi

working_dir=""
if [ -n "$explicit_dir" ] && [ -d "$explicit_dir" ]; then
  working_dir="$explicit_dir"
elif [ -n "$git_top" ] && [ -d "$git_top" ]; then
  working_dir="$git_top"
elif [ -n "$base_cwd" ] && [ -d "$base_cwd" ]; then
  # cwd with no git root AND no explicit dir -> fail-open below (we still need a
  # git root for the fingerprint). Keep base_cwd only if it IS a git work tree.
  if [ -n "$git_top" ]; then working_dir="$base_cwd"; fi
fi

if [ -z "$working_dir" ] || [ ! -d "$working_dir" ]; then
  _hook_log allow "$_MATCHER" "no-working-dir"
  exit 0
fi

# --- Step 3: ENGAGE GATE (both signals required) ---------------------------
# Config must be a committed .unify-verify.json AT the resolved root; arm env
# must be exactly "1". Either missing -> consumer-safe no-op.
config="$working_dir/.unify-verify.json"
if [ ! -f "$config" ]; then
  _hook_log allow "$_MATCHER" "not-engaged-no-config"
  exit 0
fi
if [ "${UNIFY_VERIFY_BACKSTOP:-}" != "1" ]; then
  _hook_log allow "$_MATCHER" "not-engaged-not-armed"
  exit 0
fi

# --- Step 4: COST/SCOPE GATE (deterministic git tree-state fingerprint) -----
# Fingerprint = HEAD commit joined with a sha of the porcelain status. This is a
# SCOPE/STATE signal, NEVER a result. A per-session marker stores ONLY the last
# fingerprint we PASSED on (no verdict). Identical fingerprint -> already covered
# this exact tree -> exit 0 (never re-run on an unchanged tree).
if ! command -v git >/dev/null 2>&1; then
  _hook_log allow "$_MATCHER" "no-git"
  exit 0
fi
_head=$(git -C "$working_dir" rev-parse HEAD 2>/dev/null || echo "no-head")
_porcelain=$(git -C "$working_dir" status --porcelain 2>/dev/null || echo "")
# sha the porcelain (shasum on macOS / sha256sum on linux; either is fine — the
# value is only ever compared to itself within a session).
if command -v shasum >/dev/null 2>&1; then
  _pstat=$(printf '%s' "$_porcelain" | shasum -a 256 2>/dev/null | cut -d' ' -f1)
elif command -v sha256sum >/dev/null 2>&1; then
  _pstat=$(printf '%s' "$_porcelain" | sha256sum 2>/dev/null | cut -d' ' -f1)
else
  _pstat="nosha"
fi
fingerprint="${_head}:${_pstat}"

# Writable state dir for the per-session marker.
state_dir="${TMPDIR:-/tmp}/unify-verify"
mkdir -p "$state_dir" 2>/dev/null || state_dir="${HOME:-/tmp}/.claude/.unify-verify"
mkdir -p "$state_dir" 2>/dev/null || true
marker="${state_dir}/backstop-${session_id}.due"

if [ -f "$marker" ]; then
  last_fp=$(cat "$marker" 2>/dev/null || echo "")
  if [ "$last_fp" = "$fingerprint" ]; then
    _hook_log allow "$_MATCHER" "cost-gate-unchanged-tree"
    exit 0
  fi
fi

# --- Step 6: RESOLVE COMMANDS via the SHARED resolver ----------------------
# bin/verifier-resolve.mjs imports the canonical resolveVerifier and prints
# {"commands":[...]}. Node absent / shim errors / non-zero -> fail-OPEN.
node_bin=""
node_bin=$(_resolve_node || true)
if [ -z "$node_bin" ]; then
  _hook_log allow "$_MATCHER" "no-node"
  exit 0
fi
shim="${CLAUDE_PLUGIN_ROOT:-}/bin/verifier-resolve.mjs"
if [ ! -f "$shim" ]; then
  _hook_log allow "$_MATCHER" "no-shim"
  exit 0
fi

resolved_json=""
resolved_json=$("$node_bin" "$shim" "$working_dir" 2>/dev/null) || {
  _hook_log allow "$_MATCHER" "shim-nonzero"
  exit 0
}

# Build the run list. Precedence:
#   1. a non-empty ".backstopCommands" REPLACES the run list (test-only scope),
#   2. else the resolver's "commands",
#   3. else the config's ".commands" override,
#   4. else empty -> fail-OPEN no-op.
cmds=()
backstop_override=()
while IFS= read -r line; do
  [ -n "$line" ] && backstop_override+=("$line")
done < <(jq -r '(.backstopCommands // []) | .[]?' "$config" 2>/dev/null || true)

if [ "${#backstop_override[@]}" -gt 0 ]; then
  cmds=("${backstop_override[@]}")
else
  resolved_cmds=()
  while IFS= read -r line; do
    [ -n "$line" ] && resolved_cmds+=("$line")
  done < <(printf '%s' "$resolved_json" | jq -r '(.commands // []) | .[]?' 2>/dev/null || true)

  if [ "${#resolved_cmds[@]}" -gt 0 ]; then
    cmds=("${resolved_cmds[@]}")
  else
    config_override=()
    while IFS= read -r line; do
      [ -n "$line" ] && config_override+=("$line")
    done < <(jq -r '(.commands // []) | .[]?' "$config" 2>/dev/null || true)
    if [ "${#config_override[@]}" -gt 0 ]; then
      cmds=("${config_override[@]}")
    fi
  fi
fi

if [ "${#cmds[@]}" -eq 0 ]; then
  _hook_log allow "$_MATCHER" "empty-resolution-no-override"
  exit 0
fi

# --- Step 7: RE-RUN FRESH (pure block, no LLM, no results-file read) -------
# Run each command LIVE in the working dir; capture the LIVE exit code. First
# non-zero = definitive RED -> emit a JSON block on stdout + exit 0. On RED we do
# NOT update the marker. On all-GREEN, store the fingerprint + exit 0.
for cmd in "${cmds[@]}"; do
  rc=0
  ( cd "$working_dir" && bash -c "$cmd" ) >/dev/null 2>&1 || rc=$?
  if [ "$rc" -ne 0 ]; then
    reason="verifier red: ${cmd} failed (exit ${rc}); fix and re-run; the backstop re-runs the real verifier fresh"
    jq -cn --arg r "$reason" '{decision:"block", reason:$r}'
    _hook_log block "$_MATCHER" "red-cmd-exit-${rc}"
    exit 0
  fi
done

# All GREEN: record the fingerprint we passed on (scope hash only, no verdict).
if printf '%s' "$fingerprint" > "${marker}.tmp" 2>/dev/null; then
  mv "${marker}.tmp" "$marker" 2>/dev/null || true
fi
_hook_log allow "$_MATCHER" "all-green"
exit 0
