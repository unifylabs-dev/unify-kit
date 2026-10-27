---
name: phasing-v3
description: Orchestrate a phasing-v3 run - start it, move between phases, show where it stands, and close it. Use only when /ph3, /ph3-next or /ph3-status invokes it.
---

# Phasing v3

Phasing splits large, multi-day work into phases. Each phase runs in a fresh background session,
in its own git worktree, and ends with checked work, a pushed branch and a pull request. This
skill runs the parts between phases. The `phasing-v3-execute` skill runs each phase.

## Principles

1. **Cut phases around the user's attention, not the model's limits.** Phase boundaries sit where
   the user needs to look (intent, taste) or where work becomes independent. Why: in past runs the
   user was the critical path, and sessions sat idle 81–87% of their span waiting for answers.
2. **Verify against the real thing:** tests and CI for code, a running app for UI, a cheap draft
   for taste, live installation for tooling. Self-checks are not evidence of done.
3. **State is read, not reported.** The scripts derive the run's state from git, GitHub, agent
   view, the run folder and the clock. The user never relays "phase N is done".
4. **Ask only real questions.** Stop the user for intent, taste, cost, facts, and irreversible or
   client-facing actions. Decide everything else and report it.
5. **Remove first, add back on evidence.** A rule earns its place by a real, repeated failure.

## The run folder

`<main checkout>/.claude/phasing/<run-id>/` holds the run. It stays local while the run is in
flight and is committed when the run closes.

| File | What | Written by |
|---|---|---|
| `master-plan.md` | The plan the user approved ([template](references/master-plan.md)) | `/ph3`; amended by `/ph3-next` with a `.bak` |
| `decisions.md` | Locked decisions, do-not-relitigate, rulings ([template](references/decisions.md)) | `/ph3`, curated by `/ph3-next`; executors propose |
| `acceptance.json` | One row per requirement ([rules](../phasing-v3-execute/references/acceptance.md)) | `/ph3`; executors set status and evidence |
| `phase-N-brief.md` | The next phase's brief, written just in time ([template](references/brief.md)) | `/ph3-next` |
| `phase-N-handoff.md` | How the phase ended ([shape](../phasing-v3-execute/references/handoff.md)) | the executor |
| `phase-N-audit/` | Review output, screenshots, drafts; not read by default | the executor |
| `run.json` | Machine state: phases, sessions, branches, PRs | the scripts only; never edit it by hand |

The scripts live in the plugin's `scripts/` folder, two levels above this skill's folder. Each
prints one JSON object. Call them with `node <plugin>/scripts/<name>.mjs ...`:

| Script | Use |
|---|---|
| `run-state.mjs` | `init` a run, `locate` it, `mark-verified` a phase |
| `reconcile.mjs` | Read the facts, fix run.json (`--write`), and say what to do `next` |
| `acceptance.mjs` | `check` a phase's rows, list rows `due`, `carry` a row one phase |
| `worktree.mjs` | `create` the phase branch and worktree |
| `launch.mjs` | Start the phase session in the background and confirm it |
| `continue.mjs` | Start a fresh session for a paused phase |
| `status.mjs` | The status table; read-only |
| `closeout.mjs` | Set the run's final `status`, then `archive` it |

## `/ph3 [task]`: start a run

1. **Intent.** Run the conversation with the brainstorming skill when it is available. Aim for one
   approval of the whole master plan, not one per section. Use that skill for the conversation
   only: skip its spec file, its commit and its hand-off to writing-plans. The output is
   `master-plan.md`.
2. **Research** what the plan depends on: the repo, accounts, deploy targets, constraints.
3. **Draft** `master-plan.md`, `decisions.md` and `acceptance.json` from the templates. Apply the
   defaults in the master-plan template. In short:
   - setup and integration come first (a deployed walking skeleton, or a live install for tooling);
   - every phase ends with a pull request;
   - every phase owns at least one acceptance row;
   - an open row carries at most one phase;
   - the plan states run success criteria for closeout.

   Why: every past run left integration to the end, and the last phase became a dumping ground.
