# Checkpoint shape

**Read when**: a phase session is about to write its mid-phase checkpoint via `/handoff` in phasing-executor mode (per design spec §6.2.2 + §9.1). The file is written at `<run-dir>/phase-N-checkpoint.md` and read by the orchestrator's polling loop (phasing SKILL.md §7.3 extension, landed in P6).

This file is the **canonical** structural source for the `phase-N-checkpoint.md` artifact. It is shared between two consumers:

- The `handoff` skill writes the file (when invoked in phasing-executor mode). The handoff skill's `references/addendum-phase-exec.md` carries only the writer-side divergences from generic mode (path-mapping table, MEMORY.md skip behavior, user-prompt fork) — it points here for the section layout.
- The `phasing` skill reads the file (the orchestrator's `__init_phasing/` polling loop picks it up; the `⏸ CHECKPOINT` status block lifts sub-sections verbatim into the founder-facing card).

## Skeleton

```markdown
---
metadata:
  type: phase-checkpoint
  run_id: <run-id>
  phase_n: <int>
  origin_session_name: phase-<N>-<slug>
  created_at: <UTC-ISO-8601>
status: pending
---

# Phase N Checkpoint — <name>

**Session**: `⚡ phase-<N>-<phase-name-slug>`  <!-- display form with emoji prefix (e.g., ⚡ phase-5-phase-executor-addendum-checkpoint-shape); matches the Claude Code title pill. run.json#phases[N].session_name stores the plain slug (no emoji) per the data/display rule in phasing SKILL.md "Session naming". -->

## Status
checkpoint

## Phase identity
- **run_id**: `<run-id>`
- **phase N**: `<int>`
- **spec path**: `<absolute or run-relative path to phase-N-spec.md (file mode) OR issue URL (GitHub mode)>`
- **predecessor handoffs loaded**: `<paths or issue URLs for phases 0..N-1, comma-separated; all must have been read before this checkpoint was written>`

## Plan-mode state
- **plan approved**: `<yes | no>`
- **plan file path**: `<~/.claude/plans/<plan-slug>.md or "n/a — not yet entered plan mode">`
- **approved at**: `<UTC-ISO-8601 or "n/a">`
- **self-verification pass count**: `<int — 1 minimum per phasing §6.3a; 2+ if first-pass surfaced issues>`

## Work-step progress
<!-- NEVER trimmed at any tier. Map every numbered work-step from the phase spec; never omit pending ones. -->
- `[✓ DONE]` 1. <verbatim work-step title from spec> — produced: `<file path(s) or one-line outcome>`
- `[✓ DONE]` 2. <verbatim work-step title> — produced: `<...>`
- `[⏳ IN-FLIGHT]` 3. <verbatim work-step title> — current state: `<one-line description of how far along>`
- `[○ PENDING]` 4. <verbatim work-step title>
- `[○ PENDING]` 5. <verbatim work-step title>
- ...

## Verification-step progress
<!-- Map every verification step from the phase spec; never omit. -->
- `[✓ PASS]` 1. command `<exact cmd from spec>` — output: `<key line confirming pass>`
- `[✓ PASS]` 2. check `<criterion from spec>` — how confirmed: `<one-line>`
- `[○ NOT RUN]` 3. command `<exact cmd from spec>`
- `[○ NOT RUN]` 4. review `<criterion from spec>`
- ...

## World-state delta during this executor session
<!-- NEVER trimmed at any tier. The orchestrator's ⏸ CHECKPOINT card lifts this verbatim. -->
- **files created**:
  - `<absolute or repo-relative path>` — `<one-line "what it is">`
- **files modified**:
  - `<path>` (lines `<a>`–`<b>`) — `<one-line "what changed">`
- **tests / commands run**:
  - `<exact command>` → `<exit code + key output line>`
- **external state changes**:
  - `<e.g., "committed <sha> to branch <name>" | "opened gh issue #<n>" | "none">`

## Reason for checkpoint
<reason>

<2–4 sentences of detail: what the executor was doing when it decided to pause, what trigger fired (context %, blocker, scope-creep observation, other), why the executor judged this the right boundary to stop at rather than push through.>

## Recommended next action
<!-- Check exactly ONE box. The orchestrator's 4-option menu (phasing SKILL.md §9.4) pattern-matches the Reason value to dynamically tag a Recommended option, but the executor's pre-check here gives the orchestrator a starting recommendation. -->
- [ ] Re-spawn from checkpoint (=continue this phase in a fresh executor via `/phase-continue`)
- [ ] Split phase (=mark this phase complete with partial deliverables; open new phase for remainder)
- [ ] View detail (=user reads the checkpoint, decides later)
- [ ] Abort phase (=this phase is unrecoverable; orchestrator marks failed; user decides next)

## Open questions for orchestrator
- <thing the executor noticed but couldn't resolve in scope>
- <ambiguity in the spec that surfaced during this session and needs orchestrator-level resolution before continuation>

(Only real, encountered issues. Not speculation. Not "what if we add Y later." Things that came up DURING this executor session and need attention before the orchestrator picks a recovery path.)

---

**Written by**: `⚡ phase-<N>-<slug>` at `<UTC-ISO-8601>`.
```

## On 'NEVER trimmed' sub-sections

The handoff skill's tier selection (FULL / LEAN / EMERGENCY) controls section *depth* in the universal 7-section core — but tier does **NOT** apply to checkpoint sub-sections. Two sub-sections are NEVER trimmed at any tier:

- **`Work-step progress`** — NEVER trimmed at any tier. The orchestrator's `⏸ CHECKPOINT` card (P6's renderer, phasing SKILL.md §9.3) lifts DONE / IN-FLIGHT / PENDING markers verbatim into the founder-facing card. Trim them and the card lies about phase state.
- **`World-state delta during this executor session`** — NEVER trimmed at any tier. Same lift-verbatim contract. The `/phase-continue` flow (P7) also reads this sub-section to know which files the fresh executor must NOT re-create.

