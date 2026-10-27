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
   approval of the whole master plan, not one per section.
2. **Research** what the plan depends on: the repo, accounts, deploy targets, constraints.
3. **Draft** `master-plan.md`, `decisions.md` and `acceptance.json` from the templates. Apply the
   defaults in the master-plan template. In short:
   - setup and integration come first (a deployed walking skeleton, or a live install for tooling);
   - every phase ends with a pull request;
   - an open row carries at most one phase;
   - the plan states run success criteria for closeout.

   Why: every past run left integration to the end, and the last phase became a dumping ground.
4. **The user approves the master plan.** This is the main intent gate. Revise until approved.
5. **Create the run:**
   `run-state.mjs init <repo>/.claude/phasing/<run-id> --run-id <run-id> --repo <repo> --base <branch> --phases '<json>'`.
   Use a run id like `2026-11-02-billing` and slugs in lowercase with dashes. Each phase in the
   JSON is `{"n": 1, "slug": "setup", "type": "setup"}`. The types are `setup`, `design`, `build`
   and `tooling`.
6. Continue as `/ph3-next`.

## `/ph3-next [run-id]`: between phases

Without a run id, use the one in-flight run that `status.mjs` lists for this repo. With several,
ask which. `/ph3-next` is a command, not a long-running session: each call reads the state fresh.

1. **Reconcile.** Run `reconcile.mjs <run-dir> --write`. Report its flags in one short list, then
   act on `next.kind`.
2. **Act on the next step:**
   - `wait`: a session is working on phase `next.n`. If a flag says it is waiting for input, tell
     the user to answer it in agent view. Report and stop.
   - `verify`: phase `next.n` says it is complete. Check it as a second pair of eyes, without
     redoing it:
     1. `acceptance.mjs check <run-dir> <N>` shows every row met or dropped, with evidence.
     2. CI on its pull request passes (the reconciled `ci`).
     3. Two or three claims in the handoff match the diff (`git diff <base>...<branch>`).
     4. For a high-stakes phase (data, auth, migrations, money), re-run the key commands.

     When it holds, run `run-state.mjs mark-verified <run-dir> <N>`, then curate, ask, and launch
     the next phase. When it does not, show the gaps and ask: fix in a fresh session of this phase,
     accept as is, or amend the plan.
   - `continue`: phase `next.n` paused (`partial`) and nothing is running. Show the handoff summary
     and the reason it stopped. Ask whether to start a fresh session now; on yes, run
     `continue.mjs <run-dir> <N> --human-launch`.
   - `relaunch`: phase `next.n` failed, or its session ended without a handoff. Show the flags and
     the handoff. Ask: relaunch with the same brief, amend the brief first, or stop the run. Relaunch
     with `launch.mjs <run-dir> <N>`.
   - `launch`: phase `next.n` has not started. Go to step 5.
   - `closeout`: every phase is verified. Follow [closeout](references/closeout.md).
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
   - whether to merge the finished phase's pull request, unless the master plan sets a merge rule.

   Merging is outward-facing, so it happens only on the user's yes (`gh pr merge`).
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
      - `started` but not `confirmed`: a session may be starting. Ask the user to check agent view
        before they use the manual line.
      - `refused` `live-session`: a session is already working in that worktree. Report and stop.
      - `refused` `agents-unavailable`, or an `error`: give the manual line.
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
lists the in-flight runs in this repo and flags any run idle for more than 7 days.

## Old runs and limits

- Runs started with the earlier phasing skill have a different `run.json`. Point the user to
  `/phase-status` for them; v3 does not read or convert them.
- Phases run one at a time in the pilot. Parallel phases are not supported yet.
- v3 writes no MEMORY.md pointers, so there are none to clean up.
