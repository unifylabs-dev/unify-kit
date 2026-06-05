# Planning-brain wiring (`/phasing-flow plan`)

`/phasing-flow plan` dispatches the **live planning-brain seed** to synthesize the
master plan, then renders its output for GATE 2. The seed runs IN PLACE at its
staging home (decision J1 — relocate under the skill is deferred to M3); do NOT
re-build or re-adapt it (it runs live, smoke `wf_3e271589-060`).

## Invoke

```
Workflow({
  scriptPath: "<plugin>/workflows/planning-brain/planning-brain.workflow.mjs",
  args: { task, facts?, plansDir?, ground?, scouts? }
})
```

| arg | required | default | meaning |
|-----|----------|---------|---------|
| `task` | ✅ | — | the agreed task to plan (from GATE 1) |
| `facts` | | — | a ground-truth brief (locked decisions, key files, constraints) so scouts + planners start from truth |
| `plansDir` | | — | a writable dir where planners + the judge write their full plan bodies (e.g. `<project>/.phasing-flow/plans`) |
| `ground` | | `true` | run the ground scouts (opt-out) |
| `scouts` | | `2` | scout count (3–4 for a flagship/cross-cutting task) |

`args` reaches the bundle as a JSON string; its `main()` parses it. Give a RICH
`facts` brief — the planners are only as grounded as what you hand + what the
scouts read.

The flow inside the seed: **Ground** (opt-out scouts) → **Plan** (3 angled
planners over `minimal_scope` / `robust_general` / `risk_provability`) →
**Critique** (1 adversarial critic) → **Judge** (synthesizes ONE master plan +
surfaces `open_decisions_for_human`). Mandatory salvage is baked in — a planner
that returns nothing is dropped; the critic + judge still run.

## ⚠️ The return NESTING (critic gap — read this)

The workflow returns:

```jsonc
{
  "master_plan": {                         // ← the gate fields are HERE, nested
    "master_plan_path": "…/MASTER-PLAN.md",
    "summary": "…",
    "steps": ["…", "…"],
    "incorporated_critic_fixes": ["…"],
    "open_decisions_for_human": [
      { "decision": "…", "options": "…", "recommendation": "…" }
    ]
  },
  "critique":     { … },
  "angled_plans": [ … ],
  "scout_count":  4,
  "ground_briefs": [ … ]                   // present only when ground ran
}
```

The fields GATE 2 renders — `summary`, `steps`, `open_decisions_for_human`,
`master_plan_path` — live **inside `result.master_plan.*`**, NOT as top-level
siblings of `{ master_plan, critique, angled_plans, scout_count }`. Gate-render
code that reads top-level `result.open_decisions_for_human` reads `undefined`.

## Render for GATE 2

1. Show `result.master_plan.summary` + the ordered `result.master_plan.steps`.
2. Note the heavy plan body is on disk at `result.master_plan.master_plan_path`
   (read it if the user wants the full detail).
3. Put EACH `result.master_plan.open_decisions_for_human` `{decision, options,
   recommendation}` to the user via `AskUserQuestion` (recommendation first, marked
   Recommended).
4. On approval, write `master_plan_path` to the manifest and slice
   `result.master_plan.steps[]` → `units[]` (see `engine-contract.md`).

If the user sends it back, re-invoke with refined `task`/`facts` (weave the
direction feedback in) — a new plan is the planning brain's job, not yours.