If the executor is at EMERGENCY tier and worried about output cost: trim the universal core sections via the handoff skill's tier logic, NOT the checkpoint sub-sections. The checkpoint is small by nature — its sub-sections only describe THIS executor session, not the full session arc.

The four `Reason for checkpoint` enum values map to a Recommended menu option (phasing SKILL.md §9.4):

- `context-pressure` → Re-spawn from checkpoint (default Recommended when reason = context-pressure).
- `scope-creep-detected` → Split phase (default Recommended when reason = scope-creep-detected).
- `blocker-out-of-scope` → Abort phase (default Recommended when reason = blocker-out-of-scope).
- `other` → View detail (default Recommended when reason = other — orchestrator wants the user to read before deciding).

P6's pattern-matcher looks for exactly these enum spellings. Use them verbatim.

## Race-tiebreaker rule

If both `phase-N-handoff.md` and `phase-N-checkpoint.md` exist for the same phase on the same orchestrator poll tick, **handoff wins**. The checkpoint is renamed `phase-N-checkpoint.superseded-<UTC-iso>.bak` for audit; orchestrator proceeds as if only the handoff existed. The orchestrator's `__init_phasing/` polling loop (phasing SKILL.md §7.3 extension, landed in P6) implements this rule.

The handoff-side mirror of this paragraph lives in [`../../handoff/references/addendum-phase-exec.md`](../../handoff/references/addendum-phase-exec.md). The wording is identical by design — paraphrasing in either direction would create drift between writer (handoff skill) and reader (phasing orchestrator).

## Length

Soft target: ~200 lines for a populated checkpoint. Quality over completeness. If you're approaching 300 lines, ask: am I padding? Am I rehashing the spec? The checkpoint should be the minimum a fresh `/phase-continue` executor (or the orchestrator's menu) needs.

The skeleton above is ~70 lines; a real populated checkpoint typically adds another 60–100 lines of actual progress detail.

## Anti-patterns

- "DEFERRED" anywhere in the checkpoint → BANNED. (Mirrors the handoff-shape rule. A checkpoint is paused work, not deferred work — pending steps are listed concretely in `Work-step progress`, not waved away.)
- "Orchestrator will figure it out" / "leaving for orchestrator" → BANNED. Phase fails instead — write a `Status: failed` handoff per `handoff-shape.md`, not a checkpoint.
- Empty `Work-step progress` → BANNED. Re-do the progress mapping; an empty checkpoint defeats its purpose (the orchestrator's card will show nothing and the `/phase-continue` executor can't pick up where work left off).
- Empty `Reason for checkpoint` → BANNED. The orchestrator's menu Recommended-tag logic pattern-matches on this field; an empty value forces the menu to default to "View detail" with no signal to the user.
- Checking >1 box under `Recommended next action` → BANNED. Pick one. If genuinely torn between two, pick "View detail" and write the trade-off in `Open questions for orchestrator`.
- Trimming `Work-step progress` or `World-state delta` to save tokens → BANNED at every tier. The orchestrator lifts them verbatim; truncated input = wrong card.
