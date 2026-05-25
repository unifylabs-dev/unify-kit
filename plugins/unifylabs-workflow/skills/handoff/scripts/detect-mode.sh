#!/usr/bin/env bash
#
# detect-mode.sh — emit JSON describing which workflow mode the current session is in
# (design spec §6.1 signal table, §8.5 JSON contract).
#
# Input:  none (reads cwd + selected environment variables).
# Output: JSON object — see references/mode-detection.md §2 for schema.
# Exit:   0 always.

set -euo pipefail
IFS=$'\n\t'

mode="generic"
run_json=""
master_plan=""
phase_spec=""
design_doc_target=""
plan_file=""
gh_issue_number="null"
brainstorm_dir=""

# ---------- 1. phasing-executor (env var, exported by launch-terminal.sh) ----------
# Priority: highest. If the spawning script tagged this session, trust the tag.
if [ "${CLAUDE_PHASE_SESSION:-0}" = "1" ]; then
  mode="phasing-executor"
fi

# ---------- 2. phasing-orchestrator (run.json with in_progress in cwd) ----------
if [ "$mode" = "generic" ] && [ -d .claude/phasing ]; then
  for rj in .claude/phasing/*/run.json; do
    [ -f "$rj" ] || continue
    if jq -e '.overall_status == "in_progress"' "$rj" >/dev/null 2>&1; then
      mode="phasing-orchestrator"
      run_json="$(cd "$(dirname "$rj")" && pwd)/run.json"
      rj_mode=$(jq -r '.mode // ""' "$rj")
      if [ "$rj_mode" = "github" ]; then
        ti=$(jq -r '.tracking_issue // empty' "$rj")
        if [ -n "$ti" ]; then
          gh_issue_number="$ti"
        fi
      else
        mp="$(cd "$(dirname "$rj")" && pwd)/master-plan.md"
        [ -f "$mp" ] && master_plan="$mp"
      fi
      break
    fi
  done
fi

# ---------- 3. brainstorm (.superpowers/brainstorm/<id>/) ----------
if [ "$mode" = "generic" ] && compgen -G ".superpowers/brainstorm/*/" >/dev/null 2>&1; then
  bs=$(ls -dt .superpowers/brainstorm/*/ 2>/dev/null | head -1 || true)
  if [ -n "$bs" ]; then
    mode="brainstorm"
    brainstorm_dir="$(cd "$bs" && pwd)"
  fi
fi

# ---------- 4. plan-exec ----------
# Best-effort: there is currently no reliable runtime signal that the current session
# loaded a ~/.claude/plans/<plan>.md file. Falls through to generic when not detected.
# (Documented limitation; mirrors the env-var caveat for executor mode.)

# ---------- 5. work-issue (.claude/work-issue/ state) ----------
if [ "$mode" = "generic" ] && [ -d .claude/work-issue ]; then
  if [ -n "$(ls -A .claude/work-issue 2>/dev/null || true)" ]; then
    mode="work-issue"
  fi
fi

# ---------- Emit JSON ----------
jq -n \
  --arg mode "$mode" \
  --arg run_json "$run_json" \
  --arg master_plan "$master_plan" \
  --arg phase_spec "$phase_spec" \
  --arg design_doc_target "$design_doc_target" \
  --arg plan_file "$plan_file" \
  --arg brainstorm_dir "$brainstorm_dir" \
  --argjson gh_issue_number "$gh_issue_number" \
  '{
    mode: $mode,
    secondary_modes: [],
    paths: {
      run_json:          (if $run_json          == "" then null else $run_json          end),
      master_plan:       (if $master_plan       == "" then null else $master_plan       end),
      phase_spec:        (if $phase_spec        == "" then null else $phase_spec        end),
      design_doc_target: (if $design_doc_target == "" then null else $design_doc_target end),
      plan_file:         (if $plan_file         == "" then null else $plan_file         end),
      gh_issue_number:   $gh_issue_number,
      brainstorm_dir:    (if $brainstorm_dir    == "" then null else $brainstorm_dir    end)
    }
  }'
