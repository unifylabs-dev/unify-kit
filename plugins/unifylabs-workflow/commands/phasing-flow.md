---
description: "Human-gated orchestration on native Workflows: brainstorm → planning-brain (multi-angle + critic + judge) → approve plan → execution-engine (execute → verify → adversarial diff-review) → sign off → next unit. Single command, verb subcommands."
argument-hint: "[start <task> | plan | run | verify | status | resume]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Agent", "AskUserQuestion", "Skill", "TaskCreate", "TaskUpdate", "TaskList"]
---

# /phasing-flow

Invoke the `phasing-flow` skill. The first argument is the **verb**; the rest are
its arguments.

**Arguments:** "$ARGUMENTS"

## Verbs

- `/phasing-flow start <task>` — begin a run: brainstorm to the **direction** gate,
  then proceed to `plan`. Initializes the run manifest.
- `/phasing-flow plan` — run the **planning-brain** Workflow on the task; render the
  synthesized master plan + `open_decisions_for_human`; hold the **approve-plan**
  gate; on approval, slice the approved steps into `units[]`.
- `/phasing-flow run` — run the **phasing-flow-engine** Workflow over the approved
  `units[]` (per unit: execute → deterministic verify → adversarial diff-review,
  until a provable ceiling fires); render the exit + hold the **sign-off** gate.
- `/phasing-flow verify` — re-run the project's deterministic verifier out-of-band
  (the optional `/goal`-style outer check; never the authoritative in-run gate).
- `/phasing-flow status` — render the current run state from the manifest
  (read-only; spawns nothing).
- `/phasing-flow resume` — reload the manifest in a fresh session and continue from
  the current unit.

`/phasing-flow` with no verb → ask what to work on, then enter at the direction
gate.

## Behavior

Invokes the `phasing-flow` skill, which orchestrates the human-gated loop. A
running Workflow takes **no mid-run input**, so all three human decision-gates
(direction · approve-plan · verification sign-off) live in the orchestrator
session, BETWEEN workflow runs. Verification is **deterministic-first**: the in-run
project verifier is authoritative, the adversarial diff-reviewer can only RAISE a
gate (fail-open), and `verifier-backstop.sh` is the no-LLM Stop-hook backstop.

See the bundled `phasing-flow` skill (`SKILL.md` + `references/`) for the full
orchestration logic, the `units[]` engine contract, the verification spine, the
planning-brain wiring, and the run-manifest schema.
