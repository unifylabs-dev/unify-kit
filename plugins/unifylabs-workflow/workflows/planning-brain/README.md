# planning-brain — the M2 planning-brain seed

A reusable, self-contained, importer-free **Workflow seed** for the
twice-dogfooded *planning brain* pattern. This is the **M2 seed**: a neutral
staging home for the pattern, committed exactly the way `iterative-review`
commits its enforced loop — a tested `.mjs` source of truth, a deterministic
bundler, a committed self-contained bundle, and CI parity + no-import +
tracked-file guards. It is **not** yet a skill, command, or hook (no count
ripple); M2 lifts it under the `phasing-flow` skill and wires `/phasing-flow
plan`.

## The pattern

```
Ground   parallel scout agents read repo/task state into structured briefs
   |
Plan     parallel angled planners over an ANGLES table — each a different lens
   |
Critique ONE adversarial critic reads ALL surviving plans, hunting gaps /
   |     edge-cases / gaming
Judge    synthesizes ONE master plan, incorporates the critic's fixes, and
         surfaces open_decisions_for_human as {decision, options, recommendation}
         triples
```

The judge output is handed to the **human gate** (the orchestrator approves).
`main()` returns a frozen:

```js
{ master_plan, critique, angled_plans, ground_briefs?, scout_count }
```

`ground_briefs` is present only when the Ground stage ran (it is opt-out via the
`ground` input).

The stage shape + the `ANGLES` idiom are copied from the planning brain that was
dogfooded this session (the Stop-hook design run: 3 angled planners via
`parallel()` -> adversarial critic -> judge). What is *new* here is the
**lean-schema discipline** (below) applied throughout, plus the Ground stage and
the salvage chokepoint hardened into a tested kernel.

## Files

| File | Role |
| --- | --- |
| `lib/planning-core.mjs` | **PURE** logic: the `ANGLES` table, planner-spec construction, the `.filter(Boolean)` salvage, lean critic/judge input assembly, ground-brief aggregation, the frozen result builder. No `agent()`/`parallel()`/`Date`/random. snake_case keys only. Unit-tested. |
| `wrapper.mjs` | **INJECTION-BASED** orchestrator. `runPlanningBrain({ task, facts, plansDir, runScouts, runPlanners, runCritic, runJudge, log })` takes every effectful step as an injected async callback, so it is unit-testable with stubs. No `agent()`/`parallel()` here. |
| `src/glue.mjs` | The **ONLY** file touching runtime globals. Holds `export const meta` + the `agent()`/`parallel()` dispatch that supplies the injected callbacks (scouts + planners via NATIVE `parallel()`; critic + judge via `agent()`), plus the LEAN per-stage schemas. |
| `build-workflow.mjs` | The **DETERMINISTIC** bundler. Fixed `SOURCES` order, strips every `import`/`export`, hoists `meta` to the top, no timestamps/random => byte-identical idempotent output. Exports `buildBundle()`; writes only when invoked directly. |
| `planning-brain.workflow.mjs` | The **GENERATED** self-contained bundle (`DO NOT EDIT`). `meta` first; **zero** import lines. This is the script the Workflow tool runs. |
| `test/*.test.mjs` | Bare `node:test` (zero-dep). Guards the pure logic + the injection wrapper with stubs. |

## Lean-schema discipline (bake this in)

This session a planning brain **failed**: the planners used a ~14-field nested
schema with a hyphenated key and never called `StructuredOutput`, so they
returned `null` and the run collapsed. The discipline that prevents recurrence:

1. **Planner schemas are LEAN + flat-ish** — few required fields, shallow
   nesting. See `PLAN_SCHEMA` in `src/glue.mjs`: 5 fields, 3 required.
2. **snake_case keys ONLY, never hyphenated.** A hyphenated key cannot be a bare
   object property and was a direct cause of the null return. Enforced by a test
   (`ANGLES` keys match `/^[a-z][a-z0-9_]*$/`).
3. **Prefer file-writing/manifest agents for heavy content.** A planner writes
   the full plan body to disk under `plansDir` and returns a LEAN manifest
   (`plan_path` + a short summary + the load-bearing fields). The judge does the
   same via `master_plan_path`. The structured payload stays small.
4. **MANDATORY downstream salvage.** Planners may return `null` ->
   `salvagePlans()` does `.filter(Boolean)` -> the critic (lean) sees only
   survivors -> the judge (lean) is **explicitly told** `some_planners_returned_nothing`
   so its prompt instructs the model to synthesize from whatever is present. This
   is encoded as a real unit test (`test/wrapper.test.mjs`: "SALVAGE: a
   null-returning planner does not crash …" and the all-null variant).
5. **Defensive accessors** when threading prior-stage output — every assembler in
   `planning-core.mjs` uses `?.` + `?? fallback`; a missing critique becomes `{}`,
   a missing salvage becomes an empty plan list, never a throw.

## What the tests guard (and what they cannot)

CI **cannot** test planning *quality* — that needs a live model and is the
human/live eval. The committed tests guard **WIRING + salvage + determinism**
only:

- planner-spec construction from `ANGLES`;
- **SALVAGE** — inject planners where some return `null`; the wrapper still runs
  the critic + judge on the filtered set and does not crash;
- the judge receives **ALL** surviving plans **+** the critic output;
- **PLANTED-GAP WIRING** — a critic stub flags a specific gap; the judge stub
  receives that finding (critic findings flow structurally to the judge);
- the Ground stage is optional and scout briefs surface in the result;
- the frozen result shape + the required-callback guards.

## The no-import / bundle constraint

The Workflow runtime is a sandboxed `runInContext` VM with **no module loader** —
a Workflow script **cannot** `import`. So the tested kernel
(`lib/planning-core.mjs` + `wrapper.mjs`) and the agent-backed glue
(`src/glue.mjs`) are **inlined** into one self-contained bundle by
`build-workflow.mjs`. The `.mjs` sources are the single tested source of truth;
the bundle is generated.

Determinism contract: a fixed hand-authored `SOURCES` order, every `import`/`export`
stripped, `meta` hoisted first, **no** timestamps / random / wall-clock. Identical
sources => byte-identical output. The CI `planning-brain-harness` job regenerates
the bundle and `git diff --exit-code`s it, so a stale bundle (which would ship
untested code) fails the gate.

## Invocation (via Workflow `scriptPath`)

The bundle is run by the Workflow tool against `planning-brain.workflow.mjs`.
Declared inputs (see `meta` in `src/glue.mjs`):

| input | type | default | meaning |
| --- | --- | --- | --- |
| `task` | string | *(required)* | the task statement / one-liner to plan |
| `facts` | string | — | caller-supplied ground-truth brief |
| `plansDir` | string | — | where manifest planners write heavy plan bodies |
| `ground` | boolean | `true` | run the parallel scout Ground stage (opt-out) |
| `scouts` | number | `2` | how many scout agents to fan out |

## Regenerate the bundle

```bash
node build-workflow.mjs          # writes planning-brain.workflow.mjs
node --test test/*.test.mjs      # zero-dep test suite
node --check planning-brain.workflow.mjs
```

(Use Node 20+; CI pins Node 20.)

## How M2 lifts this seed

M2 relocates this directory under the `phasing-flow` skill and wires the
`/phasing-flow plan` command surface to it (at which point the skill/command
counts ripple — not here). The seed's contract — Ground -> Plan -> Critique ->
Judge with the lean-schema discipline and the salvage chokepoint — is what M2
builds the human-gated planning step on. Until then this lives in the neutral
`plugins/unifylabs-workflow/workflows/` staging home and ships no consumer
surface.