4. **The user approves the master plan.** This is the main intent gate. Revise until approved.
5. **Create the run:**
   `run-state.mjs init <repo>/.claude/phasing/<run-id> --run-id <run-id> --repo <repo> --base <branch> --phases '<json>'`.
   Use a run id like `2026-11-02-billing` and slugs in lowercase with dashes. Each phase in the
   JSON is `{"n": 1, "slug": "setup", "type": "setup"}`. The types are `setup`, `design`, `build`
   and `tooling`. Write the three drafts into the run folder. Then run
   `acceptance.mjs check <run-dir> 1` and fix any `errors` it lists, so a broken row does not show
   up later as a phase's gap.
6. Continue as `/ph3-next`.

## `/ph3-next [run-id]`: between phases

Without a run id, use the one in-flight run that `status.mjs` lists for this repo. With several,
ask which. `/ph3-next` is a command, not a long-running session: each call reads the state fresh.

1. **Reconcile.** Run `reconcile.mjs <run-dir> --write`. Report its flags in one short list, then
   act on `next.kind`. Settle a `handoff-unreadable` flag first: while a handoff cannot be read,
   the phase keeps its old status and `next` does not move. Fix the frontmatter field the flag
   names, from the handoff's body and the [handoff shape](../phasing-v3-execute/references/handoff.md).
   Ask the user when the body does not settle it. Then reconcile again.
2. **Act on the next step:**
   - `wait`: a session is working on phase `next.n`. If a flag says it is waiting for input, tell
     the user to answer it in agent view. Report and stop.
   - `verify`: phase `next.n` says it is complete. Check it as a second pair of eyes, without
     redoing it:
     1. `acceptance.mjs check <run-dir> <N>` gives `complete: true`. It lists row ids only, so
        read those rows in `acceptance.json` for their evidence. When `valid` is false, read its
        `errors`: an error in this phase's rows is a gap. Fix an error in other rows' shape
        yourself (the file belongs to the run), then check again.
     2. CI on its pull request passes: the reconciled `ci` is `pass`. With `pending`, or with
        `unknown` (gh failed, so the last result may be from an older commit), say so and stop;
        the user runs `/ph3-next` again later. `null` means there is
        nothing to read (no remote, no pull request, or no checks). A missing pull request is a
        gap when the repo has a remote.
     3. Two or three claims in the handoff match the diff (`git diff <base>...<branch>`).
     4. For a high-stakes phase (data, auth, migrations, money), re-run the key commands.

     When it holds, run `run-state.mjs mark-verified <run-dir> <N>`, then curate (step 3) and ask
     (step 4). Then launch the next phase (step 5), or follow closeout after the last phase.
     When it does not hold, show the gaps and ask: fix in a fresh session of this phase, accept as
     is, or amend the plan.
     - **Fix:** add the gaps to the brief under a `## Fix after verify` heading. Then run
       `launch.mjs <run-dir> <N> --exclude-handed-over` and report it as in step 5.
     - **Accept as is:** run `mark-verified`, then curate (step 3); open rows are carried or
       dropped there.
     - **Amend the plan:** as in step 4, then run `/ph3-next` again.
   - `continue`: phase `next.n` paused (`partial`) and nothing is running. Show the handoff summary
     and the reason it stopped. Its open questions, and whether to start a fresh session now, go
     into the one batch of step 4. Write the answers to `decisions.md`, where the next session
     looks for them. On yes, run `continue.mjs <run-dir> <N> --human-launch` and report its
     `launched` as in step 5. A `stop` names its `reason`: `launch-unconfirmed`, `launch-failed`
     and `launch-refused-*` are the step 5 cases; `not-partial` or `handoff-unreadable` means the
     handoff changed, so reconcile again. An open row that waits on someone outside the run is a
     step 4 question: the user drops it, or the run is parked.
   - `relaunch`: phase `next.n` failed, or its session ended without a handoff. Show the flags and
     the handoff. Ask: relaunch with the same brief, amend the brief first, or stop the run.
     Relaunch with `launch.mjs <run-dir> <N> --exclude-handed-over` and report it as in step 5.
     Why the flag: the sessions that wrote handoffs idle in agent view, and would block the new one.
     To stop the run, park or abandon it as in [closeout](references/closeout.md).
   - `launch`: phase `next.n` has not started. Go to step 5.
   - `closeout`: every phase is verified. Follow [closeout](references/closeout.md).
   - `inactive`: the run's `status` is parked, abandoned or closed. Report it and stop. A parked
     run resumes as in [closeout](references/closeout.md), "Park or abandon".
