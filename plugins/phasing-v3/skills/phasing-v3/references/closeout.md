# Closing a run

A run ends on purpose. In a past run, a run left open was forgotten for months.

## When every phase is verified

1. Check the run success criteria in the master plan with the user. Then set the status:
   `closeout.mjs status <run-dir> complete`, or `complete_unmet` with a reason when some
   criteria were not met.
2. List the run's open pull requests and issues (`gh pr list --head phase/<run-id>/`), and ask the
   user what to do with each: merge, close, or leave open with a note.
3. Archive: `closeout.mjs archive <run-dir>`. It stops the run's idle sessions, removes worktrees
   that hold nothing to lose, and moves the run folder to `.claude/phasing/archive/<year>/`.
   Report any worktree it kept, and why (uncommitted work, or ignored files such as env files).
   It refuses while a session is still working.
4. Commit the archived folder on a branch `phase/<run-id>/closeout`, push it, and open a pull
   request. Merging stays with the user.

## Park or abandon

- **Park** a run that waits on something outside it:
  `closeout.mjs status <run-dir> parked --reason "<what it waits for>"`. A parked run stays in
  place and drops out of the in-flight list. Resume it with
  `closeout.mjs status <run-dir> in_progress`, then `/ph3-next`.
- **Abandon** a run that will not finish:
  `closeout.mjs status <run-dir> abandoned --reason "<why>"`, then archive it as above.
