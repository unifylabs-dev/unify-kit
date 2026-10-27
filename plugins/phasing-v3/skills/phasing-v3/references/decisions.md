# Decisions ledger template

`decisions.md` is the run's memory of what was decided and why. Executors read it at the start of
every phase instead of reading every earlier handoff.

```markdown
# Decisions: <run name>

## Locked
- D1: <decision>. Why: <evidence>. Locked <date> by the user.

## Do not relitigate
- <topic>: decided as <choice>. Rejected: <option> (why), <option> (why).

## Rulings
- R1: <recurring issue> → <one rule that settles it>. Cost if wrong: <what breaks>.

## Proposed by executors
- Phase N: <proposal> (provisional | for the user). Why: <reason>.
```

- A ruling states its cost if wrong, so it can be revisited when that cost shows up.
- Executors only add under "Proposed by executors". `/ph3-next` moves a proposal into Locked or
  Rulings once the user agrees.
- Provisional decisions stay marked until real references or data back them.
