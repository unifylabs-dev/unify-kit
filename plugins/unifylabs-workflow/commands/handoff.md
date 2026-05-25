---
description: Write a session handoff at the current point. Detects mode (phasing-orchestrator | phasing-executor | brainstorm | plan-exec | work-issue | generic), picks a tier (FULL/LEAN/EMERGENCY) by context %, gates on natural breaks, then writes the universal 7-section doc + matching mode addenda. Use when context is approaching pressure or you want to transfer state to a fresh session.
---

The user invoked `/handoff` with arguments: `$ARGUMENTS`

Use the `handoff` skill in **writer mode**. Follow the 9-step playbook from design spec §8.1 and the discipline encoded in `${CLAUDE_PLUGIN_ROOT}/skills/handoff/SKILL.md` + its references.

## Steps

1. **Parse `$ARGUMENTS`** for tier overrides (`lean`, `emergency`, `full`) and flags (`--slug=<slug>`, `--mode=<mode>`). No arguments → tier auto-selected by context %; slug auto-derived from session topic; mode auto-detected.

2. **Detect mode.** Invoke `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/detect-mode.sh` and parse its JSON. If `$ARGUMENTS` supplied `--mode=<mode>`, override the detected `mode` field but keep all `paths.*` from the JSON.

3. **Select tier** per `${CLAUDE_PLUGIN_ROOT}/skills/handoff/references/tier-logic.md`:
   - context % < 50 → `full` (default)
   - 50–64 → `lean`
   - ≥ 65 → `emergency`
   - User override from $ARGUMENTS wins.

4. **Pre-write size estimate.** Estimate the byte size of the document about to be written (section depths × tier multiplier). If writing it would push the session past 75% context, surface a warning via `AskUserQuestion`:
   - "Estimated write would push context to ~<N>%. Downgrade tier?"
   - Options: `Downgrade to <lower tier>` / `Write anyway` / `Cancel`.

5. **Natural-break gate.** Unless `$ARGUMENTS` contains `--force`, surface `AskUserQuestion`:
   - Question: "Mid-task. How to handle the in-progress work?"
   - Options:
     1. **Finish current step, then handoff (Recommended)** — defer write until natural break.
     2. **Write now with partial state** — capture the in_progress task as-is in §5.
     3. **Cancel** — no handoff.

6. **Compute write path** per detected mode (artifact-naming canon, design spec §4.3):
   - `phasing-orchestrator`, `generic`, `plan-exec`, `work-issue`, `brainstorm` → `.claude/handoffs/<YYYY-MM-DD>-<slug>.md`
   - `phasing-executor` → `<run-dir>/phase-N-checkpoint.md` (frontmatter `metadata.type: phase-checkpoint`; full shape owned by P5 of run `2026-05-24-handoff-skill-build`)

7. **Write the doc in a single `Write` call.** Assemble in order: frontmatter (per `references/core-shape.md` §1) → preamble (≤4 lines) → §1–§7 universal core (per tier rules in `references/core-shape.md` §3) → mode addenda in stacking order from `SKILL.md` (§8 phasing-orch|executor → §9 brainstorm → §10 plan-exec → §11 work-issue) → footer. Lift templates verbatim from `references/core-shape.md` and `references/addendum-<mode>.md`.

8. **Append MEMORY.md pointer** at the top of the index (newest-first) per design spec §8.2:

   ```
   - [Pending handoff — <topic>](<relative-path>) — created <ISO>, mode <mode>, tier <tier>. RESUME FIRST in fresh session if continuing <topic>.
   ```

   If `MEMORY.md` does not exist, create it with a single-line header.

9. **Emit terse confirmation** to chat:

   ```
   Handoff written: <path>
   Mode: <mode>  ·  Tier: <tier>  ·  Sections: 7 core + <N> addenda
   Pointer appended to MEMORY.md.
   ```

## Hard rules

- **Never auto-write without user invocation.** This command must be user-triggered; P3's hook is awareness, not instruction.
- **Never bypass the natural-break gate** unless `--force` is explicit in $ARGUMENTS.
- **One `Write` call.** Assembling the body in pieces risks tier-leak (e.g., FULL prose in an EMERGENCY tier doc).
- **Atomic MEMORY.md append.** `awk … > MEMORY.md.tmp && mv MEMORY.md.tmp MEMORY.md` — never `sed -i`.
