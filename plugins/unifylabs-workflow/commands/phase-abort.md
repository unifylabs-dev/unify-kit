---
description: Cleanly abort an in-flight phasing run. Distinct from /phase-archive (which files away a completed run). Sets overall_status=aborted, closes GitHub issues with abort labels, and renders the Aborted variant of the status block.
---

The user invoked `/phase-abort` with arguments: `$ARGUMENTS`

Parse arguments. Two forms:
- `/phase-abort <run-id>` — abort the named run.
- `/phase-abort <run-id> <reason>` — abort with a free-text reason recorded in `run.json#abort_reason`.

Use the `phasing` skill in **abort mode**. See `~/.claude/skills/phasing/SKILL.md` → "Slash commands" → "/phase-abort" for the full algorithm.

## Behavior

1. **Resolve run-id** (per SKILL.md "Run-id auto-detection"). Single in-flight run → auto-detect; zero or multiple → error or disambiguate.

2. **Read `run.json`**. Tally:
   - `<K>` = phases with `status: complete`
   - `<M>` = phases with any other status (pending / in_progress / failed)

3. **Confirmation gate** (`AskUserQuestion`):
   ```
   Abort run <run-id>? <K> phases done, <M> remaining. This is irreversible.
   Options:
     - Abort (Recommended)                  — sets overall_status=aborted, closes GitHub issues
     - Adjust the master plan instead       — exits this command; user can re-plan via /phase
     - Keep going                            — cancel /phase-abort, no changes
   ```

4. **On "Abort" confirmation**:
   - **Update `run.json`** atomically:
     - `overall_status: aborted`
     - `aborted_at: <iso-now>`
     - `abort_reason: <reason arg if provided, else null>`
     - Leave individual phase statuses unchanged (preserves audit trail of what got done vs. didn't).
   - **GitHub mode** (`mode: github` in `run.json`):
     - Post an abort comment on the tracking issue (`tracking_issue` field): `**Run aborted at <iso>.** Reason: <reason or "no reason given">. <K> of <total> phases completed.`
     - Add `phasing:aborted` label to the tracking issue.
     - Close the tracking issue.
     - For each `phases[]` entry with `status != complete`:
       - Post a short comment on the phase issue: `Run aborted at <iso>. This phase was <status>.`
       - Add `phasing:aborted` label.
       - Close the phase issue.
     - Use `references/github-mode-commands.md` for exact `gh` invocations.
   - **File mode**: no extra files. State in `run.json` is sufficient.

5. **Render the Aborted variant of the status block** (SKILL.md "Status block" → Aborted variant):
   ```
   ## Run aborted — orchestrator-<topic-slug>

   **What I did** (across <K> completed phases)
   - <aggregated deliverable list>

   **Decisions made**
   - <aggregated decisions>

   **Open questions / notable**
   - <aggregated; or "none">
   - Abort reason: <reason or "no reason given">

   **Phases not started**
   - P<n>  <name>
   - ...

   **Next action**
   Run `/phase-archive <run-id>` to file the aborted run, or delete `<run-dir>` if you want it gone.
   ```

## Errors / edge cases

- **Run already aborted** (`overall_status == "aborted"`): no-op. Render the Aborted variant with current state. Do NOT re-fire confirmation or GitHub closes.
- **Run already complete** (`overall_status == "complete"`): error: `Run <run-id> is already complete. Use /phase-archive instead of /phase-abort.`
- **GitHub API failure mid-step**: do NOT roll back `run.json` (the abort intent is real). Surface the GitHub error and instruct: `run.json marked aborted, but GitHub close steps failed: <error>. Re-run /phase-abort <run-id> to retry the GitHub closes, or close them manually.`

## Distinct from /phase-archive

- `/phase-abort` stops a live run mid-flight; sets `aborted_at` and the Aborted state.
- `/phase-archive` files away a run that's already terminal (`complete` or `aborted`); sets `archived_at` and moves the run dir to `.claude/phasing/archive/<YYYY>/`. See `references/archive-policy.md`.

You typically run `/phase-archive` after `/phase-abort` to clean up. They're not interchangeable.
