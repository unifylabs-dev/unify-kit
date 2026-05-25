# §8.B — Phase-executor addendum (= phase-checkpoint shape)

When the handoff skill is invoked in phasing-executor mode, it writes a `phase-N-checkpoint.md` file at `<run-dir>/phase-N-checkpoint.md`, NOT a `.claude/handoffs/<date>-<slug>.md` file.

The structural rules for this artifact (skeleton, sub-sections, NEVER-trimmed markers, anti-patterns) live in [`phasing/references/checkpoint-shape.md`](../../phasing/references/checkpoint-shape.md). This file (`addendum-phase-exec.md`) carries only the **writer-side divergences** from generic-mode handoff writing — path-mapping, race rule, MEMORY.md skip, user-prompt fork. Anything section-shape related: read the canonical source.

## Path mapping: generic mode vs phasing-executor mode

| Field | Generic / non-phasing mode | Phasing-executor mode |
|---|---|---|
| Write path | `.claude/handoffs/<YYYY-MM-DD>-<slug>.md` | `<run-dir>/phase-N-checkpoint.md` |
| Frontmatter `metadata.type` | `session-handoff` | `phase-checkpoint` |
| Frontmatter `run_id` | absent | required |
| Frontmatter `phase_n` | absent | required |
| Sections used | Universal 7-section core (per `core-shape.md`) | Universal core IS NOT used; `checkpoint-shape.md` owns the layout |

## Race-tiebreaker rule

If both `phase-N-handoff.md` and `phase-N-checkpoint.md` exist for the same phase on the same orchestrator poll tick, **handoff wins**. The checkpoint is renamed `phase-N-checkpoint.superseded-<UTC-iso>.bak` for audit; orchestrator proceeds as if only the handoff existed. The orchestrator's `__init_phasing/` polling loop (phasing SKILL.md §7.3 extension, landed in P6) implements this rule.

This paragraph is copy-pasted verbatim from `checkpoint-shape.md` `## Race-tiebreaker rule`. Drift between the two would create hard-to-debug behavior between writer (this skill) and reader (phasing orchestrator) — keep them in lockstep.

## MEMORY.md pointer behavior

Checkpoints **DO NOT** add a MEMORY.md pointer. The orchestrator picks them up via the §7.3 polling loop in phasing SKILL.md, not via SessionStart-time MEMORY.md scan. The handoff skill's write lifecycle (SKILL.md `## Lifecycle` → `### Write phase`, step 7 "MEMORY.md pointer append") MUST skip the MEMORY.md append step when `mode == phasing-executor`.

Rationale: a MEMORY.md pointer in the executor's terminal is useless — the executor exits immediately after writing the checkpoint, and the orchestrator (a different terminal) does not read MEMORY.md to discover checkpoints; it polls the run directory directly.

## `/handoff` user-prompt fork (per design spec §9.1)

In phasing-executor mode, `/handoff` does NOT proceed directly to a write. It first asks via `AskUserQuestion` which case applies:

1. **Pausing mid-phase (write checkpoint)** → checkpoint write path per this addendum. The skill writes `phase-N-checkpoint.md` per `checkpoint-shape.md`, updates `run.json#phases[N].status = "checkpoint"` (per the P6 schema extension), increments `checkpoint_count`, and exits.
2. **Finishing normally (print canonical handoff template)** → print the path the executor should write to (`<run-dir>/phase-N-handoff.md`) plus a pointer to [`../../phasing/references/handoff-shape.md`](../../phasing/references/handoff-shape.md), then exit WITHOUT writing.

The canonical phase-end handoff (`phase-N-handoff.md`) is owned by the phasing skill's phase session lifecycle (§6.7), not by `/handoff`. The handoff skill never writes the phase-end handoff directly — it only writes the mid-phase checkpoint.

## Filled-in

This file's contents were filled in by P5 of run `2026-05-24-handoff-skill-build` (previously a 12-line stub from P1). The canonical section layout it points at (`checkpoint-shape.md`) was added in the same phase.
