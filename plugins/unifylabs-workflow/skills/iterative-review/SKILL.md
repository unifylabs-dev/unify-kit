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
- `--cap N` — request a different max-rounds bound; the value is clamped by `workflow/stopping-engine.mjs` (the engine owns the real ceiling)
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

> **Superseded by native EnterWorktree; migration tracked in M0/Theme-4 (not yet landed).** The hand-rolled git-worktree plumbing below remains operational until the native replacement is wired (it cannot yet check out an arbitrary PR head ref).

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

## Step 5: The enforced loop (ceilings live in code)

The review → fix → verify → re-review loop is no longer prose the model is asked
to honor — it is an **enforced loop-until-dry Workflow**. The control flow and
every ceiling (skip-if-clean, max-rounds clamp, severity gating, fixed-point /
cycle detection, the token-budget circuit breaker) live in
`workflow/stopping-engine.mjs` (plus the helpers under `workflow/lib/`), bundled
into `workflow/iterative-review.workflow.mjs`. **That code is the single source
of truth for the stopping rules.** This section describes the loop's *behavior*;
it does not restate authoritative thresholds. (Non-authoritative orientation
only: the default cap is 3 with a hard ceiling of 5 — see `stopping-engine.mjs`,
which clamps the value, for the real rule.)

What you, the model, supply are the three injected callbacks the kernel drives:
the re-review pass, the fixer pass, and the verifier. The kernel owns *when* each
runs, *when* the loop continues, and *which exit reason* fires. Each callback is
pure I/O around a single round; none of them decide when to stop.

### What the kernel does each round

1. **Categorize** the round's findings by severity (Critical / Important /
   Suggestion). Severity tiers are defined in `references/severity-policy.md`.
2. **Auto-fix the Important working set** (the default model). This is the only
   set the loop tries to shrink in-loop, and shrinkage of this set is the
   fixed-point signal.
3. **Collect — never fix — Critical findings.** See the platform behavior change
   below: Criticals are gathered and returned for the between-runs human gate.
4. **Run the verifier** for the round; a permanent failure exits with `aborted`.
5. **Re-review delta scope only** — files touched this round plus files tied to
   an unresolved prior finding. Untouched files are skipped (keeps each round
   cheap; prevents the "always finds something new" failure on stable files).
6. **Classify the exit** via the precedence ladder in `stopping-engine.mjs`
   (`classifyExit`). The frozen exit-reason vocabulary lives in
   `workflow/lib/exit-reasons.mjs`.

### Platform behavior change — no mid-run human input

A running Workflow takes **no mid-run human input**. The old per-Critical
`AskUserQuestion` gate that lived *inside* the loop is therefore gone. Instead:

- **Criticals are COLLECTED, not fixed in-loop.** Fixing a Critical needs a human
  decision, which a running Workflow cannot solicit, so the loop never attempts
  it. Residual blocking findings are returned to the caller via the
  **`criticals-pending-gate`** exit reason, and the human gate happens *between*
  runs — at the M2 outer-orchestration seam — not inside the kernel.
- Under `--gate-important`, Important findings are *also* collected (not
  auto-fixed) and become blocking findings that route through the same
  `criticals-pending-gate` exit.
- Suggestions stay report-only unless `--include-suggestions` promotes them to
  the gate (still never auto-fixed in-loop).

### Two-layer enforcement

Stopping is enforced in **two independent layers**, so a model that "forgets" a
rule cannot escape it:

1. **In-loop JS kernel** — `stopping-engine.mjs` deterministically applies the
   ceilings and routes every exit through the frozen reason set.
2. **Stop-hook verifier backstop** (added in the next step of this milestone) — a
   deterministic Stop-hook that re-runs the *real* verifier and **blocks sign-off
   if it is red**, independent of whatever the loop reported. The kernel decides
   when to stop; the Stop-hook independently refuses to let a red tree be signed
   off.

### `/goal` is reserved for M2

`/goal` is **not** an in-loop "are we done yet?" check. The inner loop is
deterministic code, not a soft model self-assessment. `/goal` is reserved for the
**M2 outer orchestration seam** that wraps this kernel; the inner stopping
decision never asks the model whether it is finished.

### Fixer dispatch (your callback's responsibility)

When the kernel's auto-fix pass runs, dispatch a fixer via the Agent tool per
accepted Important finding. The fixer prompt MUST include:

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

Run fixers in parallel when their target files don't overlap; serialize
otherwise. Critical findings are NOT dispatched here — they are collected for the
between-runs gate.

See `references/stopping-rules.md` for the human-oriented summary of the five
rules, and `workflow/stopping-engine.mjs` (+ `workflow/lib/`,
`workflow/test/stopping-engine.test.mjs`) for the enforced, tested definitions.

## Step 6.5: Push-back gate (PR mode only)

> **Superseded by native EnterWorktree; migration tracked in M0/Theme-4 (not yet landed).** The hand-rolled git-worktree plumbing below remains operational until the native replacement is wired (it cannot yet check out an arbitrary PR head ref).

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
**Iterations:** N / 3  **Exit reason:** <skip-if-clean | clean | fixed-point | cap | circuit-breaker | aborted | criticals-pending-gate>

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
- **Never bypass the enforced ceilings** — they live in `workflow/stopping-engine.mjs` (+ `lib/`), not prose; the cap/fixed-point/budget limits are code, not guidance.
- **Never fix Critical findings in-loop** — a running Workflow takes no mid-run human input, so Criticals are collected and handed to the between-runs human gate via the `criticals-pending-gate` exit reason.
- **Never re-review untouched files** — wastes tokens, risks the "always finds something" failure.
- **Never edit `run.json`, `master-plan.md`, or `phase-N-spec.md`.** They're the phasing skill's state, not ours.

## End state

The kernel classifies every exit as exactly one of the 7 frozen reasons in
`workflow/lib/exit-reasons.mjs`:

- `skip-if-clean` — the initial pass had nothing worth gating or auto-fixing; the loop is never entered (best case).
- `clean` — no Critical or Important findings remain and there is no auto-fixable work left.
- `fixed-point` — the auto-fixable working set stopped shrinking (stall, set-swap, or oscillation).
- `cap` — ran out of rounds (`maxRounds` reached) with no residual blocking findings.
- `circuit-breaker` — the token-budget breaker fired.
- `aborted` — the verifier permanently failed.
- `criticals-pending-gate` — residual blocking findings (Criticals always; Important under `--gate-important`) handed to the between-runs human gate.

In every case, a final report is emitted. The user's session continues uninterrupted.
