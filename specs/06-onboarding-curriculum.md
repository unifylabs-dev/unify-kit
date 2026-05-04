# Spec 06 — Onboarding Curriculum

> Status: Draft / awaiting review
> Depends on: 00 (glossary), 01 (filename canon), 02 (consumed by `templates/team-onboarding.md.template`, `templates/cheatsheet.md.template`, `templates/ai-usage-charter.md.template`), 05 (`scripts/bootstrap-claude-config.sh`, `scripts/audit-scan.sh`)
> Related: 07 (philosophy is the *why*)

## Purpose

Specify the day-1 / week-1 / day-30 curriculum that ships in `onboarding/`. The
curriculum is **stack-agnostic** — it teaches how to work *with this kit*, not how
to work in a specific codebase. Project-specific onboarding lives in each project's
`<consumer>/CLAUDE.md` and `templates/team-onboarding.md.template` instance.

## Why this exists

Every project has its own onboarding doc, but the *meta-onboarding* — how to use
Claude Code well in a project that has adopted this kit — is reusable. Codifying it
once means new devs joining any kit-adopting project have the same baseline.

## Sourcing mode

`pattern-only` — the Ultimate Guide's `learning-path/` *shape* (multi-module
structured progression, gated checklists per phase) inspires this curriculum.
Content is original.

## Structure

```
onboarding/
├── README.md          curriculum overview, who it's for, how it integrates
├── day-1.md           getting set up + the bare minimum for first contribution
├── week-1.md          conventions, workflows, the core skills
└── day-30.md          retrospective and competency markers
```

## `README.md` content

- Audience: a new dev joining a project that uses this kit
- Pre-requisites: Claude Code installed; access to the project repo; the project's
  `<consumer>/CLAUDE.md` and project `team-onboarding.md` are the source of project
  specifics
- How to use the curriculum: in order; each phase has an end-of-phase checklist

## `day-1.md` — Get running, ship something tiny

**Goals:** the new dev has a working environment, has read the right docs, has made
one trivial commit/PR before EOD.

**Sections:**

1. **Set up your machine** — install Claude Code, verify with `claude --version`,
   point to the project's `setup_guide.md` for stack-specific install steps.
2. **Bootstrap your `~/.claude`** — run `scripts/bootstrap-claude-config.sh` from
   the kit repo. Confirm hooks installed via `audit-scan.sh`.
3. **Required reading** (~90 minutes total):
   - The project's `<consumer>/CLAUDE.md` start-to-finish
   - The project's `docs/architecture.md` (or equivalent)
   - The kit's `templates/cheatsheet.md.template` (for command vocabulary)
   - The kit's `templates/ai-usage-charter.md.template` (for what's permitted)
4. **Verify your tooling:**
   - Open Claude Code; confirm `using-superpowers` skill loads (signal that
     superpowers plugin is enabled).
   - Try `/help` and skim available commands.
   - Verify a hook fires: deliberately try `rm -rf /tmp/test-blocked-by-hook` —
     expect block.
5. **Ship something trivial:**
   - Pick a `good-first-issue` ticket (or fix a typo in docs).
   - Run `/work-issue <N>` end-to-end (analyze → branch → plan → TDD if applicable
     → verify → review → PR).
   - Confirm `/claude-review` posts review comments on the PR.

**Day-1 hard gates** (these must check; objectively verifiable):

- [ ] `bootstrap-claude-config.sh` exits 0 — output captured in your terminal
- [ ] `audit-scan.sh ~/.claude/settings.json` exits 0 with zero `critical` findings
- [ ] First PR opened against the project repo (any branch with at least one
      committed change)
- [ ] `/claude-review` invoked on that PR and a tiered review comment is posted

**Day-1 soft guidance** (encouraged, not gated — moved out of checklist per review):

- Read CLAUDE.md
- Join the team's communication channel
- Pair with a senior on your first ticket if available

## `week-1.md` — Internalize conventions and workflows

**Goals:** the new dev fluently runs the canonical workflows, understands the test
pyramid, and knows which skills/reviewers to invoke when.

**Sections:**

1. **Workflows** — when to use each. References
   `templates/cheatsheet.md.template` for the canonical command list (this spec
   does **not** restate it):
   - `/work-issue <N>` for issue-tracked work
   - `/brainstorm` → `writing-plans` → `executing-plans` for ambiguous features
   - `/phase` for cross-cutting work (8+ files, multiple subsystems, natural break
     points)
   - `/lfg` for autonomous mode on well-scoped work
   - `/ship` for the final commit/push/PR step
2. **Skills you invoke** — references
   `templates/cheatsheet.md.template` for the daily-skills list (this spec does
   **not** restate it).
