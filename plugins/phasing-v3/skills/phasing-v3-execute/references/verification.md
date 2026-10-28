# Checking a phase

A phase is complete only with evidence from checks against the real thing. In past runs, phases
that passed every self-check were reopened after independent review, the user's walk-through,
CI or live use found real defects.

## a. Deterministic checks

- The test suite, plus a count guard: write down how many test files ran and how many were
  expected. Why: a test runner once dropped files under load and still reported a pass.
- Build and type check.
- CI green on the phase pull request.

## b. One independent review round

- Fresh reviewers that did not write the code: the built-in `/code-review`, plus one reviewer
  who reads the acceptance rows and checks the handoff draft's claims against the code.
- Reviewers report correctness bugs and requirement gaps only.
- Fix the important findings now. Fix or drop minor ones; do not carry them.
- One round. A second review round churned without finding more in past runs.

## c. Agent walk-through (UI phases)

Before the user looks, an agent drives the running app like a user (Playwright or Chrome) at the
widths the project uses. It reports broken or stuck flows with screenshots. This spends the
user's time on taste, not on bugs.

## d. Live use (tooling phases)

Install the built tool as the user would (a stock shell, the real config) and use it for real.
A pass by reading the code, or a pass through a fallback path, does not count for a behaviour
claim.

## e. The user's walk-through (UI) or fidelity sign-off (design)

Ask for it once the other checks pass, with a link or a running URL.

## Per-task review

After a risky task (data integrity, auth, migrations, concurrency), have a fresh reviewer check
that task before moving on. A per-task review once caught a change that would have deleted the
user's own data.
