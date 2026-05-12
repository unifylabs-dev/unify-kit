---
description: "Iterative review-fix-verify loop with bounded iteration. Auto-detects code, doc, or phase mode."
argument-hint: "[PR# | path | phase <run-id> <N>] [--flags]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Agent", "AskUserQuestion", "Skill"]
---

# /iterative-review

Invoke the `iterative-review` skill. Pass through arguments and flags.

**Arguments:** "$ARGUMENTS"

## Usage

- `/iterative-review` — auto-detect mode from cwd
- `/iterative-review 47` — review PR #47 (code mode)
- `/iterative-review specs/foo.md` — review a spec (doc mode)
- `/iterative-review phase 2026-05-12-foo 2` — review phase 2's deliverables (phase mode)

## Flags

- `--include-suggestions` — surface Suggestion-severity findings in the loop (default: report-only)
- `--gate-important` — gate every Important finding (default: auto-fix)
- `--cap N` — override 3-iteration cap (max 5)
- `--no-skip-clean` — disable the skip-if-clean pre-gate (NOT recommended; see the skill docs for why)

## Behavior

Invokes the `iterative-review` skill which:

1. Detects mode + target artifact
2. Detects verifier (auto from project; cached for loop)
3. Initial review pass (calls `/pr-review-toolkit:review-pr` for code, doc-reviewer subagent for docs)
4. Skip-if-clean: exits if no Critical or Important findings (avoids the Snorkel self-critique accuracy drop)
5. Loop (max 3): categorize → gate Critical → auto Important → fix → verify → re-review → check stopping rules
6. Final report (always; includes exit reason and residual findings)

In phase mode, plan-affecting findings flow through the existing handoff "Open questions for downstream" channel without modifying the locked master plan.

See the bundled `iterative-review` skill (`SKILL.md` + `references/`) for full orchestration logic.
