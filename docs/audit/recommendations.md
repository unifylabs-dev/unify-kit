# Recommendations — what to actually adopt

Tiered against the three stated goals:

- 🎯 **Onboarding** — getting two new devs productive on `optics-management` quickly.
- 🤝 **Team consistency** — uniform tooling, conventions, and AI usage across the team.
- 🛡️ **Safety / security** — guardrails and audit trails as the team widens.

Every Tier-1 and Tier-2 item lists: source, effort, location, why, and which goal(s).

---

## Tier 1 — Adopt now (high confidence, low effort)

These pay back fast and are low risk. Recommended order matches priority.

### T1.1 — Two security hooks at user level
**Goal:** 🛡️ + 🤝
**Source:** `examples/hooks/dangerous-actions-blocker.sh` and
`examples/hooks/pre-commit-secrets.sh` (both CC0)
**Effort:** ~30 min total (drop in `~/.claude/hooks/`, register in `settings.json`)
**Where:** `~/.claude/hooks/` + matching `hooks` block in `~/.claude/settings.json`
**Why:**
- We currently have only `gsd-statusline.js` in hooks.
- `optics-management/.claude/settings.local.json` already contains inline `node -e`
  commands with embedded DB credentials — direct evidence we've been one screen-share
  away from a credential leak.
- New devs running `defaultMode: auto` need a floor.
**Caveat:** Each new dev should install these in *their* `~/.claude` — recommend a
short shell script in our team docs that installs them.

### T1.2 — `output-secrets-scanner.sh` + `file-guard.sh`
**Goal:** 🛡️
**Source:** `examples/hooks/output-secrets-scanner.sh`,
`examples/hooks/file-guard.sh` (both CC0)
**Effort:** ~15 min
**Where:** Same as T1.1
**Why:** `optics_boutique/.env` exists. `file-guard.sh` blocks any modification.
`output-secrets-scanner` is a second-line defense against accidental secret echo into
chat output during demos or screen recordings.

### T1.3 — `claudemd-scanner.sh` + `mcp-config-integrity.sh`
**Goal:** 🛡️
**Source:** `examples/hooks/claudemd-scanner.sh`,
`examples/hooks/mcp-config-integrity.sh` (both CC0)
**Effort:** ~20 min
**Where:** Same as T1.1
**Why:**
- `mcp-config-integrity.sh` is mapped to **CVE-2025-54135 / CVE-2025-54136**. We use
  `optics-management/.mcp.json` and have `enableAllProjectMcpServers: true`. Tamper
  detection costs nothing here.
- We have ~14 CLAUDE.md files across the repo (root + 12 worktrees + 1 in
  `.worktrees/prototype-workflow`). One injected file would compromise sessions.
  `claudemd-scanner.sh` runs at session start — cheap defense.

