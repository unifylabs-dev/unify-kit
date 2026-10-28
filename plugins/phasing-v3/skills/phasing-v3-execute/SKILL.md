---
name: phasing-v3-execute
description: Run one phase of a phasing-v3 run in its own worktree, from the brief to a pushed branch and a pull request. Use when /ph3-execute invokes it.
license: MIT
---

# Run one phase

You run one phase of a larger run. The user chose the work in a master plan, and a brief for
this phase was written just before you started. You work in a git worktree on the phase's own
branch. The phase ends with checked work, a handoff, a pushed branch, and a pull request.

Each rule below says why it exists, so it can be dropped when the reason goes away.

## Find the run

- The run folder is `<main checkout>/.claude/phasing/<run-id>/`. The main checkout is the parent
  of `git rev-parse --path-format=absolute --git-common-dir`. The plugin's
  `scripts/run-state.mjs locate <run-id>` prints the same path.
- The run folder is outside your worktree; the launch gave you access to it. Code changes go in
  the worktree. Run files (handoff, acceptance rows, decisions) go in the run folder.
- Read only these:
  - `phase-N-brief.md`: the phase type (in its title), outcome, guardrails, exit criteria, PR base,
    human-only steps, and notes.
  - `decisions.md`: what is locked, what not to reopen, and the rulings so far.
  - From `master-plan.md`: the TL;DR, Decisions and Facts sections.
  - The immediately previous handoff: `phase-N-handoff.md` when it exists (this phase paused or
    failed before), otherwise `phase-(N-1)-handoff.md`.
  - This phase's rows in `acceptance.json`.

  Why: reading every earlier handoff cost about a third of a session late in long runs. The
  ledger and the previous handoff carry what matters.

## Start

- **A continuation** (the phase handoff says `partial`): if its `blocking_questions` is above 0,
  look for the answers in `decisions.md` and ask the ones still open in one round. Then go
  straight to its Next steps, with no other question round and no plan mode. Why: the work was
  already agreed; users asked again and again to resume without ceremony.
- **A relaunch** (the phase handoff says `failed`): start from why it failed, and do not repeat
  the approach that failed.
- **A fix** (the phase handoff says `complete`, and the brief has a `## Fix after verify`
  section): fix those gaps only, then finish as usual. The rest of the phase was already checked.
- **A new phase:** investigate first (the code and files the brief points to). Then ask one
  batched round of questions with `AskUserQuestion`, only for what blocks you and what the brief
  and `decisions.md` do not answer. Use plain language and give your recommendation first. With
  no such questions, say so in one line and start. Why: plan approvals went through unchanged in
  61 of 62 cases; the user's input changes results only where a real question is open.
- Plan mode only when the user asks for it or the brief flags open design decisions.
- Check the brief's human-only steps (accounts, keys, sign-ins). If one is not done, it goes in
  the question round: it blocks.

## Decide, and ask only what you have to

- **Reversible choices:** go with your recommendation and keep going. Record each one under
  "Calls made for you" in the handoff, with one line of why. Why: 85% of answers in past runs
  were "go with the recommendation", and sessions sat idle up to two days waiting for them.
- **Stop for:** cost, taste, facts, and irreversible or client-facing actions. Then:
  1. hold the question;
  2. finish all work that does not depend on the answer;
  3. ask once with `AskUserQuestion` (it alerts the user and pushes to the phone).

  Ask at once only when nothing else can proceed. If you pause with a question still open, set
  `blocking_questions` in the handoff, so no fresh session starts on its own.
- **Facts are never invented.** A name, account, or domain missing from the master plan's Facts
  is a question. Why: an invented client name survived for weeks in a past run.
- **Early decisions are provisional** until grounded in real references or data. Write them in
  `decisions.md` under "Proposed by executors", marked provisional. Why: a palette locked before
  any references existed was frozen as an invariant and later forced a full reset.
- **The same issue twice becomes one ruling.** Propose it in `decisions.md` with its cost if
  wrong. Why: one contrast issue was decided piece by piece in six separate stops.
- Work the brief does not ask for goes under Open questions, not into this phase.

