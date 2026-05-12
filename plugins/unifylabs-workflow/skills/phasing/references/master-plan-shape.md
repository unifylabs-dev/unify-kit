# Master plan shape

**Read when**: writing the master plan body in execute mode (master plan lifecycle §6 in SKILL.md). The same shape goes into the GitHub tracking issue body OR `<run-dir>/master-plan.md`.

## Skeleton

```markdown
# [phasing] <task description, ≤80 chars>

## TL;DR
- <bullet 1: what this run is doing>
- <bullet 2: why now>
- <bullet 3: what success looks like>
- <bullet 4 (optional): main risk>

## Phases
- [ ] #<issue-N1> phase 1 — <name> — <1-line goal>
- [ ] #<issue-N2> phase 2 — <name> — <1-line goal>
- [ ] #<issue-N3> phase 3 — <name> — <1-line goal>
- ...

(file mode: replace `#<issue-N>` with `phase-N-spec.md`)

The trailing `— <1-line goal>` is the same one-liner that appears under each phase spec's `## Goal` header (truncated to ~80 chars). The phase spec remains the source of truth — the orchestrator's runtime status-block renderer extracts goals from each spec on demand (see SKILL.md "Status block" → "Phase briefs come from each spec's `## Goal`"). The inline copy here exists so a human reading the master plan at the approval gate sees goals without having to open every phase spec.

## Decisions baked in
- **<topic>**: <decision> — <one-line why>
- **<topic>**: <decision> — <one-line why>

## Out of scope
- <thing we're NOT doing in this run, with one-line why>
- <thing we're NOT doing>

## Required reading (discovered during §1 doc-discovery)
- <path or URL> — <relevance>
- <path or URL> — <relevance>

## Run-end verification plan
- [ ] All planned deliverables exist (per phase handoffs)
- [ ] Tests pass on merged result: `<exact command, e.g., pnpm test>`
- [ ] <project-specific check, e.g., "Master design spec §X requirements met">
- [ ] No orphan files (only files declared in phase deliverables)
- [ ] Founder signs off on closure summary

## Self-verification

Passes: <N>

Pass 1: <one-line summary of issues found, or "no issues">
Pass 2: <if run, summary>
Pass 3: <if run, summary>

Final state: <"clean" | "clean after N fixes">
```

## Notes

- **TL;DR is mandatory.** It's what the user reads at the approval gate. 3–5 bullets, plain language.
- **Phases checklist** uses GitHub task-list syntax so checking off phases on the tracking issue is one click. The orchestrator updates this as phases complete. Each line includes the phase's 1-line goal so the approval gate is informative without opening every spec.
- **Decisions baked in** captures the brainstorm/ask/research output. Successor phases ground on these.
- **Out of scope is mandatory.** Empty out-of-scope = signal that phase boundaries weren't thought through.
- **Required reading** is discovered per-run (no hardcoded paths). Skip section if nothing pertinent.
- **Run-end verification plan** is a checklist the orchestrator runs at run-end. Specific, command-driven where possible.
- **Self-verification footer** is mandatory per master plan §4. Not theater — a real second pass over the draft.

## Length

**As long as the work needs.** No cap. No target. This is a software specification, not a Tweet — it follows industry practice for engineering specs: include everything necessary for the executor (a fresh session) to do quality work without improvising or guessing.

Master plans for substantial work routinely run 200, 500, even 1000+ lines in real software shops. If the work requires that, write it. The cost of under-specifying (executor fills gaps with assumptions = hallucinated decisions) is far higher than the cost of over-specifying (extra reading time).

The only signal to stop is: would a competent senior engineer reading this be confused or have to ask questions? If yes, keep going. If no, you're done — even if it's 50 lines, even if it's 500.

Anti-pattern: padding to look thorough. Read what you wrote — every paragraph should answer a question the executor would otherwise have to ask. If not, cut it.