### T1.4 — `audit-scan.sh` script in our team docs
**Goal:** 🤝 + 🛡️
**Source:** `examples/scripts/audit-scan.sh` (CC0)
**Effort:** ~15 min (drop into `optics-management/.claude-team/scripts/` or similar)
**Where:** New `.claude-team/` folder in `optics-management/` (or whatever folder we
adopt from the README's onboarding doc — see T2.1)
**Why:** A one-command "is your `~/.claude` healthy?" check we can ask new devs to run
on day 1. Outputs human or JSON. Low effort, high signal.

### T1.5 — `llms.txt` at the repo root of `optics_boutique/`
**Goal:** 🎯
**Source:** Standard format (the framework ships one as a reference)
**Effort:** ~30 min (write our own, ~1K tokens)
**Where:** `optics-management/optics_boutique/llms.txt`
**Why:** Adopting the standard makes the repo legible to *any* LLM tool the team adopts,
not just Claude Code. Should point to: `CLAUDE.md`, `docs/architecture.md`, `docs/PRD.md`,
`docs/reference_docs.md`, the user guide, and the test strategy. The file is our 1-K-token
elevator pitch of the codebase.

### T1.6 — One GitHub Actions workflow: comment-triggered review
**Goal:** 🎯 + 🤝
**Source:** `examples/github-actions/claude-code-review.yml` +
`examples/github-actions/prompts/code-review.md` (both CC0)
**Effort:** ~1 hr (install workflow, set `ANTHROPIC_API_KEY` repo secret, customize
prompt for our PHIPA + Server Action conventions)
**Where:** `optics-management/optics_boutique/.github/workflows/claude-code-review.yml`
**Why:**
- Triggers only on `/claude-review` PR comment — opt-in, not noisy.
- Tiered output (🔴 MUST FIX / 🟡 SHOULD FIX / 🟢 CAN SKIP) + inline comments matches our
  existing review vocabulary.
- New devs get fast feedback before tagging a senior — flattens the review queue.
- Read-only tools — safe.

**Skip for now:** the auto-review-on-every-PR variant (`claude-pr-auto-review.yml`).
Noisy, and we'd rather see the comment-triggered one in practice first before opting
into automatic on every PR.

### T1.7 — Strip embedded credentials from `optics-management/.claude/settings.local.json`
**Goal:** 🛡️
**Source:** Internal hygiene; the framework's existence merely surfaced it
**Effort:** ~30 min
**Why:** That file currently contains inline `node -e` Bash permissions with the
production-pooler `postgresql://postgres.…@aws-1-ca-central-1.pooler.supabase.com:5432/`
URL **and the password**. If the file is ever committed (it's a `.local.json` so should
be gitignored, but verify), or shared in a screen-share, the credential is exposed.
Replace those entries with `Bash(node -e:*)` permissions plus a script wrapper that
reads `DATABASE_URL` from `.env`. Also rotate the password.

> **This is the highest-priority item in the doc.** It's pre-existing state, not new
> work — but the audit surfaced it and onboarding more devs widens the blast radius.

---

## Tier 2 — Adopt soon (small build required)

### T2.1 — Team onboarding doc: `optics-management/.claude-team/TEAM_ONBOARDING.md`
**Goal:** 🎯 + 🤝
**Source:** Net-new, but informed by `examples/scripts/ai-usage-charter-template.md` +
the framework's learning-path *shape*
**Effort:** ~3-4 hr (one focused session)
**Where:** New `.claude-team/` folder at the optics-management root, separate from the
product's `docs/`
**Contents (proposed):**
- **Day 1 — Get running:** install Node 22.12, clone, `npm install`, `npm run db:push`,
  `npm run db:seed`, `npm run dev`. Install our two security hooks (T1.1) via a
  bootstrap script. Read `CLAUDE.md`. Verify with `audit-scan.sh` (T1.4).
- **Day 2-3 — How we use Claude Code:** which plugins are enabled, when to use
  `/work-issue` vs `/phase` vs `/lfg` vs ad-hoc. Required reading: `using-superpowers`
  → `brainstorming` → `writing-plans` → `executing-plans` → `test-driven-development` →
  `verification-before-completion`.
- **Week 1 — Conventions:** Server Action anatomy, audit logging, rate limiting,
  middleware, branch naming, worktree-per-feature, 4-tier test strategy.
- **Week 2 — Advanced workflows:** phasing, multi-agent reviews
  (`/review`, `/lfg`, `pr-review-toolkit`), TDD enforcement, the 8-phase `/work-issue`
  flow.
- **Week 3+ — On demand:** `frontend-design`, `ui-ux-pro-max`, `compound-engineering`
  reviewers, custom MCP integrations.
- **Always-on rules:** PHIPA compliance, doc-on-ship requirement, user-guide-on-feature
  requirement, PR merge process.
**Why:** This is the single highest-value deliverable for new-dev onboarding. The
framework's learning-path module structure is a useful skeleton; the content has to be
written around our stack.

### T2.2 — Team AI usage charter
**Goal:** 🤝 + 🛡️
**Source:** `examples/scripts/ai-usage-charter-template.md` as a starting point
**Effort:** ~1 hr to draft, then team review
**Where:** `optics-management/.claude-team/AI_USAGE_CHARTER.md`
**Contents:**
- What's in / out of scope for AI assistance (e.g., never paste customer PHI into
  prompts; never ask the AI to commit secrets to docs).
- Required sequences (e.g., `/work-issue` for issue-tracked work; `/ship` for the final
  step; brainstorming before non-trivial new features).
