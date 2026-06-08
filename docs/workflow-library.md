# Workflow Library

A curated catalog of reusable **Workflow recipes** — self-contained, importer-free
`.mjs` workflows you run via `Workflow({ scriptPath })`. Each recipe embodies the
kit's proven ADR-0003 committed-seed contract (a tested pure kernel + a deterministic
bundler + a CI-parity-guarded bundle), so a recipe is both a tool you can run today
and a worked example of how to build your own.

This catalog **is** the `/workflow-library` surface (shipped as docs + seed dirs, not
a slash command — see [ADR 0008](decisions/0008-m4-new-capabilities-recipe-and-routine.md)).
It was introduced in **M4** of the phasing-flow initiative.

## How recipes work

A recipe is a directory under `plugins/unifylabs-workflow/workflows/recipes/<name>/`
holding the ADR-0003 RIG:

- `lib/*.mjs` — the **pure** kernel (no `agent()`/`parallel()`/`Date`/random); unit-tested.
- `src/glue.mjs` — the **only** file touching runtime globals; carries a pure-literal `export const meta` + the orchestration + `main()`.
- `build-workflow.mjs` — the deterministic bundler (strips imports, hoists `meta`, appends `return await main(args)`).
- `check-bundle.mjs` — the runtime-shape validator (replaces `node --check`).
- `<name>.workflow.mjs` — the generated, committed, CI-parity-guarded bundle you run.
- `test/*.test.mjs` + `README.md`.

Run one:

```js
Workflow({ scriptPath: "plugins/unifylabs-workflow/workflows/recipes/<name>/<name>.workflow.mjs",
           args: { /* recipe-specific */ } })
```

## Recipes

| Recipe | What it does | Posture |
| --- | --- | --- |
| [`review-changed-files`](../plugins/unifylabs-workflow/workflows/recipes/review-changed-files/README.md) | Reviews a git diff across N dimensions in parallel, reaches Critical-precision consensus (≥2 reviewers within ±3 lines), then adversarially verifies each confirmed Critical. | **read-only** |

*(More recipes land here as they are added — the catalog grows without any
count/version ripple; each is a seed dir, not a skill or command.)*

## Routines

A **routine** is the scheduled, **detect-and-report-only** maintenance tier — a cloud
agent (claude.ai) that runs a prompt on a cron and reports to a human, never mutating
the repo. Routines are per-repo and authenticated, so the kit ships them as
**recipes you register in your own repo** (not pre-installed).

| Routine | What it detects | Posture |
| --- | --- | --- |
| [`doc-freshness`](../plugins/unifylabs-workflow/workflows/routines/doc-freshness/README.md) | Accumulated drift between code and the living-doc set (count drift, ADR-index gaps, empty `[Unreleased]`, undocumented skills, docs lagging churn) + judgment-based citation/architecture-lag checks. | **detect-only (never mutates)** |

## Worked examples — the internal seeds

The phasing-flow initiative's own machinery is built on the same ADR-0003 contract.
Read these as fuller, production examples of the recipe pattern (they are wired to
skills, not standalone recipes, but the RIG is identical):

- **`planning-brain`** (`plugins/unifylabs-workflow/workflows/planning-brain/`) — parallel ground scouts → angled planners → adversarial critic → judge. The multi-agent planning pattern.
- **`phasing-flow` engine** (`plugins/unifylabs-workflow/skills/phasing-flow/workflow/`) — an enforced serial execution loop with fail-closed verify + fail-open consensus diff-review.
- **`integrate-branch` audit** (`plugins/unifylabs-workflow/skills/integrate-branch/workflow/`) — a typed `parallel()` over 6 weighted review dimensions reduced by a pure kernel.

## Add your own recipe

1. Clone the cleanest RIG (`recipes/review-changed-files/` for a read-only fan-out,
   or `skills/integrate-branch/workflow/` for a weighted reduce).
2. Replace `lib/*` with your pure kernel, `src/glue.mjs` with your orchestration.
3. `node build-workflow.mjs` → commit the bundle; `node check-bundle.mjs <bundle>` +
   `node --test` must pass.
4. Add a CI harness job mirroring the existing seed harnesses (node:test + bundle
   parity + a RED self-test), and a row in this catalog.
