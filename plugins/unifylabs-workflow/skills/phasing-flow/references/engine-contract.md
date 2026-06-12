# Engine contract — the `units[]` seam + the execution-engine API

The orchestrator SKILL and the **phasing-flow-engine** Workflow seed meet at one
seam: the SKILL transforms the human-approved plan into a `units[]` array and
hands it to the engine. The engine never invents work — it executes exactly the
units it is given.

## The D4↔D1 seam: `master_plan.steps[]` → `units[]`

At GATE 2 (approve master plan), after the user approves, YOU (the SKILL, in this
session) slice the approved `result.master_plan.steps[]` into the engine's input.
This is a **mechanical 1:1 (or user-confirmed grouped) slice** — not a re-plan.
The user approved the steps; you only reshape them. This keeps "subagents only
execute already-approved plans" true: nothing new is decided here.

### `units[]` schema (what you write to the manifest + pass to the engine)

```jsonc
[
  {
    "id":          "u1",            // REQUIRED, unique within the run (u1, u2, …)
    "title":       "Short label",   // REQUIRED, human-readable
    "instruction": "Do EXACTLY this unit's work: …",  // REQUIRED, the approved step text
    "verify_hint": "optional note for the verifier"   // optional
  }
]
```

- `id` MUST be unique within the run (the SKILL assigns `u1..uN`). Unique ids keep
  the run's bookkeeping unambiguous.
- `instruction` is the approved step, phrased as a self-contained directive an
  executor sub-agent can act on without the rest of the plan.
- Keep each unit a **single, verifiable** piece of work. For M2 the common path is
  `units.length === 1`; the kernel supports N and runs them serially (parallel fan-out is
  deferred — see BACKLOG "phasing-flow initiative — M5 follow-up").

## Invoking the engine

Invoke the committed bundle by scriptPath (it RUNS LIVE — do not re-build it):

```
Workflow({
  scriptPath: "<plugin>/skills/phasing-flow/workflow/phasing-flow-engine.workflow.mjs",
  args: { units, workingDir, cap?, diffReviewers? }
})
```

| arg | required | default | meaning |
|-----|----------|---------|---------|
| `units` | ✅ | — | the approved `units[]` (above) |
| `workingDir` | | `(current)` | where units execute + the project verifier runs |
| `cap` | | all units | max units to process this run; clamped to `[1, units.length]` |
| `diffReviewers` | | `2` | adversarial reviewers per diff (≥2 so consensus ≥2 is meaningful) |

`args` reaches the bundle as a JSON string; its `main()` parses it.

## The return (frozen report)

```jsonc
{
  "exitReason":      "clean",        // one of the FROZEN 7 (below)
  "unitsTotal":      3,
  "unitsCompleted":  3,              // units cleared clean
  "unitsResidual":   0,              // blocked + pending units (unitsCompleted + unitsResidual === unitsTotal)
  "budgetSpent":     123456,
  "truncationLog":   []              // every ceiling/clamp/block line — a silent stop is impossible
}
```

## The FROZEN 7 exit reasons (what to tell the user at GATE 3)

| exitReason | meaning | gate action |
|------------|---------|-------------|
| `clean` | every unit executed + verified + diff-clean | sign off; run complete (or next unit) |
| `criticals-pending-gate` | a unit's deterministic verify went RED, **or** the adversarial diff-review reached a consensus-Critical | **blocking** — surface to the user: fix + re-run, or abort. Do NOT auto-proceed. |
| `aborted` | a unit could not be produced (executor failed / hook-blocked mid-run / threw) or the verifier permanently failed / returned an unrecognized verdict | surface the failure; decide retry vs abort |
| `circuit-breaker` | cumulative spend blew past 5× the first unit's cost | runaway guard — re-scope or raise the budget |
| `cap` | processed the `cap` ceiling with units still pending | intentional partial run — continue with another `run` |
| `skip-if-clean` | there were no units to run | nothing to do |
| `fixed-point` | **reserved for a deferred parallel/retry milestone** (see BACKLOG "phasing-flow initiative — M5 follow-up"). The serial loop never emits it. | n/a today |

`unitsResidual` counts the blocking/aborting unit plus everything after it (the
loop stops at the first blocking unit — gates between units). The `truncationLog`
always names exactly why the loop stopped.
