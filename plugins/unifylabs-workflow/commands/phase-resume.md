---
description: Resume an interrupted phasing run from run.json state. Reconstructs orchestrator state and continues. Idempotent — running it when nothing has changed produces a no-op status report.
---

The user invoked `/phase-resume` with arguments: `$ARGUMENTS`

Parse arguments. Two forms:
- `/phase-resume <run-id>` — resume from current phase per `run.json`.
- `/phase-resume <run-id> <phase-N>` — explicitly resume from phase N (force re-dispatch even if marked complete; use cautiously).

Use the `phasing` skill in **orchestrator-resume mode**.

## Behavior

1. **Locate the run**: `<project-root>/.claude/phasing/<run-id>/run.json`. If absent and the user gave only a partial run-id, fuzzy-match against existing runs and confirm with user.

2. **Read `run.json`**. Determine where the run left off:
   - List phases by status: `complete` / `in_progress` / `pending` / `failed`.
   - Identify the resumption point.

3. **Reconstruct orchestrator state**:
   - Phases marked `complete`: frozen. Skip. Their handoffs are predecessor knowledge for downstream.
   - Phases marked `failed`: surface to user via `AskUserQuestion`: retry / edit-spec / fix-phase / abort. Wait for choice.
   - Phases marked `in_progress` with NO handoff written: assume interrupted mid-execution. Prompt user: "Phase N was in progress. Reset to pending and re-spawn, or check the phase-N session is still alive?" via `AskUserQuestion`.
   - Phases marked `in_progress` WITH a handoff present: read the handoff, run orchestrator post-phase verification (per SKILL.md §9.2). Transition to `complete` (or `failed` if verification fails).
   - Phases marked `pending`: dispatch in order respecting any informal `depends_on`.

4. **Inform the user** of recovered state in plain language:
   ```
   Run: <run-id>
   Recovered state:
     ✓ Phase 1: complete (verified)
     ⟲ Phase 2: was in_progress with no handoff — reset to pending, re-dispatching now
     ⋯ Phase 3: pending
     ⋯ Phase 4: pending
   ```

5. **Continue normal orchestration** per SKILL.md master plan lifecycle §7 from the resumption point.

## Folds in `/phase-continue`

The old framework had a separate `/phase-continue` for the case where a session-phase handoff was written but the orchestrator's background poll didn't fire (terminal crash, context reset). `/phase-resume` covers that case too — when invoked, it checks for handoff files / closed phase issues even on `in_progress` phases and runs the verification gate.

## Caveats

- **Do NOT re-run a `complete` phase** unless the user explicitly passes `<phase-N>` and confirms. Completion is frozen by design — re-running rewrites history.
- **Atomic writes still apply** during resumption. Every state transition writes via temp-file-then-rename.
- If the user passes `<phase-N>` that's beyond a `pending` predecessor (e.g., resume phase 4 when phase 3 is still pending), explain that this skips phase 3 and require explicit confirmation. Default is to respect dependency order.
