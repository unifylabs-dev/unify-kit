# Intro to unify-kit

> Briefing for devs who know Claude Code but are new to this kit. Reads in
> 15–30 minutes; doubles as a reference. No homework, no checklists —
> just the mental model, what's in the box, and how the pieces fit.

---

## 1. The 30-second pitch

unify-kit is the Unify Labs opinionated starter for Claude Code projects. It
exists because every new project we start hits the same problems: which
plugins do we want, which conventions do we run, which security hooks ship
day-one, what does the CLAUDE.md look like, where do specs live, how do we
keep compliance docs honest. unify-kit answers those questions once, in one
repo, and lets us reuse the answer everywhere.

It's three things at once:

1. **A marketplace** that publishes our workflow plugin.
2. **The plugin itself** — 10 skills, 10 commands, 7 security hooks, an
   opt-in statusline. The team workflow as installable software.
3. **A template tree** — a tier-organized set of files we drop into every
   new project (CLAUDE.md, cheatsheet, PR template, GitHub Actions,
   compliance scaffolding, etc.).

If you remember nothing else: *one repo, three roles* — marketplace,
plugin, templates.

---

## 2. The mental model

### Marketplace

`.claude-plugin/marketplace.json` is the directory entry. When you run
`/plugin marketplace add github.com/unifylabs-dev/unify-kit`, Claude Code
reads this file and learns "Unify Labs publishes one plugin called
`unifylabs-workflow`." We curate one plugin on purpose — the kit's
opinion. Other plugins worth pairing with it (Supabase, Vercel,
superpowers, etc., ~28 in total) live in
[`docs/curated-plugins.md`](../curated-plugins.md) as install pointers, not
as bundled redistribution.

### Plugin

`plugins/unifylabs-workflow/` is the installable artifact. When you run
`/plugin install unifylabs-workflow` you get all of its skills, commands,
hooks, and the statusline registered on your machine. The plugin is
versioned independently in `CHANGELOG.md` — we're on v2.0.1.

### Templates

`templates/` is a 5-tier file tree that `scripts/init-project.sh` lays down
into a target project directory. Some tiers are always applied; others are
opt-in via flags. You scaffold a new project from a single command and get
a CLAUDE.md, cheatsheet, GitHub PR/issue templates, MCP config, security
checklist, compliance docs, and stack-specific snippets — wired together,
placeholders substituted, and tracked by a SHA-256 manifest so re-running
the script is safe.

These three roles compose: the plugin runs *inside* a project scaffolded
by the templates, and the marketplace is just how the plugin gets onto
your machine.

---

## 3. What the plugin actually gives you

### Ten skills, grouped by purpose

