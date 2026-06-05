# Run manifest + `status` / `resume`

phasing-flow persists just enough between-run state to render a status card and
resume in a fresh session — **a single minimal manifest** (decision OD-5). It
deliberately ports NONE of `phasing`'s heavyweight machinery (no multi-terminal
`run.json` polling, no `launch-terminal.sh`, no OSC-2 title pills). The manifest is
written by YOU in the orchestrator session with normal file tools — never by a
workflow.

## Location

```
<project>/.phasing-flow/
  run.json        # the manifest (one active run)
  plans/          # planning-brain plan bodies (master_plan_path lives here)
```

One active run at a time keeps it minimal. (A finished run's manifest can be moved
aside before starting another.)

## Schema (`run.json`)

```jsonc
{
  "task":            "the agreed task (from GATE 1)",
  "workingDir":      "/abs/path/where/units/execute",
  "master_plan_path":"/abs/.phasing-flow/plans/MASTER-PLAN-….md",  // set at GATE 2
  "units": [                                  // set at GATE 2 (approved steps sliced)
    { "id": "u1", "title": "…", "instruction": "…", "verify_hint": "…" }
  ],
  "current_unit":    0,                        // index of the NEXT unit to run
  "last_engine_return": {                      // the last `run`'s frozen report (or null)
    "exitReason": "clean", "unitsTotal": 1, "unitsCompleted": 1,
    "unitsResidual": 0, "budgetSpent": 0, "truncationLog": []
  },
  "status": "planning"   // planning | awaiting-approval | running-ready | running |
                         // awaiting-signoff | blocked | done | aborted
}
```

Write it at each transition: `start` initializes `task`/`workingDir`/`status:
planning`; GATE 2 approval writes `master_plan_path`/`units`/`status:
running-ready`; each `run` writes `last_engine_return` and, on a signed-off clean
unit, advances `current_unit`; a blocking exit sets `status: blocked`; all units
clean sets `status: done`.

## `status` (read-only)

Read `run.json` and render a compact card — spawn nothing, mutate nothing:

```
phasing-flow · <task>
  plan:    <master_plan_path basename>   (<units.length> unit(s))
  cursor:  unit <current_unit+1>/<units.length>
  last:    <last_engine_return.exitReason> — <completed>/<total> units
  status:  <status>
```

If there is no `run.json`, say so and offer `start`.

## `resume`

In a fresh session:
1. Read `run.json`. If absent → no run to resume; offer `start`.
2. Re-ground: read `master_plan_path` (the approved plan) + `last_engine_return`.
3. Re-enter the loop at the right point by `status`:
   - `running-ready` / `running` / `blocked` → re-render the situation and proceed
     to `run` (or to GATE 3 if a `run` already returned and is awaiting sign-off).
   - `awaiting-approval` → re-render GATE 2 from the plan.
   - `done` / `aborted` → report; nothing to resume.
4. Continue from `current_unit`. The Workflow journal also supports same-session
   continuity; the manifest is the cross-session re-grounding anchor.

This is `phasing`'s file-based state discipline, made minimal and native — enough
to answer "where am I?" and "pick up where I left off," nothing more.