- MCP policy: only approved MCPs. Current allowlist: `supabase`, `playwright`,
  `compound-engineering:context7`, `claude_ai_Gmail/Calendar/Drive`. Adding requires PR.
- Handling AI-generated code: must run through TDD; must pass full `npm run test:run`
  before PR.
**Why:** As the team grows past two people, "we just trust each other" stops scaling.
A short written charter sets expectations.

### T2.3 — Cheatsheet (1-page, our stack)
**Goal:** 🎯
**Source:** Net-new, inspired by the framework's `cheatsheet.md`
**Effort:** ~1 hr
**Where:** `optics-management/.claude-team/CHEATSHEET.md`
**Contents:** The 15-20 commands new devs will use most:
- `/work-issue <N>`, `/phase`, `/lfg`, `/ship`, `/review`, `/brainstorm`, `/triage`
- `/commit`, `/commit-push-pr`
- superpowers skills: `brainstorming`, `writing-plans`, `executing-plans`, TDD,
  `verification-before-completion`, `using-git-worktrees`
- compound-engineering reviewers and when to invoke each
- `npm run` scripts (test:ci, test:run, test:e2e:daily, build, dev, db:push, db:seed)
- `/clear` and `/compact` thresholds
- The 8-phase `/work-issue` cheatsheet (1 line per phase)
**Why:** New devs will need this on the wall. Short, specific to our stack.

### T2.4 — MCP vetting policy doc
**Goal:** 🛡️ + 🤝
**Source:** Framework's 5-step MCP vetting workflow + `mcp-registry-template.yaml`
**Effort:** ~1 hr
**Where:** `optics-management/.claude-team/MCP_POLICY.md`
**Contents:** Provenance check, code review for any non-Anthropic MCP, permission
review, sandboxed test, monitoring. Plus the team's current allowlist (matches T2.2).
**Why:** A short doc beats no doc when a new dev wants to install something. Cheap.

### T2.5 — Lift verbatim: `security-checklist.md`
**Goal:** 🛡️
**Source:** `examples/skills/security-checklist.md` (CC0)
**Effort:** ~15 min (lift, edit the few items not relevant to a Next.js app)
**Where:** `optics-management/.claude-team/SECURITY_CHECKLIST.md` — referenced from
the team CLAUDE.md and onboarding doc
**Why:** Generic OWASP Top-10 reference; useful pre-PR cross-reference.

---

## Tier 3 — Watch / defer

These are real but not urgent.

- **`claude-security-review.yml`** GH Action — adopt later if T1.6 proves valuable.
  PHIPA app justifies it; just not week 1.
- **`claude-pr-auto-review.yml`** — only after T1.6 is well-understood and the team
  agrees it would help (not just nag).
- **`audit-agents-skills/` skill + matching command** — useful when we have 4-5 devs
  and config drift becomes real.
- **`session-stats.sh` / `session-search.sh`** — cost-tracking utility; pick up if
  Anthropic spend becomes a question.
- **`threat-db.yaml`-driven scanner** — interesting; build a small wrapper that scans
  installed plugins against the CVE/malicious-skill catalog. Quarterly check.
- **`update-threat-db.md` command** — keeps the catalog fresh. Pair with the scanner.
- **`ast-grep-patterns.md` reference** — pull in if/when we do a large refactor.
- **271-question quiz** — fun but optional. Not load-bearing for our team's skill.

---

## Skip explicitly (and why)

- **Their methodology docs (TDD/SDD/BDD/GSD)** — our superpowers TDD is enforced;
  brainstorming and writing-plans cover SDD; we don't need a generic methodology layer.
- **Their `methodology-advisor.md`** — we already know which methodology applies where.
- **Their flat reviewer agents** (`code-reviewer.md`, `architecture-reviewer.md`,
  `security-auditor.md`, `test-writer.md`, `refactoring-specialist.md`,
  `integration-reviewer.md`, `devops-sre.md`, `implementer.md`, `planner.md`,
  `planning-coordinator.md`, `plan-challenger.md`, `output-evaluator.md`,
  `loop-monitor.md`, `security-patcher.md`) — duplicates of compound-engineering's
  reviewer suite, often weaker (less language-specific, no domain affinity).
