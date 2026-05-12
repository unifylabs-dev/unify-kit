---
description: Render the current status block for a phasing run on demand. Read-only — does not mutate run.json, does not spawn anything, does not poll. Useful for "where am I?" check-ins from any terminal.
---

The user invoked `/phase-status` with arguments: `$ARGUMENTS`

Use the `phasing` skill in **render-only mode**. See `~/.claude/skills/phasing/SKILL.md` → "Status block" and "Slash commands" → "/phase-status" for the full algorithm.

## Behavior

1. **Resolve run-id** (per SKILL.md "Run-id auto-detection"):
   - If `$ARGUMENTS` is a run-id, use it.
   - Otherwise scan `~/Projects/*/.claude/phasing/*/run.json` (skip `archive/`) for `overall_status: in_progress`. If exactly one, use it. If zero, error. If multiple, render the `/phase-list` table and `AskUserQuestion` "Which run?".

2. **Determine the variant to render** from `run.json`:
   - `overall_status: complete` → **Run-end** variant.
   - `overall_status: aborted` → **Aborted** variant.
   - Any phase `in_progress` → **Resume** variant (header `## Resumed — …`, "wait or take over" next action with elapsed time).
   - At least one phase `complete`, none `in_progress`, more pending → **Post-phase** variant (header `## Phase <N> complete — …` using the most-recent completed phase).
   - No phases started → **Run-start** variant.

3. **Render the block per SKILL.md "Status block"**. Lift `What I did` / `Decisions made` / `Open questions / notable` from the relevant handoff (the most-recent completed phase's, for post-phase/resume; aggregated across all phases for run-end). Derive `Phases remaining` from `run.json` + each upcoming spec's `## Goal`. Use the `session_name` derivation rule if any `session_name` fields are missing in `run.json`.

4. **No mutation.** Do NOT:
   - Write `run.json`.
   - Spawn any terminal or `/phase-execute` session.
   - Start a background poll.
   - Fire any `AskUserQuestion` other than the run-id disambiguation in step 1.

## Use cases

- "Where am I in run X?" — quick check-in from any terminal.
- Status reports — copy the rendered block into a Slack/issue update.
- Sanity check before invoking `/phase-next` / `/phase-retry` / `/phase-abort`.
- After a `/phase-resume` — confirm the orchestrator's view matches expectations.

## Multiple in-flight runs

When auto-detection finds more than one in-flight run, step 1 falls through to the `/phase-list`-style table + `AskUserQuestion`. Do NOT silently pick one; ambiguity is the user's call.
