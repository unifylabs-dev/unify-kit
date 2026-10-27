# Phase brief template

`/ph3-next` writes `phase-N-brief.md` just before the phase starts, from the master plan, the
decisions ledger, the previous handoff and the acceptance rows. Only the next phase gets a full
brief: briefs written far ahead went stale in past runs.

```markdown
# Phase N: <slug> (<type>)

## Do these first (human-only steps)
- [ ] <account, key, sign-in or approval only the user can do>

## Outcome
What is true when this phase is done, in two or three lines.

## Exit criteria
The acceptance rows this phase owns: <ids>, plus any carried row with its deadline.

## Guardrails
- Locked decisions that apply, and what not to reopen.
- What is out of scope for this phase.

## Read first
Only what this phase needs: files, docs, the previous handoff's open items.

## Notes for this machine
- Ports to use: <ports>. Other sessions use other ports.
- Servers stop by PID or port, never by pattern. The user's own dev server stays untouched.
- Local database resets are announced before they run.
- Secrets come from <env file or store>; they stay out of chat and commits.
```

Keep the brief under about 80 lines. The executor reads it in full.
