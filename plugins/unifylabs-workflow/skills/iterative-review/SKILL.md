---
name: iterative-review
description: >
  Iterative review-fix-verify loop for code, docs, and phasing-run artifacts.
  Runs review → fix → verify → re-review with severity-gated stopping: Critical
  always gates the user, Important auto-fixes by default (per-finding flip
  available), Suggestions surface in the report only. 3-iteration hard cap,
  skip-if-clean pre-gate (avoids the Snorkel self-critique 41pt accuracy drop),
  fixed-point early exit, 5× token-budget circuit breaker. Auto-detects mode:
  code (PR or local diff), doc (.md / .txt / .rst / specs/ / docs/), or phase
  (phasing-run deliverables vs. spec). In phase mode, plan-affecting findings
  flow through the existing handoff "Open questions for downstream" channel
  without modifying the locked master plan. Use when the user says
  "/iterative-review", "review and fix", "loop the review", "verify phase N
  output", "review the spec against the PR", or wants more than a one-shot
  review. Use proactively after `/pr-review-toolkit:review-pr` returns Critical
  findings or after a phasing phase completes and its deliverables need
  spec-conformance verification.
tags: [review, loop, phasing-integration, code-review, doc-review]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
  - Skill
---

# Iterative Plan-Aware Review

Review → fix → verify → re-review loop with bounded iteration. Replaces the brittle "run review again after fixes" pattern with explicit stopping rules. Plan-aware: when running inside a phasing run, plan-affecting findings flow back through the handoff Open-Questions channel without mutating the locked master plan.

## Invocation forms

| Form | Meaning |
|------|---------|
| `/iterative-review` | Auto-detect mode from cwd (see `references/modes.md`) |
| `/iterative-review <PR#>` | Code mode against a GitHub PR |
| `/iterative-review <path>` | Doc mode if `.md` / `.txt` / `.rst` / `.mdx`; otherwise code mode |
| `/iterative-review phase <run-id> <N>` | Phase mode — review phase N's deliverables against its spec |

Flags (optional; defaults match recommended behavior):

- `--include-suggestions` — surface Suggestion-severity findings in the loop (default: report-only)
- `--gate-important` — gate every Important finding instead of auto-fixing
- `--cap N` — override the 3-iteration cap (max 5)
- `--no-skip-clean` — disable the skip-if-clean pre-gate (NOT recommended — see Step 4)

## Architecture

```
detect mode → detect verifier → initial review pass
  → skip-if-clean? → EXIT clean
  → loop (max 3):
       categorize findings → GATE Critical → AUTO Important
       → dispatch fix subagents → run verifier
       → re-review (delta scope only)
       → fixed-point check → EXIT if stalled
       → no Critical left → EXIT clean
  → cap hit → EXIT with residual report
```

References (read these when the relevant step runs):

- `references/modes.md` — mode detection decision tree
- `references/verifier-detection.md` — per-ecosystem verifier discovery
- `references/severity-policy.md` — Critical / Important / Suggestion definitions and gating
- `references/stopping-rules.md` — skip-if-clean, fixed-point, cap, circuit breaker
- `references/phasing-integration.md` — Open-Questions write contract for phase mode
- `references/worktree-handling.md` — PR-mode worktree setup, push-back gate, cleanup

## Step 1: Detect mode

Run the decision tree in `references/modes.md`. Announce the detected mode and target in one sentence. If unclear, AskUserQuestion.

**PR-mode sub-step (phase association):** if mode resolves to code-PR, run the phase-association probe in `modes.md` §"Code mode — PR variant" before locking the mode. If a phase association is detected AND the user opts into phase-aware mode, load the associated run's master plan + phase spec + handoff context in addition to the PR diff. The loop then runs as PR mode with phase context — code-affecting findings fix in-loop, plan-affecting findings flow to the linked phase's Open Questions per `references/phasing-integration.md`.

## Step 2: Detect verifier

Probe the project root via `references/verifier-detection.md`. Surface the detected commands once via AskUserQuestion ("Use these, edit, or skip?"). Cache the chosen list in session memory for the loop's lifetime.

**Doc mode skips this step** — the verifier is the doc-consistency-check subagent (see Step 3).

## Step 3: Initial review pass

**PR-mode prelude (required before the review pass for code-PR mode):** create the isolated worktree per `references/modes.md` §"Code mode — PR variant" step 4. All subsequent file reads, Edits, and verifier runs in this loop happen INSIDE the worktree. Cache the worktree path in session state and use absolute paths under it for every tool call. Local-diff and single-file variants do NOT need a worktree — they run against the current working tree.

**Code mode (PR or local diff):**