**Daily workflow (what you'll use every day)**

- **`work-issue`** — Pick up a GitHub issue and ride the 8-phase rail to a
  merged PR. Phases: spec sync → analysis → branch → planning → strict
  TDD → verification → review → PR. Each phase is a gate; you don't get
  past it without evidence. This is the single most important skill in
  the kit.
- **`ship`** — One-shot commit + push + PR. Used at the end of
  `work-issue` (or any time you're done and want to wrap up cleanly).

**Plan & orchestrate (when work is bigger than one session)**

- **`phasing`** — Decompose a plan into multiple phases, each executed in
  a fresh Claude session with mandatory plan-mode gating. Use it when a
  plan touches multiple subsystems or has natural break points and you
  want re-grounded context between chunks. Backed by the `/phase*`
  command family (see below).
- **`iterative-review`** — Bounded review-fix-verify loop with severity
  gating (Critical always pauses for you; Important auto-fixes;
  Suggestions surface in the report). Auto-detects mode: code, doc, or
  phase-deliverable. Hard cap at 3 iterations so it can't loop forever.

**Review & integrate (when code arrives from outside the standard flow)**

- **`extract-prototype-review`** — Take a *sanctioned* prototype branch
  (`prototype/*`, Draft PR, screenshots, junior intentionally skipped
  auth/tests per `CLAUDE-PROTOTYPE.md`) and extract acceptance criteria +
  visuals into a GitHub issue that `/work-issue` can implement properly.
- **`integrate-branch`** — Audit an external/untrusted branch (contractor
  code, a spike, a junior's GSD branch) against the full set of project
  standards, then route it: salvage (fix in place), rebuild (extract specs
  and rebuild), or discard. Every successful run ends with either a
  standards-compliant PR or a documented decision to throw it away.

**Content & comms**

- **`analyze-comms`** — Drop in an email, PDF, vendor message, legal
  review, or client message and get a structured report with
  implications, risk assessment, and action items framed in your project
  context. Optional humanized draft reply.
- **`humanizer`** — Strip the AI-writing tells (em-dash overuse,
  rule-of-three padding, promotional vocabulary, etc.) out of any draft.
  Useful before sending anything an external party will read.

**Compliance & maintenance**

- **`compliance-research`** — Interactive walk through industry,
  geography, data classes, and customer geography to recommend a
  compliance profile, then gap-analyzes your existing
  `docs/compliance/` against it. Uses context7 + WebSearch (compliance
  evolves; training data lags).
- **`promote-to-marketplace`** — Maintainer flow. Move a personal skill
  or hook from `~/.claude/` into the plugin so the rest of the team gets
  it. Pairs with the `marketplace-drift-check` hook below.

### Ten commands

Nine of the ten commands are the `/phase*` family that supports the
`phasing` skill — they let you start, resume, retry, list, abort,
archive, and check status of multi-phase runs. The tenth is
`/iterative-review` which kicks off the review loop directly. You won't
type most of these by hand; the skills invoke them when needed.

### Seven security hooks (fail-closed)

These run automatically on the right Claude Code events once the plugin
is installed. All seven *block* on failure rather than silently skipping
on missing dependencies — that's a v2.0.1 change worth knowing.

| Hook | What it stops |
|---|---|
| `pre-commit-secrets.sh` | Commits that include API keys, tokens, private keys. |
| `output-secrets-scanner.sh` | Tool output that leaks credentials back to the conversation. |
| `file-guard.sh` | Edits to credential files (`.env`, `*.pem`, etc.). |
| `dangerous-actions-blocker.sh` | Destructive shell patterns: rooted `rm -rf`, SQL `DROP`, `chmod 777`, `dd`, `mkfs.*`. |
| `claudemd-scanner.sh` | Prompt-injection patterns inside CLAUDE.md. |
| `mcp-config-integrity.sh` | CVE-2025-54135 / 54136-class MCP config patterns. |
| `marketplace-drift-check.sh` | Advisory: warns when `~/.claude/skills/*` has skills that haven't been promoted into the plugin yet. |

The point isn't paranoia — it's that you don't have to remember to be
careful. Default-on beats opt-in, because opt-in security is the
security people don't have when they need it.

### Statusline (opt-in)

`statusline/statusline.sh` renders `[Model] [branch] ▓░░ XX% Y∆ cwd` at
the bottom of the terminal. Requires `jq` and `git`. Toggle via `/config`.

---

## 4. How daily work feels

The day-to-day shape with the plugin installed:

```
issue assigned in GitHub
  │
  ▼
/work-issue <N>           ← Phase 0: spec sync. Reads docs/specs/.
                          ← Phase 1: analysis + clarifying questions.
                          ← Phase 2: gh issue develop → branch created.
                          ← Phase 3: plan written, reviewed in plan mode.
                          ← Phase 4: strict TDD (red → green → refactor).
                          ← Phase 5: verification gate (evidence, not vibes).
                          ← Phase 6: review prep + self-review.
                          ← Phase 7: PR created with proper template.
  │
  ▼
/ship                     ← if you're outside /work-issue and just want
                            commit + push + PR in one go.
```

What's happening underneath, that you don't have to think about:

- The seven security hooks watch every commit, every tool call.
- The branch name is wired back to the issue via `gh issue develop` so
  the PR closes the issue automatically.
- Spec changes ship in the same PR as code, never separately.
- TDD is enforced — if a test you didn't write breaks, the implementation
  is wrong, not the test.

---

## 5. Per-project scaffolding

```bash
bash scripts/init-project.sh /path/to/new-project \
  --compliance=<profile> \
  --snippets=<stack> \
  --include=<optional-doc>
```

That single command lays down the five tiers:

| Tier | Always or opt-in | What it ships |
|---|---|---|
| `core/` | Always | CLAUDE.md, cheatsheet, AI usage charter, MCP policy, security checklist, PR template, issue templates, specs index, CODEOWNERS. |
| `claude-runtime/` | Always | `.mcp.json` skeleton, `.claude/settings.json`. |
| `optional/` | `--include=<name>` | team-onboarding.md, methodology-retro.md, llms.txt. |
| `compliance/profiles/` | `--compliance=<profile>` | docs/ + runbooks/ for one or more of: `baseline-pipeda`, `healthcare-phipa`, `financial-canada`, `general-soc2`. |
| `snippets/{nextjs,testing,ci}/` | `--snippets=<stack>` | Stack-specific patterns appended to CLAUDE.md. |

Re-runs are safe: a SHA-256 manifest at
`<project>/.unify-kit-project-manifest.json` records what was applied and
won't overwrite local edits silently.

---

## 6. The compliance system

Four profiles ship in `templates/compliance/profiles/`:

- **`baseline-pipeda`** — Canadian privacy floor. Default starting point
  for Canadian projects.
- **`healthcare-phipa`** — Ontario PHIPA. Extends `baseline-pipeda`.
- **`financial-canada`** — FINTRAC + provincial securities. Extends
  `baseline-pipeda`.
- **`general-soc2`** — SOC 2 Trust Services Criteria mapping + 22-policy
  artifact index. Independent; composes alongside `baseline-pipeda`.

Composition is the trick: a Canadian fintech doing enterprise sales runs
`--compliance=financial-canada,general-soc2` and gets both layered
properly. Each profile drops a `docs/compliance/` tree and a `runbooks/`
set into the target project. If you're not sure which profile fits, run
the `compliance-research` skill — it'll walk you through the decision
and gap-analyze whatever you already have.

---

## 7. Conventions that aren't optional

These live in `docs/methodology.md` in full. The short version:

**Spec-driven development.** Every issue with non-trivial behavior change
lists "Spec sections affected" in its body. Specs ship in the same PR as
the code that implements them — never separately. Module specs run
200–500 lines; journey specs 100–300. Longer than that means you're
documenting implementation instead of behavior; start over.

**Issue-driven development.** Branches are created via
`gh issue develop <N> --name <branch> --checkout --base main`. Naming is
`<type>/<issue-number>-<kebab-description>`. The branch is wired back to
the issue, the issue closes when the PR merges. No ad-hoc branches.

**Strict TDD.** Red-Green-Refactor. If existing tests break, fix the
implementation, not the tests. If GREEN fails three times for the same
acceptance criterion, stop and ask for help.

**Living documents.** CLAUDE.md, README, CHANGELOG, architecture docs —
all update *in the same commit* as the code change that invalidates
them. Stale docs are worse than missing docs because they teach errors.

**Doc-on-ship.** Every PR that ships user-visible behavior updates the
project's living-doc set in the same commit. The PR template enforces
this checklist.

---

## 8. Hierarchy of authority

When two pieces of guidance conflict, follow this order:

```
<consumer>/CLAUDE.md             ← always wins for project-specific rules
  > docs/methodology.md          ← wins over plugin defaults for shared workflows
  > superpowers / other skills   ← skill defaults
  > Claude Code defaults         ← last resort
```

A consumer's CLAUDE.md always wins. The kit's methodology is advisory but
uniform across projects. Plugin defaults are generic. Cite this whenever
someone (or an agent) says "but the skill says X" — the right question
is "what does *this* project's CLAUDE.md say?"

---

## 9. Things to be aware of

Some of these are subtle; all of them bite people.

- **Bash 4+ requirement.** `init-project.sh` uses associative arrays and
  needs Bash 4+. macOS ships Bash 3. Install with `brew install bash` and
  invoke as `/opt/homebrew/bin/bash scripts/init-project.sh ...`. The
  default `/bin/bash` will not work.
- **Plugin install is per-machine, not per-project.** Once you've run
  `/plugin install unifylabs-workflow` you don't run it again for each
  project. The plugin lives at the Claude Code level and applies wherever
  you open a session.
- **Hooks fail closed.** As of v2.0.1, the security hooks block on
  missing dependencies (`jq`, `git`, etc.) rather than silently passing.
  If you see a hook block a tool call, the message will tell you what's
  missing.
- **`compound-engineering` is explicitly excluded.** We opted out. Don't
  add it. If you see references to it in old docs, treat them as stale.
- **Skill set is 10, not 9.** The README currently understates the count
  by one (a known doc drift; will be corrected). The authoritative
  source is `plugins/unifylabs-workflow/skills/` — list it directly if
  in doubt.
- **`dev-symlink-skills.sh` is kit-author only.** It's a one-time
  migration for Tomer's machine. Consumers never run it.
- **Specs live in the consumer project, not in unify-kit.** Each project
  has its own `docs/specs/`. The kit ships *templates* for specs
  (`templates/core/specs/{module,journey,README}.md.template`), not
  specs themselves. The kit's own specs (about the kit) live under
  `specs/` at this repo's root and are kit-authoring concerns.
- **The `phase*` commands are tools for the `phasing` skill.** Don't
  invoke them ad-hoc unless you understand the state machine — the
  skill handles them for you. `/phase-status` and `/phase-list` are
  safe to run standalone; the others mutate run state.
- **Auditing your install.** `scripts/audit-scan.sh ~/.claude/settings.json
  --check-plugin` is a read-only sanity check: it confirms the plugin is
  registered, scans for inline credentials in settings, and flags
  unrestricted MCP servers. Useful if something feels off.

---

## 10. Where to learn more

Inside this repo, in roughly the order a new dev would read them:

- [`README.md`](../../README.md) — the marketing-level summary + quickstart.
- [`docs/philosophy.md`](../philosophy.md) — the *why* behind every other
  component. Five principles. Read once, orient permanently.
- [`docs/methodology.md`](../methodology.md) — the full discipline:
  spec-driven, issue-driven, TDD, living docs, phasing, the doc-on-ship
  rule. Re-read after meaningful kit updates.
- [`docs/curated-plugins.md`](../curated-plugins.md) — the ~28 external
  plugins worth pairing with `unifylabs-workflow`.
- [`templates/README.md`](../../templates/README.md) — the full tier
  inventory and the placeholder vocabulary contract.
- [`CHANGELOG.md`](../../CHANGELOG.md) — what shipped in each version.
  v2.0.0 was the marketplace/plugin/template-tier reshape; v2.0.1
  hardened the hook fail-closed contract and renamed `review-prototype`
  to `extract-prototype-review`.

External pointers:

- The marketplace itself: <https://github.com/unifylabs-dev/unify-kit>
- Per-project example: any repo scaffolded with `init-project.sh` will
  have its own `CLAUDE.md`, `docs/specs/`, and `docs/compliance/` — the
  same kit, with the project-specific overrides filled in.

---

That's the kit. Everything else is detail you'll absorb by using it.
