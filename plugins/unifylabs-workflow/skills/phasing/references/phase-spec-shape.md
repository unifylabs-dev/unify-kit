# Phase spec shape

**Read when**: writing each phase's spec (the GitHub phase issue body OR `<run-dir>/phase-N-spec.md`). One per phase.

## Skeleton

```markdown
# Phase N — <name>

## Goal
<One paragraph, observable. "When this phase is done, X is true." Not "Build the auth flow"
(too vague). "Users can log in with email/password and get a JWT in the response" (observable).>

## Cross-phase landscape
- Phase 1 — <name>: <one-line summary, status>
- Phase 2 — <name> ← YOU ARE HERE
- Phase 3 — <name>: <one-line summary>
- Phase 4 — <name>: <one-line summary>

(Always include EVERY phase in the run, marked with arrow on this one. Reason: phase sessions
need full landscape awareness — most phases are independent of each other in execution but still
need to know where they sit.)

## Inputs (required reading)
- master plan: #<tracking-issue-number> (or `<run-dir>/master-plan.md`)
- predecessor handoff: #<issue> (or `<run-dir>/phase-<N-1>-handoff.md`) — only if there is one
- relevant project files: <paths>
- shared spec docs (if any): <paths>

## Decisions already baked in
- <decision from master plan>: <constraint it imposes>
- <decision from predecessor handoff>: <constraint>

## Work
1. <ordered step>
2. <ordered step>
3. ...

For code phases: TDD pattern explicit (write test → run → see fail → implement → run → see pass).
For writing/research/design: outline / source list / alternatives to consider.

## Deliverables
- `<path>` — <what>
- `<path>` (new file) — <description>
- `<path>` (lines <a>–<b>) — <update description>

## How it should be done (approach guidance)
<Free-form: best practices, gotchas, library references, examples to mirror, anti-patterns to
avoid. This is what makes the phase produce QUALITY work, not just complete work.>

## Verification
- command: `<exact shell command>` — exit 0
- check: `<criterion against deliverable>` — confirmed by phase
- review: `<acceptance criterion>` — confirmed against deliverable

## Out of scope
- <bullet>
- <bullet>
```

## Notes

- **Goal must be observable.** If you can't write "when this phase is done, <X> is true and you can verify <X> by <method>", the goal is too vague. Sharpen it.
- **Cross-phase landscape is full picture, not just neighbors.** Even independent phases benefit from awareness of their siblings.
- **Inputs section drives the §1 load step** in the phase session. Be exhaustive — anything missing here = phase session has to figure it out cold.
- **Decisions already baked in** prevents re-litigating past choices. Successor phases must respect; if they want to override, they raise an open question, they don't silently change it.
- **Work steps** are ordered. The phase session may follow them as-is or use them as scaffolding for its plan-mode plan.
- **Deliverables list is the verification anchor.** Every deliverable should appear in the handoff's "Deliverables" section.
- **How it should be done** is where you encode quality. Best practices, gotchas, library docs, examples to mirror. Not bureaucratic; substantive.
- **Verification is mandatory and non-empty.** At least one of: command / check / review. Code phases SHOULD include at least one `command` step (TDD enforcement). See `verification-types.md`.
- **Out of scope is mandatory.** Empty = poorly bounded phase. Force yourself to articulate.

## Length

**As long as the work needs.** No cap. No target. This is a software engineering spec — it follows industry practice: include every piece of information a developer needs to execute the work to a high standard without guessing.

In real engineering shops, specs for non-trivial work routinely span hundreds of lines. They include: detailed requirements, every design decision and its rationale, edge cases, examples, library references, gotchas from prior similar work, anti-patterns to avoid, performance targets, security considerations, accessibility requirements. If your phase needs all of that to land with quality, the spec includes all of that.

The cost of under-specifying is far higher than the cost of over-specifying:
- Under-spec → fresh session improvises → quality decisions made by the wrong actor → hallucinated grounding for downstream phases.
- Over-spec → fresh session reads more → slightly slower start → no quality loss.

The only valid stopping signal: would a competent senior engineer reading this spec have unanswered questions before they could write a quality plan? If yes, keep adding. If no, you're done — even if the spec is 60 lines, even if it's 600.

Anti-pattern: padding to look thorough. Every paragraph should preempt a question the fresh session would otherwise ask. If you can cut a paragraph and the executor would still have everything they need, cut it. But never trim because of a length anxiety.

## Anti-patterns

- Vague goals ("Build auth", "Improve performance") → sharpen until observable.
- Empty `Decisions already baked in` when the master plan has decisions → copy them in; don't make the phase re-derive.
- Empty `Out of scope` → force articulation; otherwise scope creep.
- Verification with only `check` and no `command` for code phases → add a `command` step (test runner, build, etc.).