1. Prefer: invoke `/pr-review-toolkit:review-pr` via the Skill tool. It already aggregates the 6 specialist agents. For PR mode, ensure the toolkit reads from the worktree path.
2. Fallback (if the toolkit is not installed): dispatch the agents directly via Agent — code-reviewer, silent-failure-hunter, pr-test-analyzer, comment-analyzer, type-design-analyzer, code-simplifier. Pass the worktree path explicitly.

**Doc mode:**

1. Read the target document.
2. Dispatch the doc-reviewer subagent. The prompt lives at `prompts/doc-reviewer.md` — Read it and pass its contents as the agent prompt along with the document.
3. Subagent returns findings with confidence ≥80, file:line refs, severity tags.

**Phase mode:**

1. Read `<run-id>/run.json`, `<run-id>/master-plan.md`, `<run-id>/phase-N-spec.md`, `<run-id>/phase-N-handoff.md` (if exists), and every deliverable file listed in the handoff.
2. Run code-mode review on code deliverables AND doc-mode review on the spec + handoff for internal consistency.
3. Aggregate findings; flag any whose root cause is the *spec* (not the code) — these route to the Open-Questions channel in Step 5e.

## Step 4: Skip-if-clean pre-gate

After Step 3, count findings:

```
if len(Critical) == 0 and len(Important) == 0:
    emit clean report (list Suggestions for awareness)
    EXIT
```

**Do not enter the loop.** Per Snorkel's published benchmark, forcing Claude Sonnet 4.5 to self-critique already-correct output dropped accuracy from 98.1% to 56.9% (-41.2pt). Skipping this guard makes clean output worse.

`--no-skip-clean` is available for power users but warn before proceeding.

## Step 5: Loop (max 3 iterations)

For each iteration, in this exact order:

### 5a. Categorize and present findings

Group by severity per `references/severity-policy.md`:

- **Critical (must gate):** N findings
- **Important (will auto-fix unless flagged):** N findings
- **Suggestion (report-only):** N findings

### 5b. GATE 1 — Critical findings

For each Critical finding, present via AskUserQuestion with options:

- **Fix** (default) — dispatch a fixer subagent
- **Skip** — acknowledge but don't fix this iteration
- **Edit suggestion** — user proposes an alternate fix

If the Critical list is short (≤3), offer a single "fix all Critical" bulk option.

### 5c. AUTO — Important findings

Default: queue all Important findings for auto-fix.

If `--gate-important` is set: treat each like Critical (AskUserQuestion per-finding).

Otherwise surface one AskUserQuestion before fixing: "Gate Important findings this iteration? (No = auto-fix all, Yes = gate all, Mixed = pick per-finding)". Default = No.

### 5d. Suggestions

Do NOT fix Suggestions unless `--include-suggestions` is set. They appear in the final report only.

### 5e. Dispatch fix subagents

For each accepted finding, dispatch a fixer via the Agent tool. The fixer prompt MUST include:

- The full finding (file, line, description, suggested fix)
- Relevant code/doc context (read the file first; pass excerpts)
- Constraint: fix ONLY this finding; do not refactor surroundings
- The verification step it must satisfy

Fixer-agent routing:

| Finding type | Fixer agent |
|--------------|-------------|
| Error handling | `silent-failure-hunter` (apply-fix mode) |
| Type design | `type-design-analyzer` (apply-fix mode) |
| General code quality | `code-reviewer` (apply-fix mode) |
| Comments | `comment-analyzer` (apply-fix mode) |
| Tests | `pr-test-analyzer` (apply-fix mode) |
| Doc findings | general-purpose Agent with doc-fixer instructions from `prompts/doc-reviewer.md` |
| **Plan-affecting (phase mode)** | NOT a fixer — write to handoff Open Questions per `references/phasing-integration.md` |

Run fixers in parallel when their target files don't overlap; serialize otherwise.

### 5f. Run verifier

Run the verifier commands from Step 2 in sequence. Halt on first failure.

On failure:

1. Read the failure output (last 50 lines).
2. Dispatch a root-cause-fixer subagent (general-purpose Agent) with the failure + this iteration's fixes.
3. Re-run the verifier ONCE.
4. Still failing: AskUserQuestion — "Verifier still failing. Continue iterating, abort, or escalate?"

### 5g. Re-review (delta scope only)

Re-review ONLY:

- Files touched by this iteration's fixes
- Files associated with any unresolved finding from prior iterations

Skip untouched files. This keeps each iteration cheap and prevents the "always finds something new" failure on stable files.

### 5h. Fixed-point check

After re-review, compute the Critical findings set. If `len(critical_n) >= len(critical_n-1)`:

- We're stalled (no shrinkage means our fixes aren't resolving anything).
- EXIT with `fixed-point` reason; surface residual.

### 5i. Clean-exit check

If `len(critical_n) == 0`:

- EXIT with `clean` reason; emit final report.

Otherwise, continue to iteration N+1 unless the cap is hit.

### Cap hit

After iteration 3 (or `--cap N`), exit with `cap` reason; surface residual findings without further fix attempts.

### Token budget circuit breaker

Track cumulative tokens used in this loop. If cumulative > 5 × initial-review-pass cost, exit with `circuit-breaker` reason immediately.

See `references/stopping-rules.md` for the full rule set and exit-code mapping.

## Step 6.5: Push-back gate (PR mode only)

If mode is PR (or PR + phase-context) AND fixes were applied to files inside the worktree, run this gate before the final report. Skip entirely if mode is not PR, or if no fixes were applied (skip-if-clean exit, all findings skipped, or fixed-point at iter 1).

1. **Summarize**: list the files modified in the worktree and the number of findings resolved (Critical + Important separately).
2. **AskUserQuestion**: "Loop applied N fixes in worktree at `<path>` on branch `<headRefName>`. What next?"
   - **Push to PR branch (default)** — commit with structured message, `git push origin <headRefName>` from the worktree
   - **Open follow-up PR** — create branch `iterative-review/<original-pr#>-fixes` off `<headRefName>` in the worktree, commit fixes there, `gh pr create --base <headRefName> --head <new-branch>`
   - **Leave for manual review** — print the worktree path; the user inspects/cleans up later
   - **Discard fixes** — `git worktree remove --force <path>`
3. **Action execution:**
   - **Push to PR branch**: from inside the worktree, `git add -A`, commit with message
     ```
     fixes from /iterative-review (N findings resolved)

     Fixed:
     - [Critical] <description>
     - [Important] <description>

     Run: <iter-count> iterations, exit reason: <reason>
     ```
     Then `git push origin <headRefName>`. After push: `git worktree remove --force <path>`.
   - **Follow-up PR**: commit on the temp branch, push it, `gh pr create --base <headRefName> --head iterative-review/<pr#>-fixes --title "iterative-review fixes for PR #<pr#>" --body-file <generated-summary.md>`. After PR creation: `git worktree remove --force <path>`.
   - **Leave**: do nothing; record the path in the final report. User runs `git worktree remove --force <path>` when done.
   - **Discard**: `git worktree remove --force <path>`. No history of the fixes remains.
4. **Phase-aware PR mode addendum**: if the PR was associated with a phase, plan-affecting findings have ALREADY been written to the linked phase's handoff Open Questions section (via Step 5e routing). They do NOT need pushing to the PR branch. Mention in the final report which phase received which findings.

See `references/worktree-handling.md` for the full worktree lifecycle including pre-flight checks and edge cases (existing worktree, force-pushed PR, deleted upstream branch).

## Step 6: Final report (always)

Even on early exit, emit a structured final report:

```markdown
# Iterative Review — Final Report

**Mode:** <mode>  **Target:** <target>  **Verifier:** <commands>
**Iterations:** N / 3  **Exit reason:** <skip-if-clean | clean | fixed-point | cap | circuit-breaker | aborted>

## Resolved (this run)
- [Critical] <description> (was at iter 1, fixed at iter 2)
- [Important] <description> (auto-fixed iter 1)

## Residual (not resolved)
- [Critical] <description> — user skipped / verifier blocked / cap hit
- [Important] <description> — verifier blocked

## Suggestions (report-only)
- <description>

## Verifier results
- `<command>`: PASS / FAIL — <key output>

## Phasing notes (phase mode only)
- Plan-affecting findings written to <handoff path or phase issue comment>: <count>
```

Optionally invoke the `humanizer` skill on this report so it reads naturally.

## Red flags

- **Never run the loop on already-clean output.** Honor skip-if-clean. The 41pt accuracy drop is documented (Snorkel, Claude Sonnet 4.5).
- **Never modify the master plan** in phase mode. Surface plan-affecting findings via Open Questions only.
- **Never exceed 3 iterations** without an explicit `--cap` override.
- **Never auto-fix Critical findings** without an AskUserQuestion gate.
- **Never re-review untouched files** — wastes tokens, risks the "always finds something" failure.
- **Never edit `run.json`, `master-plan.md`, or `phase-N-spec.md`.** They're the phasing skill's state, not ours.

## End state

The skill exits when any of:

- Skip-if-clean triggered (best case)
- All Critical findings resolved
- Fixed-point reached
- 3-iteration cap hit
- Circuit breaker tripped
- User aborts at a GATE

In every case, a final report is emitted. The user's session continues uninterrupted.
