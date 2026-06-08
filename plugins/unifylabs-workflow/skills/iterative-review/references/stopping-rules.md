# Stopping rules — now ENFORCED IN CODE

The five stopping rules are **enforced in code**, not in this prose. The single
source of truth is:

- `workflow/stopping-engine.mjs` (+ the helpers under `workflow/lib/`) — the
  loop-until-dry kernel, the severity tiers, the exit-precedence ladder, and the
  frozen exit-reason vocabulary.
- `workflow/test/stopping-engine.test.mjs`, driven from
  `workflow/evals/loop-control-evals.json` — the eval-driven tests that pin the
  behavior.

**This file no longer carries authoritative numeric thresholds or pseudocode.**
Do not re-introduce caps, comparison expressions, or rule blocks here — if you
need the exact rule, read the engine. What follows is a human-orientation
summary of *what* the five rules are, so a reader knows which knob is which
before opening the code.

## The five rules (what they are)

1. **Skip-if-clean** — a pre-loop gate. If the initial pass has nothing worth
   gating or auto-fixing, the loop is never entered (re-review is never called).
   This avoids the documented self-critique accuracy drop on already-clean
   output.
2. **Cap (max-rounds)** — a bound on how many rounds the loop may run, clamped to
   a hard ceiling. Diminishing returns past a few rounds make further iteration
   wasted work.
3. **Severity-gated halt** — Critical findings are *collected*, never fixed
   in-loop; once there is no productive auto-fix work left and only blocking
   findings remain, the loop hands them off rather than spinning.
4. **Fixed-point detection** — if the auto-fixable working set stops strictly
   shrinking (stall, set-swap, or oscillation), the loop is making no progress
   and exits.
5. **Token-budget circuit breaker** — a backstop that trips when cumulative
   spend crosses a multiple of the initial-review cost, so a runaway loop cannot
   burn unbounded tokens.

## New-model exit: `criticals-pending-gate`

Because a running Workflow takes no mid-run human input, Criticals are collected
rather than fixed in the loop. Residual blocking findings (Criticals always, plus
collected Important under `--gate-important`) are returned via the
**`criticals-pending-gate`** exit reason for the between-runs human gate. The full
frozen exit-reason set lives in `workflow/lib/exit-reasons.mjs`.
