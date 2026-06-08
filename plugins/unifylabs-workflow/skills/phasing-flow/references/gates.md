# The 3 human gates

phasing-flow has exactly **three** human decision-gates. They are the product —
the discipline layer on top of native autonomy. Each lives in THIS orchestrator
session, BETWEEN workflow runs (a running Workflow takes no mid-run input).

## Gating philosophy

**Gate where the user's *input* is needed — not for technical babysitting.** The
user's concern is sub-agents making misaligned direction-level decisions, not
autonomy itself. So:

- **GATE (the user's judgment):** direction/brainstorm, approving the synthesized
  master plan + resolving its open decisions, and verification sign-off.
- **NO GATE (autonomous):** spawning a workflow, running already-approved work,
  polling/waiting, mechanical transitions, slicing approved steps into units.

Do not invent extra gates. The old plan-mode gate existed because a *single*
autonomous planner made poor plans — that is a plan-QUALITY problem, solved here
by the **planning brain** (multi-angle planners + adversarial critic + judge), not
by more gates. The user approves a plan produced by a stronger process and remains
the final authority.

## GATE 1 — Direction

**When:** at the start, after brainstorming a task.
**What's decided:** *what* to build and the direction — the user's call, not yours.
**How:** a focused brainstorm (the `superpowers:brainstorming` skill fits). Settle
the task + `workingDir`, write them to the manifest, then proceed to `plan`.
**Do not** pick the direction for the user or skip to planning on an ambiguous ask.

## GATE 2 — Approve the master plan (+ resolve open decisions)

**When:** after the **planning-brain** Workflow returns.
**What's decided:** whether the synthesized plan is the right plan, and the answer
to every decision the critic+judge flagged as genuinely the user's.
**How:**
1. Render `result.master_plan.summary` and the ordered `result.master_plan.steps`.
2. Render EACH `result.master_plan.open_decisions_for_human` entry — a
   `{ decision, options, recommendation }` triple — and put them to the user via
   `AskUserQuestion` (the judge's recommendation first, marked Recommended).
3. The user **approves** (optionally adjusting), **resolves the open decisions**,
   or **sends it back** to re-plan with new direction.

> ⚠️ The gate fields are **nested under `result.master_plan.*`**, NOT at the top
> level of the workflow return. See `planning-brain-wiring.md`. Reading top-level
> `open_decisions_for_human` returns `undefined`.

**On approval:** slice the approved `master_plan.steps[]` → `units[]`
(`engine-contract.md`), write them to the manifest, and proceed to `run`.

## GATE 3 — Verification sign-off

**When:** after the **phasing-flow-engine** Workflow returns.
**What's decided:** whether the verified result is acceptable, and how to route a
blocking finding.
**How:**
1. Render the `exitReason` + what it means (`engine-contract.md` §exit reasons) +
   the `truncationLog`. Confirm `verifier-backstop.sh` is armed
   (`verification-spine.md`) so the deterministic Stop-hook net is live.
2. Put the result to the user via `AskUserQuestion`:
   - `clean` → sign off → next unit / run complete.
   - `criticals-pending-gate` / `aborted` → **blocking**: the user decides
     fix-and-re-run vs abort. A running Workflow could not fix it (no mid-run
     input), so the human must decide before any next unit.
3. Write `last_engine_return` + advance `current_unit` in the manifest.

**Never** auto-proceed past a blocking exit, and **never** substitute a soft model
"looks done?" check for this sign-off — the deterministic verifier + the user's
judgment are the gate (the M1 trust gate ruled out performative verification).
