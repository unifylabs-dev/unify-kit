# iterative-review — frozen code-mode benchmark

This directory is the permanent ground truth for the iterative-review
no-regression trust gate. It is **frozen**: do not edit the fixture, the gold
manifest, or the artifacts to "fix" a failing run — a regression is a signal,
not a chore. Treat any change here as a benchmark version bump.

## Files

| File | Role | Reviewer may see? |
|------|------|-------------------|
| `task-diff.fixture` | The unified git-diff under review (3 new Node source files with planted defects). | Yes — this is the input. |
| `gold-findings.json` | HIDDEN manifest of every planted defect with id/file/line/severity/score/why. | **No** — `DO_NOT_SHOW_TO_REVIEWERS: true`. |
| `clean-artifact.js` | Genuinely defect-free module. | Yes. |
| `unresolvable-artifact.js` | Design-level Critical that cannot be auto-fixed. | Yes. |
| `package.json` + `verify-clean.js` | Detectable verifier (`npm test --silent`) so code mode exercises verifier-detection. | Yes. |

## What each artifact asserts

- **`task-diff.fixture`** — the review pass must catch the planted Criticals
  and Importants and surface (not auto-fix) the Suggestion. Severity must match
  `gold-findings.json` per the 0-100 scale in `references/severity-policy.md`
  (>=90 Critical, 80-89 Important, <80 Suggestion).
- **Severity calibration probe** — exactly one planted defect sits at score 90,
  the Critical floor. A reviewer who rounds it down to Important is
  mis-calibrated; the gold manifest flags it `is_borderline: true`.
- **Skip-if-clean must NOT trip on the diff** — the planted Criticals span two
  files (`src/discount-engine.js` and a SEPARATE `src/currency.js`). A lazy
  review that skims one file and declares the diff clean fails the benchmark.
- **`clean-artifact.js`** — skip-if-clean MUST fire: zero Critical, zero
  Important. Entering the fix loop on this file is a regression (the Snorkel
  41pt self-critique accuracy drop).
- **`unresolvable-artifact.js`** — the Critical must GATE and remain in the
  Residual / criticals-pending section. An automated fixer that "resolves" the
  idempotency design without escalating to a human is wrong.

## Verifier

`package.json` declares a `test` script, so `references/verifier-detection.md`
resolves the verifier to `npm test --silent` -> `node verify-clean.js`. It
exercises only `clean-artifact.js` and is fully deterministic (8 assertions, no
timestamps, no randomness). The planted-bug files in `task-diff.fixture` are
NOT applied to this directory, so the verifier stays green and the eval scores
review quality rather than bug application.

## Scoring a reviewer run

Match each caught finding to a gold finding by file + nearest line (±3) +
severity tier, per `gold-findings.json.matching_hint`. Full match = file+line+
tier; partial = file+line but wrong tier (caught-but-miscalibrated). Determinism
is mandatory: the fixture and manifest never change run-to-run.
