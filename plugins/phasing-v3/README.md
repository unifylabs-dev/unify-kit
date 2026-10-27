# phasing-v3 (pilot)

Phasing v3 splits large work into phases. Each phase runs in a fresh background session,
in its own git worktree, and ends with a pushed branch and a pull request.

- `/ph3 [task]` starts a run: intent, master plan, decisions, acceptance rows.
- `/ph3-next [run-id]` reads the run's state from git, GitHub, the run folder and the clock,
  checks the finished phase, asks the real questions in one batch, then launches the next phase.
- `/ph3-execute <run-id> <N>` runs one phase. The launch runs it for you.
- `/ph3-status [run-id]` shows where a run stands. It changes nothing.

## Status

This is a pilot. It lives beside the `phasing` skill in `unifylabs-workflow` under its own
names, so the current `/phase*` commands keep working. After the pilot, v3 takes the
`phasing` names and this plugin folds into `unifylabs-workflow`.

## Loading it

The pilot is not in the marketplace. Load it from a checkout with a skills-dir symlink:

```bash
ln -s <checkout>/plugins/phasing-v3 ~/.claude/skills/phasing-v3
```

## Tests

The scripts have no dependencies. From this folder:

```bash
node --test tests/*.test.mjs
```
