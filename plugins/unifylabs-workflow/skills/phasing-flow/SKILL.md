---
name: phasing-flow
description: >
  Orchestrate multi-unit work as a human-gated loop on native Opus 4.8 primitives:
  brainstorm → planning-brain Workflow (multi-angle + adversarial critic + judge)
  → YOU approve the master plan → execution-engine Workflow (per unit: execute →
  deterministic verify → adversarial diff-review, looping until a provable ceiling
  fires) → YOU sign off → next unit. The kit's discipline layer (decision gates,
  hallucination-free planning, rigorous verification, the security floor) on top of
  the native Workflow tool. A running Workflow takes no mid-run input, so every
  human decision-gate lives in THIS orchestrator session, BETWEEN workflow runs.
  Single `/phasing-flow` command with verb subcommands: start / plan / run / verify
  / status / resume. Use when a task spans multiple units, needs the human in the
  loop on direction + plan-approval + verification sign-off, and benefits from
  clean-context execution sub-agents. The successor to `phasing` for the
  cross-session orchestration cases it covers (phasing stays for the rest).
---

# phasing-flow — human-gated orchestration on native Workflows

> **You are the orchestrator session — the human-control spine.** You brainstorm
> with the user, launch Workflows, hold every decision gate, and re-ground between
> bursts. The Workflows are the autonomous engine; the user decides in the gaps.

## The hard platform constraint (why the gates live here)

A **running Workflow takes no human input mid-run** — it only pauses for
permission prompts. Therefore **every human decision-gate lives in THIS session,
BETWEEN workflow runs.** Workflows are autonomous bursts that start, run dark, and
return distilled structured results; you decide in the gaps. Do not try to gate
inside a workflow — it is structurally impossible and the whole control model
depends on it.

## The loop

```
brainstorm ──[GATE 1: direction]──▶ /phasing-flow plan
   └▶ Workflow(planning-brain)  →  { master_plan, critique, angled_plans, scout_count }
   render master_plan.{summary, steps, open_decisions_for_human}
   ──[GATE 2: approve master plan + resolve open decisions]──▶
       slice approved master_plan.steps[] → units[]  (the D4↔D1 seam)
   ──▶ /phasing-flow run
        └▶ Workflow(phasing-flow-engine, {units, workingDir})
           per unit:  executeUnit → verify (deterministic, AUTHORITATIVE)
                                 → adversarial diff-review (consensus ≥2, fail-open)
           exits on one of the FROZEN 7 reasons
   render exitReason + residual + the verifier result
   ──[GATE 3: verification sign-off]──▶ next unit / done
```

Gate only at these three judgment points (see `references/gates.md`). Do NOT gate
on mechanics — spawning a workflow, running already-approved work, polling,
transitions. (Gating philosophy: gate where the user's *input* is needed, not for
technical babysitting.)

## Verbs (single `/phasing-flow` command)

| verb | what it does |
|------|--------------|
| `start <task>` | Begin a run. Brainstorm the task to GATE 1 (direction), then proceed to `plan`. Initializes the run manifest. |
| `plan` | Run the **planning-brain** Workflow on the task; render the synthesized master plan + `open_decisions_for_human`; hold **GATE 2** (approve); on approval, slice `steps[]` → `units[]` into the manifest. |
| `run` | Run the **phasing-flow-engine** Workflow over the approved `units[]`; render the exit reason + residual + verifier result; hold **GATE 3** (sign-off). |
| `verify` | Re-run the deterministic project verifier on the current working tree out-of-band (the optional `/goal`-style outer check — never the authoritative in-run gate). |
| `status` | Render the current run state from the manifest. Read-only; spawns nothing. |
| `resume` | Reload the manifest + continue from `current_unit` in a fresh session. |

`/phasing-flow` with no verb (or `start` with no task) → ask the user what to work
on, then enter the loop at GATE 1.

## Procedure

### 0. Pre-flight
- Confirm you are in the orchestrator session (where the user is), NOT inside a
  workflow. If `ultracode` is on, good — the framework assumes it.
- Resolve the **run manifest** path: `<project>/.phasing-flow/run.json` (one active
  run). On `start`, initialize it; on `plan`/`run`/`status`/`resume`, read it. See
  `references/status-card.md` for the schema. The manifest is written by YOU (this
  session, with normal file tools) — NOT by a workflow.