3. **Reviewers you invoke** — references the **Appendix A** of
   `templates/cheatsheet.md.template` for the canonical "which reviewer when"
   mapping (this spec does **not** restate it).
4. **Test pyramid:** the project's testing strategy lives in `<consumer>/CLAUDE.md`.
   Read it. Understand which tier runs when.
5. **Documentation rhythm:** doc-on-ship rule (per `<consumer>/CLAUDE.md`'s
   Documentation Requirements section). The specific files to update vary by
   project.
6. **Pair an end-to-end feature:** pick a feature ticket; pair with a senior; run
   it through the full flow.

**Week-1 soft milestones** (advisory checklist, not gates — per review reversal):

- Two `/work-issue` PRs merged
- One feature run through `/brainstorm` → `writing-plans` → execution
- Reviewed two teammates' PRs (with `/review` invoked + at least one
  compound-engineering reviewer agent)
- Familiarity with the project's test pyramid demonstrated in conversation

## `day-30.md` — Retrospective and autonomy markers

**Goals:** identify what's working, what's slowing the new dev down, and confirm
they're operating autonomously.

**Soft retrospective** (replaces the previous bulleted-prompts ritual): after 30
days, the new dev shares what slowed them down with their lead. One conversation,
one paragraph in writing. No structured form.

**Autonomy markers** (descriptive, not gated):

- Comfortable with `/phase` for medium features OR can articulate why none of their
  recent work fit the phasing trigger (small projects, slow ticket cadence — both
  pass).
- Knows when to escalate (TDD GREEN failing 3×, ambiguous AC, unfamiliar
  cross-cutting subsystem).
- Has merged at least one PR that updated `<consumer>/CLAUDE.md` or another living
  doc — the living-doc check.

**Updates to the kit:** if the new dev hit pain points worth fixing in the kit
itself, file an issue against this repo. (Optional, encouraged.)

**No hard gates at day 30.** Day-30 is a retrospective milestone — there's nothing
the kit does about a missed gate. The conversation with the lead is the artifact.

## Customization for projects

Projects adopting the kit can:

- Override any phase's checklist by editing their `templates/team-onboarding.md`
  instance.
- Add project-specific reading material to the day-1 list.
- Skip activities that don't apply (e.g., a solo project doesn't need the "pair
  with a senior" item).

The kit's curriculum is the *default*; the project's onboarding is the *truth*.

## Decisions needed

All curriculum-level decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | Cadence | 1d / 1w / 30d. Alternatives noted in `README.md` for projects that need to override. |
| 2 | Curriculum length per file | ~1000 words each — long enough to be substantive, short enough to read in 30 minutes. |
| 3 | "How Claude Code works" primer for newcomers | Out of scope. Link to Claude Code official docs. |
| 4 | Day-30 retro format | Single conversation + one paragraph in writing. No structured prompts. |
| 5 | Gating | Day-1 hard (objectively verifiable items only). Week-1 soft (advisory). Day-30 soft (retrospective). |

## Out of scope

- A "how to use Claude Code" primer for absolute beginners.
- Project-specific onboarding (lives in each project's `team-onboarding.md`).
- Performance reviews or HR-style 30/60/90 plans.
- Restating cheatsheet content in the curriculum (single source of truth in
  `templates/cheatsheet.md.template`).

## Acceptance criteria

- All four files (`README.md` + `day-1.md` + `week-1.md` + `day-30.md`) present in
  `onboarding/` with the proposed sections.
- Day-1 has a hard checklist of objectively verifiable items only (no "read X" or
  "join Y").
- Week-1 and day-30 have soft milestones / advisory items, no hard gates.
- Cross-references to `templates/cheatsheet.md.template`,
  `templates/ai-usage-charter.md.template`, and the project's own `<consumer>/CLAUDE.md`
  are by anchor (relative paths or clearly-labeled externals); no restated content.
- Spec 09's `lint.yml` link-check passes against all relative anchors in this
  curriculum.

## Revisions

Addressed: R-003 (tier vocabulary removed; project's audience is in spec 00 and not
referenced here), R-010 (curriculum cites
`templates/cheatsheet.md.template` for command list, daily skills, reviewer mapping
— does not restate), R-025 (day-1 hard gates are now objectively verifiable
artifacts; "read CLAUDE.md", "joined channel", "5 PRs merged" moved to soft guidance),
R-026 (week-1 references cheatsheet rather than restating), R-027 (day-30 retro
reduced to one-sentence guideline; bulleted prompts and "filed at least one
improvement issue" cut), R-028 (gating reversed: day-1 hard, week-1 soft, day-30
soft).
