---
description: List all in-flight phasing runs on this machine in a compact table. Scans local run.json files under ~/Projects/. No GitHub API calls. Read-only.
---

The user invoked `/phase-list` with arguments: `$ARGUMENTS`

`$ARGUMENTS` is ignored — this command takes no arguments.

Use the `phasing` skill in **enumerate mode**. See `~/.claude/skills/phasing/SKILL.md` → "Slash commands" → "/phase-list" for the full algorithm.

## Behavior

1. **Scan** `~/Projects/*/.claude/phasing/*/run.json` for files where `overall_status == "in_progress"`. Skip any path containing `/archive/`.

2. **For each match**, parse:
   - `run_id`
   - `mode` (`github` or `file`)
   - `task_description` (truncate to ~50 chars for the table)
   - **Progress**: count `phases[]` entries with `status: complete` vs total → render as `<complete>/<total>`.
   - **Last activity**: max of any phase's `completed_at` / `started_at` timestamp.

3. **Render a markdown table**:
   ```
   | Run-id                        | Mode   | Progress | Last activity        | Task                                  |
   |-------------------------------|--------|----------|----------------------|---------------------------------------|
   | 2026-05-12-foo                | github | 2/5      | 2026-05-12 14:32     | Adds tokens + storybook              |
   | 2026-05-10-bar                | file   | 1/3      | 2026-05-11 09:15     | Migrate logging to pino              |
   ```

4. **Below the table**, list shortcuts the user can copy:
   ```
   Useful next actions:
     • /phase-status <run-id>   — render the full status block for a run
     • /phase-next <run-id>     — advance the next phase (after current handoff lands)
     • /phase-abort <run-id>    — stop a run mid-flight
   ```

5. **Empty case** — if zero in-flight runs:
   ```
   No in-flight phasing runs on this machine. Start one with /phase, or check ~/Projects/*/.claude/phasing/archive/ for completed runs.
   ```

## Performance

The scan is cheap (one filesystem walk + N JSON parses). No GitHub API round-trip is needed — GitHub-mode runs are still indexed by their local `run.json`. Future cross-machine visibility (via `phasing:tracking` GitHub label queries) is a follow-up, not part of this command.

## Strictly read-only

Do NOT mutate `run.json`, do NOT fire spawn scripts, do NOT prompt for any decision. The user picks the next action themselves.