### 1. Brainstorm → GATE 1 (direction)
- Use the `superpowers:brainstorming` skill (or a focused discussion) to settle
  **what** the user wants and the direction. This is a decision gate: the user
  sets direction; you do not pick it for them.
- Write the agreed task + `workingDir` into the manifest.

### 2. `plan` → planning-brain Workflow → GATE 2 (approve)
- Invoke the **planning-brain** seed by scriptPath (it RUNS LIVE — do not re-build
  it). See `references/planning-brain-wiring.md` for the exact call + args + the
  **return nesting** (the gate fields are under `result.master_plan.*`, NOT
  top-level).
- When it returns, render `master_plan.summary`, `master_plan.steps`, and EACH
  `master_plan.open_decisions_for_human` `{decision, options, recommendation}`
  triple. Hold **GATE 2** via `AskUserQuestion`: the user approves the plan and
  resolves every open decision (or sends it back to re-plan).
- On approval: slice the approved `master_plan.steps[]` into the engine's
  `units[]` (the D4↔D1 seam — see `references/engine-contract.md`). The engine
  **never invents work**; you do a mechanical (or user-confirmed grouped) 1:1
  slice of steps the user approved. Write `units[]` + `master_plan_path` to the
  manifest; set `status: running-ready`.

### 3. `run` → phasing-flow-engine Workflow → GATE 3 (sign-off)
- Invoke the **phasing-flow-engine** bundle by scriptPath with
  `{ units, workingDir }` (+ optional `cap`, `diffReviewers`). See
  `references/engine-contract.md`.
- It returns a frozen report `{ exitReason, unitsTotal, unitsCompleted,
  unitsResidual, budgetSpent, truncationLog }`. Render the exit reason + what it
  means (`references/engine-contract.md` §exit reasons) + the `truncationLog`.
- **Arm `verifier-backstop.sh`** so the deterministic Stop-hook net is live for the
  session (`references/verification-spine.md`).
- Hold **GATE 3** via `AskUserQuestion` — the user signs off on the verified result
  (or routes a blocking finding: fix + re-run, or abort). Write
  `last_engine_return` + advance `current_unit` in the manifest.
- If `exitReason` is `clean` and all units are done → the run is complete. If
  `criticals-pending-gate` / `aborted` → surface the blocker to the user at GATE 3
  (do not auto-proceed — a running Workflow could not fix it, and the next unit
  must wait on the human decision).

### 4. `status` / `resume`
- `status`: read the manifest, render the run card (task, plan, units, cursor, last
  exit). Spawn nothing.
- `resume`: read the manifest in a fresh session, re-ground on `master_plan_path` +
  `last_engine_return`, and continue at `current_unit` (re-enter at `run` or the
  pending gate).

## Hard rules

- **Never gate inside a workflow.** Gates live here, between runs.
- **The deterministic verify is authoritative; the adversarial diff-reviewer can
  only RAISE a gate (fail-open).** Never treat the LLM diff-review as the source of
  truth, and never use a soft model "looks done?" check as the verification gate
  (that is the performative-DEFERRED-verification failure the M1 trust gate ruled
  out). See `references/verification-spine.md` (J4: deterministic-first).
- **`/goal` is an OPTIONAL outer wrapper** you may invoke between runs for a "keep
  going until verified-green" loop — it is never the in-run gate.
- **Subagents only execute already-approved plans + report.** Every direction-level
  decision is a gate in THIS session.
- **The planning-brain seed + the execution-engine seed RUN LIVE — do not re-build
  them.** Invoke by scriptPath.

## References

- `references/gates.md` — the 3 human gates in detail + the gating philosophy.
- `references/engine-contract.md` — the `units[]` schema, the D4↔D1 seam, the
  engine args, and the frozen-7 exit reasons.
- `references/verification-spine.md` — the 3-layer spine (deterministic verify /
  adversarial diff-review / verifier-backstop Stop hook) + arming it + `/goal`.
- `references/planning-brain-wiring.md` — invoking the planning-brain seed + the
  `result.master_plan.*` return nesting.
- `references/status-card.md` — the run manifest schema + `status`/`resume` UX.
