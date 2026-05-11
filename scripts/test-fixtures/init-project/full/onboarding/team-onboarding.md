<!--
templates/team-onboarding.md.template
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern reference: the day-1 / week-1 / day-30 cadence echoes the kit's own
onboarding curriculum (onboarding/day-1.md etc.); content here stitches the
curriculum to project-specific particulars.
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Welcome to TestProject

Welcome to Unify Labs Test Team. The first 30 days have a rhythm: get running on day
one, internalize conventions over week one, and run your own work autonomously
by day 30. This file points you at what to read and what to do; it doesn't
restate content that lives in the kit's own onboarding curriculum or in the
cheatsheet.

## 1. Day 1 — get the dev loop running

- [ ] Install the project's prerequisites per `README.md` (`TypeScript 5.4`, package manager, database, secrets).
- [ ] Clone the repo from https://github.com/unifylabs-dev/test-project.
- [ ] Bootstrap your `~/.claude` (see §4 below).
- [ ] Run the test suite locally: `npm run test:full`.
- [ ] Open the running app, log in, click around.

## 2. Required reading (90 minutes total)

Skim each in order; depth comes later.

- `<consumer>/CLAUDE.md` — the project memory file. Read start-to-finish.
- `docs/architecture.md` (or equivalent) — the system shape.
- `templates/cheatsheet.md.template` — daily commands, daily skills, reviewer
  mapping (Appendix A). The pocket reference.
- `templates/ai-usage-charter.md.template` — what AI is and isn't permitted to do
  in this codebase.

## 3. Day 1 / Week 1 / Day 30

Replace or extend the kit's defaults with project-specific overrides as needed.

- **Day 1** — see [`onboarding/day-1.md`](../onboarding/day-1.md) for the
  hard-gate checklist (objectively verifiable items only).
- **Week 1** — see [`onboarding/week-1.md`](../onboarding/week-1.md) for the
  soft milestones around conventions, workflows, and pair-reviews.
- **Day 30** — see [`onboarding/day-30.md`](../onboarding/day-30.md) for the
  retrospective conversation and autonomy markers.

### 4-week ramp

Soft milestones (not gates) that flesh out the Day-1 / Week-1 / Day-30
frame above with concrete weekly shape. Adjust priorities and pairing
cadence to fit the team.

- **Week 1 — Environment + docs.** Run the bootstrap script. Required
  reading per the curriculum (kit's `onboarding/day-1.md` +
  `docs/methodology.md` + the consumer's CLAUDE.md + architecture). Open
  one trivial PR to satisfy the day-1 hard gate and feel the PR template.
- **Week 2 — Paired `/work-issue` on a P3 issue.** Pick a low-stakes P3.
  Run `/work-issue <N>` end-to-end with founder/lead pair-review on each
  phase. Goal: feel the 8-phase flow without solo accountability for AC
  interpretation or spec-delta judgment.
- **Week 3 — Solo on a P2 issue.** Pick a P2. Run `/work-issue <N>` solo
  through PR creation. Pair-review only on the open PR — the prior phases
  are yours.
- **Week 4 — Real backlog.** Pick from the actual backlog (any priority).
  Solo through merge. By now the loop is internalized; review continues
  but is no longer a learning gate.

The ramp is intentionally soft — Week 4 doesn't auto-trigger production
access or unlock specific permissions. It's a confidence ladder, not a
certification track.

## 4. Bootstrap

Run `scripts/bootstrap-claude-config.sh` from a checkout of the kit repo. The
script:

- Performs a matcher-aware deep-merge of the kit's hook registrations into your
  `~/.claude/settings.json`. Existing entries are preserved; backups are
  mandatory and timestamped.
- Installs the six security hooks at `~/.claude/hooks/` (or preserves your
  edits if you've customized them, unless you pass `--force`).
- Records a manifest at `~/.claude/.unify-kit-manifest.json` with kit version
  and per-artifact SHA-256 — that's the basis for safe upgrades later.

After bootstrap, run `scripts/audit-scan.sh ~/.claude/settings.json`; expect
exit 0 and zero `[critical]` findings.

## 5. Who to ask

| Area | Owner | Channel |
|---|---|---|
| <e.g., auth / payments / schema migrations> | <name> | <Slack handle / email> |

Replace the placeholder rows with the project's code-area owners. Keep the
table short — three to five rows is plenty. The point is "who do I ask first?",
not "who are all the experts?".