- **Their slash commands that duplicate ours**: `commit`, `pr`, `review-pr`,
  `generate-tests`, `git-worktree*` (4), `plan-*` (5), `scaffold`, `ship`, `refactor`,
  `qa`, `explain`, `release-notes`, `validate-changes`, `optimize`, `investigate`,
  `diagnose`. Adding these dilutes the menu and confuses new devs.
- **Their MCP server (`mcp-server/`)** — `compound-engineering:context7` already covers
  live-doc lookup; we don't need a guide-querying MCP.
- **`reference.yaml`** — their internal index; not useful to copy.
- **Bulk skill imports** (`landing-page-generator/`, `talk-pipeline/`, `voice-refine/`,
  `ccboard/`, `cyber-defense-team/`, `rtk-optimizer/`, `eval-rules/`, `eval-skills/`,
  `design-patterns/`, `guide-recap/`, `token-audit/`) — not relevant to our work.
- **Their CLAUDE.md template** — ours is far more mature; theirs would be a downgrade.

---

## Keep doing (don't churn)

- **Phasing system** as the orchestration layer for big work.
- **superpowers** as the canonical skill discipline:
  `brainstorming → writing-plans → executing-plans → TDD → verification-before-completion`.
- **compound-engineering** for parallel reviews, autonomous workflows (`/lfg`),
  triage, and language-specific reviewers.
- **`/work-issue`** as the default issue-driven flow, with mandatory ACs and 8 phases.
- **Worktree-per-feature** (the existing `.worktrees/` and `worktrees/` dirs).
- **`optics_boutique/CLAUDE.md`** as the project memory — keep updating it living-doc
  style. It is the gold standard.
- **4-tier testing** + doc-on-ship + user-guide-on-feature + PR merge checklist.

---

## Onboarding-specific roadmap (the two new devs)

### Before they arrive (this week)
- Complete **T1.7** (rotate credential, sanitize `.claude/settings.local.json`).
- Complete **T1.5** (`llms.txt`).
- Draft **T2.1** (`TEAM_ONBOARDING.md`) so it's ready day 1.
- Draft **T2.3** (cheatsheet).
- Optionally: **T1.6** (GH Action) — give yourself a week of soak time before new devs
  arrive.

### Their day 1
- They run a 5-line bootstrap script that:
  1. Installs the four security hooks (T1.1, T1.2, T1.3) into their `~/.claude/hooks/`
  2. Updates their `~/.claude/settings.json` to register them
  3. Runs `audit-scan.sh` and reports green
- They read `TEAM_ONBOARDING.md` Day-1 section
- They read `optics_boutique/CLAUDE.md` start-to-finish
- They run the app locally, log in, click around
- They invoke `using-superpowers` once to understand how skills work

### Their week 1
- Complete a small `/work-issue` end-to-end on a starter ticket
- Read T2.3 cheatsheet, T2.5 security checklist
- Pair-review another dev's PR with `/review` invoked
- Run `/brainstorm` once, then `writing-plans`, then `executing-plans` on a small
  feature — to feel the hard gates

### Their day 30
- Independent on `/work-issue`
- Comfortable invoking phasing for medium features
- Have updated `optics_boutique/CLAUDE.md` at least once (a "living document" check)
- Know which compound-engineering reviewer to invoke when

---

## Effort summary

| Tier | Items | Total effort |
|------|-------|---|
| Tier 1 — Adopt now | 7 items | ~3.5 hr (most of which is T1.6 the GH Action) |
| Tier 2 — Adopt soon | 5 items | ~7 hr (most of which is T2.1 the onboarding doc) |
| Tier 3 — Watch | n/a | n/a |

If we cap effort at "before the new devs land," the realistic bundle is:
**T1.7 (must), T1.1, T1.2, T1.3, T1.4, T1.5, T2.1, T2.3** — about 8 hours total,
spaced across 3-4 sessions.

T1.6 (GH Action) and T2.2/T2.4/T2.5 can land week 1 of the new devs being on the team —
they don't block onboarding, they enrich it.
