# Master plan template

The master plan is what the user approves at the start of a run. Keep it short enough to read in
one sitting. Executors read only its TL;DR, Decisions and Facts.

## Defaults every plan follows

- **Setup and integration first.** Phase 1 (or 2) sets up accounts, environment, deploy target
  and CI, and ends with a deployed walking skeleton, or a live install for tooling. Why: every
  past run left integration to the end, and the last phase stalled on it.
- **One pull request per phase.** Every phase ends pushed, with a pull request and CI.
- **Security review.** Every phase that changes code ends with `/security-review` on its diff,
  and a run that produced code gets one whole-codebase security review at closeout. Why: phase
  reviews see one diff at a time, and a run's exposures can span phases.
- **One-phase carry.** An open requirement moves forward at most one phase; then it is met,
  dropped, or turned into a decision.
- **Closeout.** The plan states the run success criteria, so the run can be closed on purpose.

## Template

```markdown
# <Run name>

## TL;DR
Three to five lines: the outcome, for whom, and the shape of the phases.

## Phases
| # | Slug | Type | Goal (one line) | Exit criteria | Depends on |
|---|---|---|---|---|---|
| 1 | setup | setup | ... | acceptance rows P1-* met | - |
| 2 | ... | design / build / tooling | ... | ... | 1 |

## Decisions
- Locked: <decision> (why).
- Provisional: <decision> (why; what would confirm it).

## Facts
Names, accounts, domains, people and other facts that are never invented.

## Out of scope
What this run does not do.

## Constraints
Commercial, audience, legal or technical limits, when they apply.

## Run success criteria
How the user will judge the run as a whole at closeout.

## Merge rule (optional)
For example: "merge each phase PR when CI passes and the user has walked through it".
```

The phase types are `setup`, `design`, `build` and `tooling`. Put design and taste work in
`design` phases (hands-on), and keep `build` phases autonomous.
