# Phase types

Each phase has a type, named in the brief's title. The type sets how hands-on the user is and
how the work is checked.

## build

Autonomous. The user checks at phase end. Work through the acceptance rows in order of
dependency. Reversible calls are yours; record them.

Cloud-capable: not yet. A cloud thread cannot see the run folder, which stays local during a run.

## design

Hands-on. Load the `impeccable` skill first when it is installed: it sets the directions, the
critique and the polish. Three past runs invented these steps on their own; follow them:

1. **Decide.** Show options on real routes or screens, each with a recommendation and your
   critique first.
2. **Lock.** Write the chosen direction in `decisions.md` at the moment it is chosen.
3. **Cheap draft.** An HTML page or artifact the user approves before any expensive build.
4. **Build.**
5. **Fidelity check.** Screenshots against the approved draft at the widths the project uses.
6. **Sign-off.** The user signs off on the result.

Show deviations and product questions together, on one page, then ask once.

Cloud-capable: no. The user looks at the work as it forms.

## tooling

Like build, but the proof is live use: install the tool the way the user would and use it for
real (`verification.md`, live use).

Cloud-capable: no. Live use needs the user's real setup.

## setup

Used in the first phases of a run. Accounts, environment, deploy target and CI. The result is a
deployed walking skeleton, or a live install for tooling. Put every human-only step (accounts,
keys, sign-ins) in one checklist at the top, so the user does them in one sitting.

Cloud-capable: no. It touches the user's accounts and machine.
