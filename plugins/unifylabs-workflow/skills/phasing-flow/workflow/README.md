# phasing-flow execution engine (M2 D1)

The committed, importer-free Workflow seed the `phasing-flow` skill runs to
**execute an already-approved `units[]` plan**. It is the third instance of the
proven Workflow scriptPath contract (ADR 0003), after `iterative-review` and
`planning-brain`, and it **runs live** (smoke `wf_ddbd2cbb-581`, 2026-06-05:
`exitReason: clean`, 1/1 units, executor created the file + captured its diff,
the deterministic verifier ran `make test`, and 2 adversarial reviewers
consensus-reviewed the diff).

## The loop

For each approved unit, in order (M2: single-unit serial; the kernel supports
N and runs them one at a time — M3 adds native `parallel()` fan-out + worktree
isolation):

```
executeUnit  ──▶ verify (deterministic, AUTHORITATIVE)  ──▶ diffReview (adversarial)
   │                  │  'fail-permanent'/throw/unknown -> aborted        │ consensus >=2
   │ null/throw       │  'fail' (RED) -> criticals-pending-gate           │ to RAISE; fail-OPEN
   ▼ -> aborted       ▼  'pass' -> continue                               ▼ -> criticals-pending-gate
```

Exit is one of the **frozen 7** reasons (`lib/exit-reasons.mjs`), routed through
`make-return` + `assertExitReason` so a novel/silent stop is impossible:
`clean` · `criticals-pending-gate` · `aborted` · `circuit-breaker` · `cap` ·
`skip-if-clean` (· `fixed-point` reserved for M3 — see below).

A blocking finding (RED verify or consensus-Critical diff) **stops the whole
loop at that unit** and hands off to the between-runs human gate — you cannot
proceed until the human resolves it (the gates-between-runs control model: a
running Workflow takes no mid-run input).

**Fail direction (hardened by the P-A adversarial review, `wf_0cf2db43`):** the
authoritative deterministic verify fails **CLOSED** (a throw / permanent failure
/ unrecognized verdict → `aborted`, never silently passes); the non-authoritative
adversarial diff-reviewer fails **OPEN** (a throw / non-finite return → 0, never
blocks — the deterministic verify is the real gate). Every degraded path is
logged to `truncationLog`.

## Layout

```
workflow/
  lib/                  # 7 generic modules COPIED VERBATIM from iterative-review
    exit-reasons.mjs    #   (CI byte-identity diff-guarded — single source of truth,
    clamp.mjs           #    NOT a cross-seed bundle import)
    canonical.mjs
    make-return.mjs
    budget-guard.mjs
    verifier-detect.mjs
    consensus-aggregate.mjs
  verify-verdict.mjs    # pure: per-unit signals -> a frozen exit reason
  execution-engine.mjs  # pure: the serial loop over injected callbacks + ceilings
  wrapper.mjs           # pure: orchestration -> the frozen units-domain report
  src/glue.mjs          # the ONLY runtime-touching file (agent/parallel/log/budget)
  build-workflow.mjs    # deterministic bundler (inlines kernel+glue, strips imports)
  check-bundle.mjs      # runtime-shape validator (wrap-parse; NOT node --check)
  phasing-flow-engine.workflow.mjs   # the committed, generated bundle
  test/                 # node:test over the pure kernel (red-capable)
```

Only `src/glue.mjs` touches `agent()`/`parallel()`/`log`/`budget`; everything
else is pure and `node:test`-covered.

## Args

`args` arrives as a JSON string (the bundle's `main()` parses it):

| field | required | default | meaning |
|-------|----------|---------|---------|
| `units` | ✅ | — | ordered `[{ id, title, instruction, verify_hint? }]` |
| `workingDir` | | `(current)` | where units execute + the verifier runs |
| `cap` | | all units | max units to process; clamped to `[1, units.length]` |
| `diffReviewers` | | `2` | adversarial reviewers per diff (≥2 so consensus ≥2 is meaningful) |

The engine **never invents work** — it executes exactly the `units[]` the
orchestrator SKILL hands it (sliced from the human-approved master plan).

## fixed-point is NOT wired in M2 (deferred to M3)

The P-A adversarial review found a Set-based fixed-point stall ceiling is
**premature for M2's serial model**: a strictly-advancing cursor cannot stall,
and keying the remaining-unit set by `(id,title)` false-positives on legitimately
distinct units that share a label (dropping real work). So M2 bounds the loop by
the unit count + the `cap` ceiling, and `fixed-point.mjs` / `unit-cursor.mjs` are
**absent** (the copied-lib count stays 7, with `verifier-detect` in place of
`fixed-point`). M3 — which adds `parallel()` fan-out + retries, where the cursor
can genuinely stall — reintroduces a stall guard then.

## Regenerate + validate

```sh
node build-workflow.mjs                       # regenerate the bundle (deterministic)
node check-bundle.mjs phasing-flow-engine.workflow.mjs   # runtime-shape validator
node --test                                   # the kernel suite (red-capable)
```

CI (`phasing-flow-engine-harness`) runs all of the above plus the copied-lib
byte-identity diff-guard, the bundle parity guard, an import-free assertion, and
a RED self-test (a disabled ceiling must turn the suite red).
