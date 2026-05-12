---
description: Advance the current phasing run to the next pending phase. Renders the post-phase status block, then spawns the next phase. Typing this command is the explicit approval — the post-phase AskUserQuestion menu is bypassed.
---

The user invoked `/phase-next` with arguments: `$ARGUMENTS`

Use the `phasing` skill in **post-phase advance mode**. See `~/.claude/skills/phasing/SKILL.md` → "Slash commands" → "/phase-next" for the full algorithm.

## Behavior

1. **Resolve run-id** (per SKILL.md "Run-id auto-detection"):
   - If `$ARGUMENTS` is a run-id, use it.
   - Otherwise scan `~/Projects/*/.claude/phasing/*/run.json` (skip `archive/`) for `overall_status: in_progress`. If exactly one match, use it. If zero, error: `No in-flight phasing runs. Pass a run-id explicitly or start one with /phase.` If multiple, render the `/phase-list` table and `AskUserQuestion` "Which run?".

2. **Verify the previous phase's handoff exists** (the gate the bypassed menu would have gated):
   - File mode: confirm `<run-dir>/phase-<N>-handoff.md` is present and non-empty.
   - GitHub mode: confirm the phase issue is `CLOSED` AND has a handoff comment (per `references/github-mode-commands.md`).
   - If the most-recent phase is `in_progress` without a handoff, error: `Phase <N> still running. Wait for the handoff to land, or /phase-retry <run-id> <N> if you believe it's dead.` Do NOT mutate state.

3. **Identify the next pending phase.** Read `run.json#phases[]`, find the lowest-`n` entry with `status: pending`. If none, error: `Run complete (<K>/<K> phases done). Use /phase-archive <run-id>.` Do NOT mutate state.

4. **Render the post-phase status block** (SKILL.md "Status block" → Post-phase variant) for the just-completed phase. Lift `What I did` / `Decisions made` / `Open questions / notable` verbatim from its handoff. Show `Phases remaining (K)` with the next phase first, each with the 1-line goal derived from its spec's `## Goal`.

5. **Spawn the next phase**: `scripts/launch-terminal.sh <run-id> <N+1> <project-dir> <phase-name-slug>`. The slug is derived from the phase's `name` field via the slugify rule in SKILL.md "Session naming".

6. **Update `run.json` atomically**: set `phases[N+1].status: in_progress`, write `started_at: <iso-now>`. Atomic write (temp + rename).

7. **One-line confirmation in chat**: `→ Spawned P<N+1> phase-<N+1>-<slug>. Polling for handoff.` If invoked inside the orchestrator session, the existing background poll picks up the new in-progress phase. If invoked elsewhere, exit cleanly — the orchestrator's poll will see the new state on its next tick.

## Approval bypass

The post-phase `AskUserQuestion` menu (Approve / Adjust / Abort) is **NOT** fired by `/phase-next`. Typing the command is the user's explicit approval signal. If the user wants Adjust or Abort, they invoke the relevant alternative (`/phase` to re-plan, `/phase-abort` to stop) or interact with the orchestrator's normal menu from a session that's not running `/phase-next`.

## Errors do not mutate state

Steps 2 and 3's error paths must NOT touch `run.json`, NOT delete files, NOT spawn anything. The command is read-only on failure.
