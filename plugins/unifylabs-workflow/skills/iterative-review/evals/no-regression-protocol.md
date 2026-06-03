# M1 no-regression trust gate — two-tier protocol

This is the binding **M1→M2 trust gate** (design §12, §14 #3): before the M2
`phasing-flow` engine is built, the M1 enforced `iterative-review` loop must show
its verification quality on the frozen code-mode benchmark is **≥ the human-gated
baseline**. The gate has two tiers. **Tier-1 alone does NOT discharge it.**

| Tier | What | Where it runs | Discharges the gate? |
|------|------|---------------|----------------------|
| **Tier-1** | Offline scorer correctness — `run-no-regression-eval.mjs` re-derives `baseline.json` from the committed transcripts, and its matching/normalization/RED tests pass. | CI (`no-regression-harness`), every push. | **No.** It proves the *scorer* is sound, not that the *engine* doesn't regress. |
| **Tier-2** | Live, human-witnessed — the real engine reviews the benchmark **N≥3** times; worst-of-N Critical-recall ≥ baseline; + the security live witness; + **Tomer sign-off**. | A live Claude session (needs `claude` + credentials — cannot run on a CI runner). | **Yes**, with sign-off. |

## The objective PASS criteria (computed by the scorer)

```
worst-of-N Critical-recall  ≥  baseline worst-run Critical-recall (2/3)
AND  every run surfaces ≥1 Critical            (no false-clean / skip-if-clean)
AND  worst-of-N critical false-positives  ≤  baseline (0)   (precision not regressed)
```

`Tomer sign-off` is the human half and is **not** computed by the scorer — the
scorer emits the objective verdict; the human confirms the runs were faithful
(no peeking at `gold-findings.json`, real engine, real fixture).

## The load-bearing scorer detail (do not "fix" this away)

Reviewers cite findings by the line number of the `+` line in the **diff text**
(`task-diff.fixture`). Gold lines are **post-image source lines**. The scorer
normalizes `source = cited − hunkStartLine(file)` before the ±3 match
(`hunkStartLine` = the fixture-text line of that file's `@@` header: 24 / 81 /
128 for discount-engine / checkout / currency). A naive raw compare floors
recall at 0. This is verified in CI by the self-test reproducing `baseline.json`.

**Live-run citation convention (required):** instruct the live reviewer to cite
each finding by `<file>:<N>` where **N is the absolute line number in the diff
text it was handed** (the same convention the baseline reviewers used). This
keeps the scorer's single normalization correct. If a future runner captures the
engine's own post-image source lines instead, the capture step must add the
offset back, or the scorer must be told the coordinate space — do not silently
mix conventions.

## Tier-2 live procedure (the gated, witnessed half)

Run in a live session, with Tomer present, after the autonomous machinery is
landed and CI-green. Keep all work on PR #52; `main` only changes on merge.

1. **Drive the engine N≥3 times.** For each run `k` (k = 1..N, N≥3), run the
   committed engine bundle via the Workflow tool against the benchmark fixture,
   in `code` mode, with a fresh review fan-out each time:
   - `scriptPath`: `skills/iterative-review/workflow/iterative-review.workflow.mjs`
   - `args`: `{ target: <the task-diff.fixture path>, mode: 'code', runId: 'noreg-<k>' }`
     (run-ids/timestamps come from `args` — never generated in-script; the
     Workflow VM disables wall-clock/RNG).
   - The reviewer fan-out MUST be handed `task-diff.fixture` as "the diff under
     review" and MUST NOT be shown `gold-findings.json` or any `gold-*` file.
   - Use the citation convention above.
2. **Capture each run's findings** into a transcript file the scorer can read —
   either a JSON array `[{file, line, severity}|{file, line, score}]` or a
   markdown table with `File | Line (cited) | Severity` columns (the
   `baseline-transcripts/run-N.md` shape). One file per run.
3. **Score:** `node run-no-regression-eval.mjs <dir-or-files...>`. Exit 0 = the
   objective PASS criteria are met; exit 1 = a regression (the printed reasons
   say which: recall / false-clean / precision).
4. **Witness + sign-off.** Tomer confirms the runs were faithful and signs off.
   Record the verdict + the N transcript files + the sign-off as the gate
   evidence (committed under this dir or linked from the P6 close-out).

## Security Tier-2 (bundled into this live phase, per P4)

P4 proved the canonical `file-guard` path live (a Workflow-spawned `agent()`'s
`.env` Write was hard-blocked, un-fakeable) and pinned all 7 verbatim hooks via
the Tier-1 `test-security-hooks.sh` harness. The **formal witnessed Tier-2** that
GitHub Actions cannot run (no `claude` on the runner) is captured here:

- A live run where a loop-spawned **fixer** agent attempts a guarded write (e.g.
  a `.env` / secret-bearing Edit) and is **blocked by `file-guard`**, AND
  `output-secrets-scanner` **fires** on a secret in agent tool output.
- Capture the filesystem/transcript evidence (the guarded file never hit disk; a
  control write in the same dir succeeded) as a committed artifact + Tomer
  sign-off. `dangerous-actions-blocker` (the Bash path) is not live-fired (no
  safe non-destructive command matches it); its coverage rests on Tier-1 + the
  proven "PreToolUse hooks fire on Workflow subagent tool calls" mechanism.

## Files

- `run-no-regression-eval.mjs` — the scorer (Tier-1 CI + Tier-2 scoring CLI).
- `run-no-regression-eval.test.mjs` — the scorer's `node --test` suite.
- `benchmark/` — the frozen fixture, hidden gold, baseline, and transcripts
  (see `benchmark/README.md`; **do not edit to fix a failing run** — a
  regression is a signal).
