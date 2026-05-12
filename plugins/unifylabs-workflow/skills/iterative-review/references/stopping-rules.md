# Stopping rules — the "balance" knob

Five layered rules. ANY rule firing exits the loop. They are not mutually exclusive — multiple may fire on the same iteration.

## 1. Skip-if-clean (pre-loop gate)

After the initial review pass, BEFORE entering the loop:

```python
if len(Critical) == 0 and len(Important) == 0:
    emit_clean_report(suggestions=Suggestions)
    EXIT
```

**Why:** Snorkel benchmarked Claude Sonnet 4.5 forced to self-critique already-correct output. Accuracy dropped from 98.1% to 56.9% (-41.2pt). Forcing review on clean output makes it worse. This guard prevents that failure mode.

**Override:** `--no-skip-clean` exists but warn the user before proceeding.

**Exit code:** `skip-if-clean` or `clean` (whichever is more accurate; treat as semantically equivalent).

## 2. Iteration cap (default 3, max 5)

```python
if iteration_n > cap:
    emit_residual_report()
    EXIT
```

**Why:** Literature consensus on diminishing returns:

- Self-Refine: plateau by iteration 3
- LangGraph reflection: default 3 cycles
- Reflexion reference implementation: `MAX_ITERATIONS = 5`
- CodeRabbit: 2 passes then stop on nits

Past 5 is almost always wasted tokens with no marginal value.

**Override:** `--cap N` with `N ∈ [1, 5]`. Hard ceiling at 5.

**Exit code:** `cap`.

## 3. Severity-gated halt (no Critical left)

```python
if len(critical_findings_this_iter) == 0:
    emit_clean_report()
    EXIT
```

**Why:** Critical = must-fix-before-ship. If there are none, the loop's purpose is met. Important findings may still exist but they're not blocking.

**Behavior:** This check runs AFTER the re-review in step 5g of the main loop. Important findings remaining do NOT keep the loop running — they go into the final report's "Residual" section if not auto-fixed this iteration.

**Exit code:** `clean`.

## 4. Fixed-point detection (no progress)

```python
if len(critical_n) >= len(critical_n-1):
    # Our fixes didn't shrink the Critical set. We're stalled.
    emit_residual_report()
    EXIT
```

**Why:** The "always finds something different but never resolves anything" failure mode. If iteration N didn't strictly shrink the Critical set, we're stuck. The fixes either didn't address the real issue or they introduced new issues at the same rate.

**Detail on the comparison:**

- The expected behavior is `len(critical_n) < len(critical_n-1)` — strict shrinkage.
- If `len(critical_n) == len(critical_n-1)`, no progress was made. EXIT.
- If `len(critical_n) > len(critical_n-1)`, fixes introduced new Criticals. EXIT immediately (clearly making things worse).

**Edge case:** If the SET of findings differs (same count, different items), that's also stalled — we're swapping one Critical for another. Use set-based comparison after the count check:

```python
canonical = lambda f: hash((f.severity, f.description[:80]))
prev_set = {canonical(f) for f in critical_n_minus_1}
curr_set = {canonical(f) for f in critical_n}

if len(curr_set) >= len(prev_set) and not curr_set.issubset(prev_set):
    # Same or larger set with at least one NEW Critical → stalled.
    EXIT
```

**Exit code:** `fixed-point`.

## 5. Token budget circuit breaker (5× backstop)

```python
if cumulative_tokens > 5 * initial_review_tokens:
    emit_budget_exceeded_report()
    EXIT
```

**Why:** Folklore threshold from agentic-loop practitioners. Reference: RelayPlane (2026) reported $24 for a 100-iteration GPT-4o runaway loop. The 5× heuristic is the rough point where the marginal cost of another iteration exceeds plausible marginal value.

**Detail:** Track tokens via session metadata. If the Anthropic SDK usage field is available, use it. Otherwise estimate: `cumulative_tokens ≈ sum(prompt_chars + completion_chars) / 4`.

The "initial review tokens" reference is the cost of Step 3 (Initial review pass). Capture it once and use as the baseline.

**Exit code:** `circuit-breaker`.

## Exit-code reference

| Exit code | Reason |
|-----------|--------|
| `skip-if-clean` | Pre-loop: no Critical and no Important findings |
| `clean` | No Critical findings remaining after fix pass |
| `fixed-point` | Critical set didn't shrink between iterations |
| `cap` | Hit iteration cap (default 3, max 5) |
| `circuit-breaker` | Cumulative tokens exceeded 5× initial-review cost |
| `aborted` | User aborted at a GATE (any AskUserQuestion with abort option) |

The final report MUST include the exit code on its first line.

## Ordering of checks within one iteration

For each iteration N, evaluate in this exact order:

1. **Start of iteration:** check rule 5 (circuit breaker). If tripped → EXIT.
2. **Categorize findings (5a).** (No exit check here.)
3. **GATE Critical (5b).** If user aborts → EXIT with `aborted`.
4. **AUTO Important (5c).** (No exit check here.)
5. **Dispatch fixers (5e).** (No exit check here.)
6. **Run verifier (5f).** If verifier permanently fails (after one auto-fix retry and user opts to abort) → EXIT with `aborted`.
7. **Re-review (5g).** Compute new Critical set.
8. **Fixed-point check (rule 4).** If tripped → EXIT.
9. **Clean-exit check (rule 3).** If tripped → EXIT.
10. **Cap check (rule 2).** If N == cap → EXIT.
11. Otherwise increment N, loop back to step 1.

This ordering ensures we never enter a costly fixer step when a cheap rule should have already exited.