3. **Curate** after a verify:
   - `acceptance.mjs due <run-dir> <next N>` lists overdue and uncarried rows. An overdue row
     becomes one decision: drop it, or turn it into a root-cause ruling. An uncarried row needs the
     user's call: carry it once (`acceptance.mjs carry`) or drop it.
   - An issue that came up in two phases becomes one ruling in `decisions.md`, with its cost if wrong.
     Why: one issue decided piece by piece in six stops cost more than one ruling.
   - Move executor proposals in `decisions.md` into Locked or Rulings once the user agrees.
4. **One batch of real questions**, with `AskUserQuestion`, recommendation first:
   - open questions from the handoff;
   - the calls made for the user that they may want to reverse (default: keep);
   - amendments to the master plan (copy it to `master-plan.md.bak` first);
   - whether to merge the run's open phase pull requests, oldest first, unless the master plan
     sets a merge rule.

   Merging is outward-facing, so it happens only on the user's yes. Merge in phase order with
   `gh pr merge <pr> --merge`, or the method the master plan names. A merge commit keeps a phase
   stacked on this one clean. A pull request stacked on a phase that has just merged still targets
   that phase's branch: retarget it first with `gh pr edit <pr> --base <base branch>`, so it merges
   into the base branch, not into the older branch. Then run `reconcile.mjs <run-dir> --write`
   again, so the next worktree starts from the right base.
5. **Launch the next phase:**
   1. Run `worktree.mjs create <run-dir> <N>`. By default it starts from the base branch when the
      previous pull request is merged (fetched fresh from the remote), and stacks on the previous
      branch when it is not. Its `base` is the branch the phase's pull request targets.
   2. Write `phase-N-brief.md` from the [brief template](references/brief.md), with that PR base.
      Write it now, not earlier: in past runs, specs written up front were stale by the time their
      phase started.
   3. Run `launch.mjs <run-dir> <N>`. Always show its `manual` line as well.
      - `confirmed`: say the phase started, under which name. Agent view notifies the user when it
        needs them or finishes.
      - `started` but not `confirmed` (`launch-unconfirmed`): a session may be starting. Ask the
        user to check agent view before they use the manual line.
      - `refused` `live-session`: another session is live in that worktree (`live` names it).
        Report and stop.
      - `refused` `agents-unavailable`, or an `error` (`launch-failed`): give the manual line.
6. **End with the table** from `status.mjs <run-id>`.

The next phase never starts on its own. The user runs `/ph3-next` when agent view says a phase
finished. Why: the user decides at each phase boundary, and a run left alone should stay still.

## Questions and decisions

- Batch known questions into `/ph3-next`, while the user is present, so phases do not stop on them.
- Use plain language, one question per item, and give your recommendation first.
- Facts (names, accounts, domains) come from the user. Why: an invented client name survived for
  weeks in a past run.
- Mark early decisions provisional until real references back them.

## `/ph3-status [run-id]`

Run `status.mjs [run-id]` and print its `text` as it is. It changes nothing. Without a run id it
lists the in-flight runs in this repo and flags any run idle for more than 7 days. Offer to park or
abandon a flagged run, as in [closeout](references/closeout.md).

## Old runs and limits

- Runs started with the earlier phasing skill have a different `run.json`. Point the user to
  `/phase-status` for them; v3 does not read or convert them.
- Phases run one at a time in the pilot. Parallel phases are not supported yet.
- v3 writes no MEMORY.md pointers, so there are none to clean up.
