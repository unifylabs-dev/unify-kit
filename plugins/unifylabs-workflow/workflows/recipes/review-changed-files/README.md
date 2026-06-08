# review-changed-files — a `/workflow-library` reference recipe

A reusable, self-contained, importer-free **Workflow recipe** that reviews a git
diff across N dimensions in parallel, reaches **Critical-precision consensus**, and
**adversarially verifies** each confirmed Critical. It is the first entry in the
kit's [`/workflow-library`](../../../../../docs/workflow-library.md) and a worked
example of the ADR-0003 committed-seed contract.

**READ-ONLY:** every agent is instructed to review, never edit/stage/commit/push;
the recipe writes nothing to the working tree.

## The pattern it teaches

```
Review    parallel() one reviewer per DIMENSION over `git diff <range>`
   |      (a BARRIER — consensus needs every reviewer's findings together)
Consensus a Critical survives only if >= critVotes DISTINCT reviewers tier a
   |      Critical within +/- tolerance lines (else demote to important); dedup
Verify    parallel() — adversarially try to REFUTE each confirmed Critical
   |      (fail-OPEN: a thrown/null verdict keeps the finding, never hides it)
Report    a frozen {findings_total, by_severity, criticals_confirmed, ...}
```

This is the canonical "review changed files across dimensions, then verify" shape
from the Workflow tool docs, hardened with the kit's proven consensus discipline
(the same `critVotes>=2 within +/-tolerance` rule that
`iterative-review`'s `consensus-aggregate` uses) — re-expressed **recipe-locally**
(`lib/consensus.mjs`) so the recipe is copy-pasteable without depending on an
internal kit lib.

## Run it

```bash
# Review the last commit (default range):
#   Workflow({ scriptPath: ".../review-changed-files.workflow.mjs" })
#
# Review a specific range / staged changes:
#   Workflow({ scriptPath: ".../review-changed-files.workflow.mjs",
#              args: { diffRange: "origin/main...HEAD" } })
#   Workflow({ scriptPath: ".../review-changed-files.workflow.mjs",
#              args: { diffRange: "--cached" } })
```

**JSON args:**

| arg | default | meaning |
| --- | --- | --- |
| `diffRange` | `HEAD~1...HEAD` | the literal range passed to `git diff <range>` |
| `dimensions` | correctness / security / error_handling | `[{key,lens}]` — one reviewer per entry |
| `critVotes` | `2` | distinct reviewers required to keep a Critical |
| `tolerance` | `3` | ± line window for "the same Critical" |
| `workingDir` | (cwd) | run the reviewers against a specific checkout |

## Proven live

Run **`wf_3c45b7ca-f8c`** (M4 exit proof): 8 agents (3 reviewers → consensus → 5
critical verifiers) over a staged target with planted issues → **11 findings, 5
Criticals confirmed** (e.g. RCE via `eval`, an unguarded `JSON.parse` throw, a
null-deref, a hardcoded `sk-live-` secret), each **adversarially verified as real**
(`refuted:false`); the `eval` line reached Critical only because two dimensions
independently flagged it (consensus working). Zero working-tree mutation.

## Files (the ADR-0003 seed RIG)

| File | Role |
| --- | --- |
| `lib/consensus.mjs` | **PURE** kernel: `toFiniteLine` / `canonicalKey` / `normalizeFinding` / `consensusAggregate` / `buildReport`. No `agent()`/`parallel()`/`Date`/random. Unit-tested + RED-guarded. |
| `src/glue.mjs` | The **ONLY** file touching runtime globals: `export const meta` (pure literal) + the `parallel()`/`agent()` orchestration + `main()`. |
| `build-workflow.mjs` | The **deterministic** bundler (strips imports, hoists `meta`, appends `return await main(args)`; byte-identical idempotent). |
| `check-bundle.mjs` | Runtime-shape validator (replaces `node --check`: import-free, meta-first pure literal, entrypoint present, parses as the runtime runs it). |
| `review-changed-files.workflow.mjs` | The **GENERATED** self-contained bundle (`DO NOT EDIT`) the Workflow tool runs via `scriptPath`. |
| `test/consensus.test.mjs` | Zero-dep `node:test` (16 cases, red-capable) over the pure kernel. |

Regenerate the bundle: `node build-workflow.mjs` (CI parity-guards it is fresh).
