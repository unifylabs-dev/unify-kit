---
description: "Continue a paused phase from its phase-N-checkpoint.md in a fresh executor session. Loads the checkpoint, mandatory EnterPlanMode to plan only the PENDING work-steps, executes, writes canonical phase-N-handoff.md with carried-from-checkpoint annotations, renames checkpoint to .bak. Invoked by the orchestrator's 'Re-spawn from checkpoint' menu pick or manually with /phase-continue <run-id> <N>. Triggers: 'continue paused phase', 'resume from checkpoint', 'pick up phase from checkpoint'."
---

The user (or `launch-terminal.sh` via the orchestrator's §9.5 "Re-spawn from checkpoint" menu pick) invoked `/phase-continue` with arguments: `$ARGUMENTS`

Parse `$ARGUMENTS` as `<run-id> <phase-N>`. If either is missing or malformed, error out and exit:
```
Usage: /phase-continue <run-id> <phase-N>
Example: /phase-continue 2026-05-24-handoff-skill-build 2
```

Use the `phasing` skill in **phase-executor mode** (continuation variant). This is the executor-side counterpart to the orchestrator's §9.5 menu — it re-enters a paused phase from its mid-flight `phase-N-checkpoint.md` artifact (canonical shape: [`skills/phasing/references/checkpoint-shape.md`](../skills/phasing/references/checkpoint-shape.md)).

## 12-step playbook (per design spec §9.5)

1. **Resolve run-id** — per the phasing skill's auto-detect rule. If `<run-id>` is omitted, scan `~/Projects/*/.claude/phasing/*/run.json` (skip `archive/` subtrees) for runs where any phase has `status == "checkpoint"`. If multiple matches, fail with explicit instruction listing the candidates so the user can re-run with an explicit run-id.

2. **Validate phase state** — load `<run-dir>/run.json`. Assert `phases[N].status == "checkpoint"`. If status is anything else (`pending` / `in_progress` / `complete` / `failed`), error out:
   ```
   phase <N> is not in checkpoint state (current: <status>); use /phase-execute or /phase-retry instead.
   ```
   Do NOT mutate run.json on validation failure.

3. **Load context** — read in this order (do not skip any):
   - **Master plan** — GitHub mode: `gh issue view $TRACKING_ISSUE --json body --jq '.body'`. File mode: read `<run-dir>/master-plan.md`.
   - **This phase's spec** — GitHub mode: `gh issue view $PHASE_ISSUE --json body --jq '.body'`. File mode: read `<run-dir>/phase-N-spec.md`.
   - **All predecessor handoffs** — for each phase 0..N-1, read its handoff (GitHub: phase-issue's last comment; file: `phase-<i>-handoff.md`). Skip any that don't exist (predecessor may have been skipped/aborted; document in plan).
   - **The checkpoint file** — `<run-dir>/phase-N-checkpoint.md`. This is the critical input that drives the plan. Read it fully; do NOT summarize.

4. **Recreate TaskList from the checkpoint's `## Work-step progress` section**. NOTE: `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/recreate-tasklist.sh` parses the canonical handoff `## §5 TaskList snapshot` shape (`- [status] subject — description`), which differs from the checkpoint's `## Work-step progress` shape (`` `[✓ DONE]` N. <title> — produced: ... ``). Rather than rewriting that script (P2 owns), do a thin inline mapping here:
   - For each line in `## Work-step progress`: extract the marker (`[✓ DONE]` / `[⏳ IN-FLIGHT]` / `[○ PENDING]`) and the work-step title.
   - Emit `TaskCreate` for each entry in source order (preserving spec step numbering as the subject prefix).
   - Emit `TaskUpdate <id> completed` for each `[✓ DONE]` entry.
   - Emit `TaskUpdate <id> in_progress` for the (at most one) `[⏳ IN-FLIGHT]` entry — this becomes the immediate work focus.
   - `[○ PENDING]` entries stay at status `pending`.

5. **MANDATORY `EnterPlanMode`** — non-negotiable per phasing skill §6.3. There is no "skip plan mode because we already have a checkpoint" shortcut. The plan covers ONLY:
   - **Pending work-steps** from the checkpoint's `## Work-step progress` section — `[○ PENDING]` and the one `[⏳ IN-FLIGHT]` (resume mid-step) entries. `[✓ DONE]` entries are explicitly **out of scope**; do not redo them.
   - **Pending verification-steps** from `## Verification-step progress` — `[○ NOT RUN]` entries. `[✓ PASS]` entries are skipped; they carry forward into the final handoff with the carried-from-checkpoint annotation.
   - **Resolution path for any still-applicable open questions** from the checkpoint's `## Open questions for orchestrator` section.

   The plan's body should also note the checkpoint's `## World-state delta during this executor session` — those files are already created/modified and MUST NOT be re-created from scratch.

6. **Self-verify the plan** per phasing skill §6.3a. At least 1 pass; more if first-pass surfaces issues. Append the mandatory `## Self-verification` footer to the plan file before exiting plan mode.

7. **`ExitPlanMode`** — user reviews + approves. The plan file is the gate.

8. **Execute the pending work-steps** per the approved plan. Run verification commands as you go. Update TaskList as steps complete.

9. **Run pending verification steps** — every `[○ NOT RUN]` step from the checkpoint runs now and reports its real PASS or FAIL outcome. Do NOT mark NOT RUN steps as PASS without actually running them.

10. **Write the canonical `phase-N-handoff.md`** per the phasing skill's handoff shape ([`skills/phasing/references/handoff-shape.md`](../skills/phasing/references/handoff-shape.md)). The Verification section MUST list ALL spec verification steps (both the ones carried from checkpoint AND the ones newly run in this session). Annotate carried entries with `(carried from checkpoint <YYYY-MM-DD>T<HH:MM:SS>Z)` so reviewers can distinguish what was verified in this executor session vs. the prior one. Example:
    ```
    - command `bash scripts/test/test-foo.sh` → PASS (carried from checkpoint 2026-05-24T17:42:09Z)
    - command `grep -c "bar" foo.md` → PASS (output 3, ≥1 required)
    ```
    GitHub mode: post the handoff body as a comment on the phase issue, then close: `gh issue close <phase-issue> --comment <handoff-body>`. File mode: write to `<run-dir>/phase-N-handoff.md`.

11. **Rename the checkpoint** — `mv <run-dir>/phase-N-checkpoint.md <run-dir>/phase-N-checkpoint.superseded-$(date -u +%Y%m%dT%H%M%SZ).bak`. Audit trail preserved; the canonical handoff is now the source of truth for what happened in this phase. Do this AFTER the handoff is written (so a crash between the two leaves the checkpoint in place for retry).

12. **Update `run.json` atomically** and exit. On success: `phases[N].status = "complete"`, `completed_at = now`, `handoff_url` (GitHub) or `handoff_path` (file) set. Then one-line completion to chat; the orchestrator's poll picks up the new handoff and resumes the chain.

## Hard rules

- **First tool call after step 4 must be `EnterPlanMode`.** No Edit/Write/Bash for project files between steps 3–4 (context load + tasklist recreate) and step 5 (plan mode). Reading the checkpoint and predecessor handoffs in step 3 is fine.
- **Self-verification footer is mandatory** in the plan file. The user sees it during `ExitPlanMode` review.
- **NO DEFERRED anywhere in the handoff.** Phase fails instead.
- **Do not modify other phases' specs or handoffs.** This session owns only `<phase-N>`.
- **Do NOT re-create files listed in the checkpoint's `## World-state delta`**. They already exist; modify in-place if changes are needed, otherwise leave untouched.

## Failure

If execution fails after step 7 (user approved plan but verification fails or work-step blocks): write `Status: failed` handoff with the failing step, update `run.json#phases[N].status = "failed"`, and exit. **Do NOT rename the checkpoint to `.bak`** on failure — leave it in place so a future `/phase-continue` (after the blocker is resolved) can retry from the same checkpoint state. The orchestrator will surface the failure and offer recovery (retry / edit-spec / fix-phase / abort) via the existing menu.
