<!--
onboarding/day-30.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
License: CC BY-SA 4.0
Authored: 2026-05-04
-->

# Day 30 — Soft retrospective and autonomy markers

After 30 days, share with your lead what slowed you down — anything from the kit's docs, the project's docs, the workflows, or the reviewer mapping. One conversation, one paragraph in writing afterwards. No structured form, no rubric, no bulleted retro template. The conversation is the artifact; the paragraph is so it doesn't get lost. The point is to surface friction in the kit and the project's adoption of it, not to produce a deliverable.

## Autonomy markers

These are descriptive, not gated. By day 30, you should generally:

- Be comfortable with `/phase` for medium features, OR be able to articulate why none of your recent work has fit the phasing trigger (small project, slow ticket cadence, mostly-bug-fix queue — all valid).
- Know when to escalate: TDD GREEN failing three times in a row on a single AC, ambiguous AC the lead needs to clarify, an unfamiliar cross-cutting subsystem you don't yet have a mental model for. The cheatsheet calls these out; recognize them in the moment.
- Have merged at least one PR that updated `<consumer>/CLAUDE.md` or another living doc — the living-doc check. If every PR you've shipped has only touched code, you've been skipping the doc-on-ship rule.

These markers describe "the median day-30 dev on a kit-adopting project." They're not gates the kit enforces and they're not checkboxes — markers, not milestones.

## Updates to the kit

If you hit pain points worth fixing in the kit itself — a hook that fires on something it shouldn't, a template field that's confusingly named, a verification command that has a precedence bug — file an issue against the kit's repo. Optional, encouraged. The kit gets better when consumers report what didn't work.

## No hard gates at day 30

Day 30 is a retrospective milestone — there's nothing the kit does about a missed gate. The conversation with the lead is the artifact. If something is broken at day 30, that's a `<consumer>/CLAUDE.md` problem, a kit-issue problem, or a one-on-one conversation problem — none of which the kit can solve by enforcing a checkbox.
