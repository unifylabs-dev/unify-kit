### Gate Prompt Convention

At every gate, use `AskUserQuestion` to present structured options instead of free text. This lets the user press Enter to continue (the default), or pick an alternative action. Each gate's options are tailored to the phase, but the pattern is always:
- **Option 1** = Continue to next phase (Recommended) — always the default
- **Options 2-3** = Phase-appropriate alternatives (e.g., review diff, modify ACs, skip phase)
- **Option 4** = Abort workflow
- The user can always select "Other" (built into AskUserQuestion) for free-text feedback

Never use a plain text question like "Continue?" — always use `AskUserQuestion` with options.

**IMPORTANT — Always provide next steps:** When implementation and verification are complete (whether via the full 7-phase flow or a partial run), you MUST present:
1. **What you verified** — list every automated check you ran and its result (tests, tsc, build)
2. **Manual testing steps** — concrete, step-by-step instructions for the user to verify the feature themselves (e.g., "Open the app, navigate to X, click Y, confirm Z happens"). Cover happy path + key edge cases from the ACs.
3. **Merge process** — the standard merge checklist

Never end a work-issue session without giving the user clear manual testing instructions.

If the user says "stop" or "abort" at any point, halt immediately and print:
```
⛔ Aborted. Current state:
- Branch: <branch-name>
- Worktree: <worktree-path>
- Changes: <committed/uncommitted>
- To clean up:
    cd <main-repo-path>
    git worktree remove <worktree-path>
    git branch -D <branch-name>
    git branch --show-current  # verify → master
```

---

