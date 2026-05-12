---
description: Decompose a task into a master plan + per-phase specs, then orchestrate execution across fresh sessions with mandatory plan-mode gating and self-verification. Always forces phasing — skip the auto-detection gate.
---

The user invoked `/phase` with arguments: `$ARGUMENTS`

Use the `phasing` skill (located at `~/.claude/skills/phasing/SKILL.md`). Since the user explicitly invoked `/phase`, treat this as a **forced trigger** — skip the auto-offer detection gate at §4.1 and proceed directly to the master plan run lifecycle.

## Behavior

1. **Determine the task source**:
   - If `$ARGUMENTS` is non-empty: treat the arguments as the task description. If no plan exists yet in conversation, the orchestrator generates one as part of master plan §3 (plan mode).
   - If `$ARGUMENTS` is empty: run against the current plan in conversation. If there is no current plan, ask the user via `AskUserQuestion` what they want to phase before continuing.

2. **Run the master plan lifecycle** per SKILL.md:
   - §1 Load + understand (project-agnostic doc discovery; CLAUDE.md, MEMORY.md, anything pointed to)
   - §2 Brainstorm + ask + research (loop, any order; one clarifying question at a time via `AskUserQuestion`)
   - §3 `EnterPlanMode` and draft the master plan (per `references/master-plan-shape.md`)
   - §4 **Self-verification** before `ExitPlanMode` — re-read draft, fix issues, append `## Self-verification` footer (mandatory)
   - §5 Approval menu (Approve / Adjust / View / Abort)
   - §6 Execute mode — write artifacts (GitHub mode default if remote present; file mode fallback)
   - §7 Per-phase orchestration (spawn → poll → verify → user gate → next)
   - §8 Run-end closure with archive prompt

## Forced trigger sanity check

Even though forced, gently push back if the task is genuinely trivial (single-file change, <5 task bullets, typo fix). One-line nudge via chat (not blocking) — show the heuristics and ask "really phase this?" via `AskUserQuestion`. If user confirms, proceed. The user always wins.

## Caller propagation

If invoked by another skill (e.g., a future `work-issue` integration), the caller is responsible for writing context to `<run-dir>/context/<file>.md` BEFORE invoking. This command does not write caller context itself.
