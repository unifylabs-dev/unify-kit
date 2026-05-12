---
description: Execute a specific phase of an existing phasing run in a fresh terminal. Loads context, MUST EnterPlanMode + self-verify, executes after approval, writes handoff. Auto-loaded by launch-terminal.sh OR run manually by the user.
---

The user (or `launch-terminal.sh`) invoked `/phase-execute` with arguments: `$ARGUMENTS`

Parse arguments as `<run-id> <phase-N>`. If either is missing or malformed, error out:
```
Usage: /phase-execute <run-id> <phase-N>
Example: /phase-execute 2026-05-01-rest-api 2
```

Use the `phasing` skill in **phase-executor mode**. Follow phase session lifecycle §1–§9 in SKILL.md.

## Steps

1. **Locate the run**:
   - File mode: `<project-root>/.claude/phasing/<run-id>/run.json`. Error clearly if absent.
   - GitHub mode: `run.json` present locally; tracking issue and phase issues live on GitHub.

2. **Validate phase number**: read `run.json`. Confirm `<phase-N>` is a real phase. Confirm dependencies (predecessor handoffs) exist.

3. **Update `run.json` atomically**: this phase's status → `in_progress`, `started_at` = now (UTC ISO-8601). Use temp-file-then-rename.

4. **Load context** (phase session §1):
   - Master plan (GitHub: `gh issue view <tracking-issue> --json body --jq '.body'`; file: read `master-plan.md`)
   - Phase spec (GitHub: `gh issue view <phase-issue> --json body --jq '.body'`; file: read `phase-N-spec.md`)
   - Every predecessor handoff
   - Project files listed in spec's `Inputs`

5. **Brainstorm + ask + research if needed** (§2). Skip if spec encodes everything.

6. **Call `EnterPlanMode`** (§3) — MANDATORY, ALWAYS, regardless of task type. This overrides any "code only" guidance from the EnterPlanMode tool itself. The user paid orchestration overhead specifically for the plan-mode gate; skipping it defeats the purpose.

7. **Self-verification** before `ExitPlanMode` (§3a) — re-read draft, fix issues, append `## Self-verification` footer (mandatory).

8. **`ExitPlanMode`** for user approval (§4). The plan file is the gate.

9. **Execute** (§5). Run verification commands as you go.

10. **Self-verify deliverables** (§6). Run all verification steps from spec. **NO DEFERRED. NO defer-to-orchestrator.** If a step can't be verified, the phase fails — write `failed` handoff and exit.

11. **Write handoff** (§7) per `references/handoff-shape.md`:
    - File mode: write `<run-dir>/phase-N-handoff.md`.
    - GitHub mode: comment handoff body on phase issue, then close: `gh issue close <phase-issue> --comment <handoff-body>`.

12. **Update `run.json`** atomically:
    - Verification passed → status = `complete`, `completed_at` = now, `handoff_url` (GitHub) or `handoff_path` (file).
    - Verification failed → status = `failed`, record failing step.

13. **Report completion** to chat in one paragraph and exit. The orchestrator in the original terminal is polling and will resume the chain.

## Hard rules

- **First tool call after step 4 must be `EnterPlanMode`.** No Edit/Write/Bash/Read for project files between step 4 and step 6 (reading required-reading docs in step 4 is fine).
- **Self-verification footer is mandatory** in the plan file. The user sees it during `ExitPlanMode` review.
- **NO DEFERRED anywhere in the handoff.** Phase fails instead.
- **Do not modify other phases' specs or handoffs.** This session owns only `<phase-N>`.

## Failure

If verification fails: write handoff with `Status: failed` and the failing step. Update `run.json` to `failed`. Report to user in this terminal. Do NOT loop. Do NOT auto-fix out-of-scope issues. The orchestrator will surface and offer recovery (retry / edit-spec / fix-phase / abort).
