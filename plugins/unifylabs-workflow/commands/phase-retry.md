---
description: Re-spawn a phasing phase that died, hung, or wrote a failed handoff. Backs up the existing handoff, resets the phase to pending, increments retry_count, and fires launch-terminal.sh fresh.
---

The user invoked `/phase-retry` with arguments: `$ARGUMENTS`

Parse arguments. Required form:
- `/phase-retry <run-id> <N>` — both arguments mandatory.

`<N>` is required (no auto-detect) because retry is a high-impact operation and the user should be explicit about which phase.

Use the `phasing` skill in **retry mode**. See `~/.claude/skills/phasing/SKILL.md` → "Slash commands" → "/phase-retry" for the full algorithm.

## Behavior

1. **Resolve run-id** (per SKILL.md "Run-id auto-detection") — single in-flight run auto-detects; otherwise error or disambiguate. (Even though `<N>` is explicit, `<run-id>` follows the standard rule.)

2. **Read `run.json#phases[N]`**. Check `status`:

   - **`complete`** → `AskUserQuestion`: `Phase <N> (<name>) is marked complete. Retry anyway? (overwrites existing handoff)` Options:
     - `Yes — I know it's broken` (Recommended only when the user has explicit evidence)
     - `No, cancel /phase-retry`
   - **`in_progress`** → `AskUserQuestion`: `Phase <N> (<name>) shows in_progress (started <Xm> ago). Assume the phase session is dead and retry?` Options:
     - `Yes — retry now`
     - `No, wait longer` (cancels)
   - **`failed`** → no confirmation. Proceed.
   - **`pending`** → error: `Phase <N> never started. Use /phase-next instead of /phase-retry.`
   - **`<N>` out of range** → error: `Phase <N> does not exist in run <run-id>. Valid phases: 1-<total>.`

3. **Back up any existing handoff** (before mutating state):
   - **File mode**: if `<run-dir>/phase-<N>-handoff.md` exists, rename it to `<run-dir>/phase-<N>-handoff.retry-<iso-timestamp>.bak.md`. Use a single atomic `mv`. Never delete.
   - **GitHub mode**: leave the existing handoff comment on the phase issue (audit trail). Post a new comment: `**/phase-retry invoked at <iso>.** Previous handoff above is preserved. Re-spawning phase session.` Re-open the issue if it was closed.

4. **Update `run.json#phases[N]` atomically**:
   - `status: pending`
   - Clear `completed_at` (set to null or delete the field)
   - Clear `handoff_url` / `handoff_path`
   - Increment `retry_count` (treat missing as 0 → set to 1; otherwise current + 1)
   - Keep `started_at` (audit trail of first attempt). `/phase-execute` will overwrite when the new session starts.

5. **Spawn the phase**: `scripts/launch-terminal.sh <run-id> <N> <project-dir> <phase-name-slug>`. Same code path as a fresh `/phase-next`. The phase session will load context as usual (master plan, this spec, predecessor handoffs) and enter plan mode.

6. **One-line confirmation in chat**: `↻ Retrying P<N> phase-<N>-<slug> (retry #<retry_count>). Polling for new handoff.`

## State invariants

- The backed-up handoff is never deleted by this command. Successive retries produce `.retry-<ts1>.bak.md`, `.retry-<ts2>.bak.md`, etc. The user can clean these up manually after the run reaches a terminal state.
- `retry_count` is monotonically increasing per phase; it never resets within a run. Use it to identify chronically flaky phases.
- Steps 1–2's error paths must NOT touch `run.json`, NOT delete files, NOT spawn anything.

## When to use vs. `/phase-next`

- `/phase-next` advances to the **next pending phase** after the **current phase completes** cleanly. It's the happy path.
- `/phase-retry` re-runs an **existing phase** that's `failed`, dead-in-progress, or known-broken-but-marked-complete. It's the recovery path.

If a phase wrote `Status: failed` in its handoff, the orchestrator's self-healing flow (SKILL.md §9.3) typically offers a fix-phase or retry inline. `/phase-retry` is the manual equivalent — useful when the orchestrator process is dead, the user is invoking from elsewhere, or the self-healing menu was dismissed and the user wants to retry later.
