# Closing a run

A run ends on purpose. In a past run, a run left open was forgotten for months.

## When every phase is verified

1. Check the run success criteria in the master plan with the user. Then set the status:
   `closeout.mjs status <run-dir> complete`, or `complete_unmet` with a reason when some
   criteria were not met.
2. List the run's open pull requests with
   `gh pr list --state open --search "head:phase/<run-id>/"` (`--head` matches one exact branch
   name, so it finds none), and add any issues the handoffs name. Ask the user what to do with
   each: merge, close, or leave open with a note.
3. Archive: `closeout.mjs archive <run-dir>`. It stops the run's idle sessions, removes worktrees
   that hold nothing to lose, and moves the run folder to `.claude/phasing/archive/<year>/`.
   Report any worktree it kept, and why (uncommitted work, or ignored files such as env files).
   It refuses while a session is still working.
4. Commit the archive from a worktree of its own, so the user's checkout stays on its branch.
   From the main checkout, with `<base>` the run's base branch:
   1. `git fetch origin <base>`, then
      `git worktree add --no-track -b phase/<run-id>/closeout .claude/worktrees/<run-id>-closeout origin/<base>`.
   2. Move the folder at `archivedTo` to the same path inside that worktree. Move it, do not copy
      it: an untracked copy in the checkout would block `git pull` once the pull request merges.
   3. Commit it there (`git add -f` when the repo ignores `.claude/`), push the branch, and open a
      pull request against `<base>`. Merging stays with the user.
   4. Remove the worktree: `git worktree remove .claude/worktrees/<run-id>-closeout`.

   With no remote, branch from `<base>` instead, commit, and stop there. Tell the user the branch.

## Park or abandon

- **Park** a run that waits on something outside it:
  `closeout.mjs status <run-dir> parked --reason "<what it waits for>"`. A parked run stays in
  place and drops out of the in-flight list. Resume it with
  `closeout.mjs status <run-dir> in_progress`, then `/ph3-next`.
- **Abandon** a run that will not finish:
  `closeout.mjs status <run-dir> abandoned --reason "<why>"`, then archive it as above.
