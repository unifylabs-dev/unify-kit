# §8.B — Phase-executor addendum (= phase-checkpoint shape)

This addendum's full content is owned by `~/Projects/unify-kit/plugins/unifylabs-workflow/skills/phasing/references/checkpoint-shape.md`, which is shared between the `handoff` skill (phasing-executor mode) and the `phasing` skill (mid-phase checkpoint flow).

**Path mapping when this addendum applies:**

- File path: `<run-dir>/phase-N-checkpoint.md`, NOT `.claude/handoffs/<date>-<slug>.md`.
- Frontmatter `metadata.type`: `phase-checkpoint` (not `session-handoff`).
- Race-tiebreaker rule: if both `phase-N-handoff.md` and `phase-N-checkpoint.md` exist for the same phase, handoff wins; checkpoint moves to `.bak`.

**Filled-in:** P5 of run `2026-05-24-handoff-skill-build`.
