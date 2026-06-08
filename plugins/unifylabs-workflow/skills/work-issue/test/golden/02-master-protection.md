## Master Branch Protection (NON-NEGOTIABLE)

The main working directory must **ALWAYS** remain checked out on `master`. All feature work happens exclusively in worktrees under `.worktrees/`.

**NEVER run `git checkout <branch>` in the main repo.** Use worktrees instead.

This is critical because the user runs multiple terminals and branches simultaneously — switching branches in the main repo breaks every other terminal's working state.

---