## Work

- Work according to the phase type (the brief's title): `references/phase-types.md`.
- UI work (any task that designs, builds, reviews or polishes a screen) loads the `impeccable`
  skill first, when it is installed, in every phase type. Why: it is the founder's standard for
  UI, and it carries the project's design system and its anti-pattern checks.
- Build inline when tasks depend on each other. Use subagents for independent work, for the
  independent review, and for a per-task review after a risky task (data integrity, auth,
  migrations, concurrency). Subagents run on Opus, like every agent in a run. Why: splitting
  dependent work across agents loses context at each handover; a fresh reviewer finds what the
  author misses.
- The brief is the plan. By default, no separate planning skill and no subagent per task; test
  first and systematic debugging stay available. Why: an extra plan per phase cost a lot and
  added nothing the brief did not already say.
- Do not move your own acceptance rows to a later phase. An open row means the phase is
  `partial` or `failed`. Carrying a row is the user's call, made between phases.

## Pause at about half the context

When context-watch says context is at about 50%, or when the user asks for a pause:

1. Finish the task in hand. Start no new task.
2. If `phase-N-handoff.md` already exists, move it to `phase-N-audit/handoff-<k>.md`.
3. Write a `partial` handoff (`references/handoff.md`) with concrete Next steps, using the Write
   tool, not a shell command. Why: context-watch records the handoff only from a Write, and
   without that record no fresh session starts.
4. Commit the work in the worktree.
5. Stop the background shells, servers and monitors you started, by PID, and let your subagents
   finish. Why: the fresh session starts only once none run, so two sessions never edit one
   worktree at once.
6. End the turn. A fresh session for this phase starts on its own in the same worktree.

Why: past half the window, quality drops, and the next session inherits what this one does.

- Pause only on the context-watch note or when the user asks. A break marked in the brief is not
  a reason to pause, and do not estimate the context level yourself: self-estimates have been far
  off (one read 26% as 129%).
- Hook reminders that ask about `/handoff` or a pending handoff do not apply in a phase session.
  This pause rule replaces them; do not raise a question for them.

## Check the work

Follow `references/verification.md`. A phase is `complete` only when every acceptance row of this
phase is `met` with evidence (or `dropped` with the user's agreement). Otherwise it is `partial`
(work remains) or `failed` (blocked). "Deferred" is not a result.

## Finish

1. Commit, then push the phase branch: `git push -u origin <branch>`. Open or update the pull
   request against the PR base the brief names (`gh pr create --base <base>`). With no remote,
   skip the pull request and CI, and say so in the handoff.
2. Draft the handoff in `phase-N-audit/handoff-draft.md`. The review checks its claims.
3. Run the checks (`references/verification.md`): the one review round (with the security
   review when the phase changed code), and CI on the pull request. Commit and push the fixes.
4. Update `acceptance.json`: status and evidence for each row.
5. Write the final `phase-N-handoff.md` last. That file is the signal `/ph3-next` reads, so never
   put a draft there. Why: a draft in place once made a finished-phase check fire while work was
   still running.
6. Put the handoff summary in the pull request body. Merging is the user's call.
7. End with a short summary: status, what changed, and what the user needs to do.

## Machine hygiene

- Stop servers by PID or port (`kill <pid>`, `lsof -ti tcp:<port>`), never by pattern
  (`pkill -f`, `pkill node`). Every subagent brief that starts a server says this. After such a
  subagent returns, check that the user's own dev server is still up; if it is gone, tell the
  user at once and do not restart it yourself. Why: a pattern kill once took down the user's dev
  server and an editor extension's server.
- Announce a destructive local database reset before you run it.
- Use the ports the brief gives. Parallel sessions each get their own.
- Secrets stay out of chat, logs and commits. Use env files or `gh secret`.
- Respect the subagent concurrency cap (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`).

## Helpers

The plugin's `scripts/` folder (two levels above this skill's folder) has small helpers:
`run-state.mjs locate <run-id>` and `acceptance.mjs check <run-dir> <N>`. They save time but are
not required: the run files are plain JSON and Markdown, and this skill works without them.
