# P6 live gate — evidence (objective half)

The binding M1→M2 no-regression trust gate (design §12, §14 #3;
`../no-regression-protocol.md`) has two halves. This directory records the
**objective half** — the live, real-engine runs and their scorer verdict. The
**human half** (the formal security Tier-2 witness + Tomer sign-off) is NOT yet
recorded here; see "Pending" below.

## What ran

The **committed** `../../workflow/iterative-review.workflow.mjs` bundle was driven
**N=3** times via the Workflow tool (`scriptPath`) against the frozen code-mode
fixture (`../benchmark/task-diff.fixture`), in `code` mode, `gateImportant: true`
(so the loop collects the Criticals and exits `criticals-pending-gate` rather than
auto-fixing on a tree the fixture isn't applied to). Each run did a fresh fan-out
of the 6 `pr-review-toolkit:*` reviewers, consensus-aggregated (≥2 votes within ±3
lines), and returned its initial findings. Reviewers were handed only the fixture
(isolated copy — `gold-findings.json` not reachable) and cited by the diff-target
path (`+++ b/<file>`).

- `runs/run-1.json` — run `noreg-f1` (`wf_140af6b8-6a1`)
- `runs/run-2.json` — run `noreg-f2` (`wf_d01d80eb-5ce`)
- `runs/run-3.json` — run `noreg-f3` (`wf_52b9fa4b-fab`)
- `runs/verdict.txt` — captured scorer output

Earlier live runs proved the bundle executes end-to-end on the real runtime
(`wf_96c7adc7-bde`) and surfaced a real intermittent precision bug — when reviewers
cited the *patch container* path instead of the diff target, ≥2 agreeing reviewers
made a container-path Critical survive consensus and register as a critical
false-positive (worst-of-3 FAIL). Fixed in `6bd503f` (cite the `+++ b/<file>`
target); these N=3 runs are post-fix on the committed bundle.

## Verdict (objective)

```
node ../run-no-regression-eval.mjs runs
verdict: PASS — worst recall 0.6667 (= baseline 2/3), worst fp 0 (= baseline 0)
```

Every run: Critical-recall 2/3 (`gf-null-deref-critical` + `gf-currency-critical`;
the score-~88 borderline `gf-borderline-critical` is uniformly under-called to
Important, exactly as the human baseline does — recall rides the floor, does not
regress), 0 critical false-positives, ≥1 Critical (no false-clean). Re-runnable:
`node ../run-no-regression-eval.mjs runs` exits 0.

## Pending (human half — does NOT pass on a CI runner; needs a witnessed session)

- **Security Tier-2** — a live run where a loop-spawned fixer attempts a guarded
  write (e.g. `.env`) and is hard-blocked by `file-guard`, AND
  `output-secrets-scanner` fires on a secret in agent output. (P4 already proved the
  canonical `file-guard` path live; this is the formal witnessed capture.)
- **Tomer sign-off** — confirming the runs were faithful (real engine, real fixture,
  no peeking at gold). The scorer emits the objective verdict; the human confirms.
