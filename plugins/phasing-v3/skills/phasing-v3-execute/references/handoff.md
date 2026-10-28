# Phase handoff

Write it at `<run-dir>/phase-N-handoff.md` when the phase ends or pauses. Aim for 150 lines or
fewer: the next session and `/ph3-next` read it, and long handoffs bury what matters. Detailed
material (review output, screenshots, ledgers) goes in `phase-N-audit/`.

## Frontmatter

The frontmatter is the part tools read. Keep each key at the start of its own line, once:

```yaml
---
phase: 3
status: partial
blocking_questions: 0
session: phase-3-api-c1
---
```

- `phase`: this phase's number.
- `status`: `complete`, `partial` or `failed`. Nothing else, and never a draft.
- `blocking_questions`: how many questions to the user are still open and block the work. Above
  0, no fresh session starts on its own.
- `session`: this session's name. Run `claude agents --json` and take the newest background
  session whose `cwd` is this worktree. Only if that fails, use the last entry in run.json's
  `sessions` for this phase. A wrong name stops the next session from starting on its own.

A handoff with broken frontmatter is treated as unreadable: nothing continues until it is fixed.

## Body

Use these sections, in this order:

1. **Summary**: three to five lines. Status, the outcome, and what the user needs to do.
2. **What changed**: the user-visible result first, then files and commits.
3. **Decisions made**: decisions with lasting effect, also proposed in `decisions.md`.
4. **Calls made for you**: each reversible choice made without asking, with one line of why, so
   the user can reverse it at `/ph3-next`.
5. **Verification evidence**: each check, the command, and its result. Include test files run
   against the number expected. Include the code-review and security-review findings and what
   was done about each.
6. **Acceptance**: each row of this phase with its status and evidence.
7. **Open questions**: questions for the user, each with your recommendation.
8. **Next steps** (`partial` only): concrete, ordered steps for the next session, starting
   with the first command or file to open.
