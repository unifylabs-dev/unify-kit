# Worktree handling — PR-mode lifecycle

Isolation contract for PR mode. The loop runs in a dedicated git worktree so the user's main checkout is untouched. Inspired by `superpowers:using-git-worktrees`; this doc specifies the iterative-review-specific path conventions and cleanup rules.

## Path convention

```
~/.claude/iterative-review-worktrees/<PR#>/
```

One worktree per PR. If the user re-runs `/iterative-review <PR#>` while a worktree still exists, see "Existing worktree" below.

## Pre-flight checks (before `git worktree add`)

Run in order; abort with a clear message on any failure:

1. **Cwd is inside a git repo:** `git rev-parse --git-dir` succeeds.
2. **PR's head ref is fetched:** `git fetch origin <headRefName>` returns 0. If not, abort: "Cannot fetch PR head branch — check network or PR access."
3. **Worktree slot is free:**
   - If `~/.claude/iterative-review-worktrees/<PR#>/` does NOT exist: proceed.
   - If it exists, see "Existing worktree" below.
4. **Disk space sanity check:** `df ~/.claude` — abort if <500MB free.

## Setup

```
git worktree add ~/.claude/iterative-review-worktrees/<PR#> origin/<headRefName>
```

Cache the worktree path in session state. Use absolute paths under this directory for every subsequent file operation in the loop.

## Existing worktree (re-run case)

If the worktree slot is occupied when starting a new run:

1. Inspect: `cd ~/.claude/iterative-review-worktrees/<PR#> && git status --porcelain`
2. AskUserQuestion: "A worktree from a prior run exists at `<path>` with N uncommitted changes. Options:"
   - **Resume in this worktree** — keep the existing changes; new findings build on them
   - **Clean and re-checkout** — `git worktree remove --force <path>` then re-`add`; throws away prior changes
   - **Abort** — exit without doing anything

## Edge cases

### PR head branch was force-pushed since the worktree was created

Symptom: worktree's HEAD doesn't match `origin/<headRefName>`.

Detection: from inside worktree, `git fetch origin && git rev-list HEAD..origin/<headRefName>` — non-empty means upstream moved.

Resolution: AskUserQuestion: "PR branch was updated upstream since this worktree was created. Reset to upstream (discards local work) or keep local (may conflict on push)?"

### PR head branch deleted upstream

Symptom: `git fetch origin <headRefName>` returns "couldn't find remote ref".

Resolution: abort the run with a clear message. The PR was likely closed or rebased away. The user must re-evaluate.

### Worktree is dirty when push-back gate runs

Should not happen if the loop is well-formed — fixes commit themselves at the gate. But defensively: `git status --porcelain` at the start of Step 6.5 must be empty before the gate's "Push to PR branch" action. If not empty:

1. Show the user what's dirty.
2. AskUserQuestion: "Worktree has uncommitted changes outside the loop's tracked fixes. Stage and commit them with the rest, leave dirty (push will fail), or abort?"

### Loop aborted mid-iteration

If the user aborts at a GATE or the verifier permanently fails, the worktree may have partial fixes. The final report's Step 6.5 still runs but with the "Leave for manual review" path emphasized.

## Cleanup

After successful push, follow-up PR, or explicit discard:

```
git worktree remove --force ~/.claude/iterative-review-worktrees/<PR#>
```

The `--force` flag is intentional — by this point, work has either landed (push/PR) or been discarded.

If the user chose "Leave for manual review": **do NOT clean up**. Print the path in the final report. The user runs the remove command themselves when done.

## Garbage collection (cross-session)

Worktrees from aborted sessions may linger. A `/iterative-review --gc` flag (future enhancement) could scan `~/.claude/iterative-review-worktrees/` for entries whose PR is closed/merged and offer to remove them. Out of scope for v0.4.1; documented here as a future path.

## Why not use the user's main checkout?

Three reasons:

1. **Branch pollution**: switching to the PR branch in the user's main checkout disrupts whatever they were doing. They may have uncommitted work.
2. **Concurrent runs**: multiple `/iterative-review <PR#>` invocations against different PRs can run in parallel if each has its own worktree.
3. **Cleanup is atomic**: discarding fixes = `git worktree remove --force`. No need to `git reset` + `git checkout` + restore stash dance.

## Why not the system tmp directory?

`~/.claude/` is preferred over `/tmp/` because:

- Persists across reboots (the user may want to resume the next day)
- Bounded location for cleanup / inspection
- Doesn't get cleared by the OS's tmp-cleanup heuristics

## Interaction with the `superpowers:using-git-worktrees` skill

If `superpowers:using-git-worktrees` is available in the session, prefer it for the actual `git worktree add` and `git worktree remove` calls — it has its own error handling and conventions. iterative-review just owns the path convention (`~/.claude/iterative-review-worktrees/<PR#>/`) and the lifecycle gates.
