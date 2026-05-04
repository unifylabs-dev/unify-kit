# Current Stack Inventory

A factual enumeration of the Claude Code surfaces we run today, as the input for the
gap analysis. No opinions in this file — only what exists and where.

Sources inspected: `~/.claude/`, `~/.claude/plugins/`, `optics-management/.claude/`,
`optics-management/optics_boutique/CLAUDE.md`, `optics-management/optics_boutique/.mcp.json`,
worktree directories, project docs.

---

## 1. Global config (`~/.claude/`)

### 1.1 `~/.claude/CLAUDE.md`
Single rule: **post-plan phasing check** — a two-gate decision (quantitative + self-
assessment) for whether to invoke `/phase` after generating a plan in plan mode. Skip
list explicitly carves out single-file changes, refactors with no new logic, typos,
config edits, and any "just do it" instruction.

### 1.2 `~/.claude/settings.json` — relevant settings

| Setting | Value |
|---------|-------|
| `permissions.defaultMode` | `auto` |
| `effortLevel` | `xhigh` |
| `voice.enabled` / `voice.mode` | `true` / `hold` |
| `skipDangerousModePermissionPrompt` | `true` |
| `skipAutoPermissionPrompt` | `true` |
| `statusLine.command` | `~/.claude/statusline.sh` |

### 1.3 Enabled plugins (per `settings.json`)

- `frontend-design@claude-plugins-official` ✅
- `feature-dev@claude-plugins-official` ✅
- `compound-engineering@every-marketplace` ✅
- `commit-commands@claude-plugins-official` ✅
- `playwright@claude-plugins-official` ✅
- `supabase@claude-plugins-official` ✅
- `superpowers@claude-plugins-official` ✅ (v5.0.7)
- `claude-md-management@claude-plugins-official` ✅
- `pr-review-toolkit@claude-plugins-official` ✅
- `skill-creator@claude-plugins-official` ✅
- `claude-code-setup@claude-plugins-official` ✅
- `ui-ux-pro-max@ui-ux-pro-max-skill` ✅ (v2.5.0)

Disabled but installed: `github`, `vercel`, `code-review`, `security-guidance`, `figma`,
`explanatory-output-style`, `linear`, `legalzoom`, plus duplicates from
`claude-code-plugins` marketplace (older copies of `commit-commands`, `feature-dev`,
`frontend-design`).

### 1.4 `~/.claude/skills/` (custom user-level skills)

| Skill | Source | Function |
|-------|--------|----------|
| `analyze-comms` | local | Analyze incoming comms (emails, PDFs, vendor messages) against project context |
| `humanizer` | local | Remove signs of AI-generated writing |
| `phasing` | symlink → `~/Projects/phasing` | Multi-phase work orchestration |
| `review-prototype` | local | Review prototype branch, extract ACs, create GH issue |
| `ship` | local | Commit + push + open PR in one command |
| `work-issue` | local | 8-phase issue-driven dev (analyze → branch → plan → TDD → verify → accept → review → PR) |

### 1.5 `~/.claude/commands/` (custom commands)

All four are symlinks to `~/Projects/phasing/commands/`:
- `phase.md`, `phase-execute.md`, `phase-resume.md`, `phase-archive.md`

### 1.6 `~/.claude/hooks/`

Just one file: `gsd-statusline.js` (statusline integration).
**No security hooks installed.**

### 1.7 `~/.claude/plugins/marketplaces/`

Four registered marketplaces:
- `claude-plugins-official`
- `claude-code-plugins` (older mirror)
- `every-marketplace` (compound-engineering source)
- `ui-ux-pro-max-skill`

---

## 2. Plugin contents (user-invocable surfaces)

What each enabled plugin contributes — derived from in-session skill listing.

### 2.1 `compound-engineering` (v2.28.0)
- **Slash commands:** `/lfg`, `/triage`, `/changelog`, `/review`, `/plan`, `/brainstorm`,
  `/work`, `/compound`, `/release-docs`, `/deep-plan`, `/agent-native-audit`,
  `/feature-video`, `/heal-skill`, `/deploy-docs`, `/test-browser`, `/xcode-test`,
  `/reproduce-bug`, `/resolve_parallel`, `/resolve_pr_parallel`, `/resolve_todo_parallel`,
  `/generate_command`, `/create-agent-skill`, `/plan_review`, `/report-bug`
- **Skills:** `agent-browser`, `andrew-kane-gem-writer`, `agent-native-architecture`,
  `compound-docs`, `rclone`, `every-style-editor`, `skill-creator`, `frontend-design`,
  `git-worktree`, `dspy-ruby`, `gemini-imagegen`, `dhh-rails-style`, `brainstorming`,
  `file-todos`, `create-agent-skills`
- **Reviewer agents:** `dhh-rails-reviewer`, `kieran-rails-reviewer`,
  `kieran-typescript-reviewer`, `kieran-python-reviewer`, `julik-frontend-races-reviewer`,
  `code-simplicity-reviewer`, `architecture-strategist`, `data-integrity-guardian`,
  `data-migration-expert`, `deployment-verification-agent`, `pattern-recognition-specialist`,
  `performance-oracle`, `security-sentinel`, `agent-native-reviewer`, plus design,
  research, and workflow agents.

### 2.2 `superpowers` (v5.0.7)
- **Skills:** `using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`,
  `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`,
  `verification-before-completion`, `systematic-debugging`, `requesting-code-review`,
  `receiving-code-review`, `writing-skills`, `using-git-worktrees`,
  `finishing-a-development-branch`, `code-reviewer`
- **Commands:** `/code-reviewer`, `/code-simplifier`, `/comment-analyzer`,
  `/pr-test-analyzer`, `/silent-failure-hunter`, `/type-design-analyzer`

### 2.3 `frontend-design`
- Skill: `frontend-design` — distinctive, production-grade UI generation that avoids
  generic AI aesthetics

### 2.4 `pr-review-toolkit`
- `/review-pr` command + reviewer agents (`code-reviewer`, `code-simplifier`,
  `comment-analyzer`, `pr-test-analyzer`, `silent-failure-hunter`, `type-design-analyzer`)

### 2.5 `commit-commands`
- `/commit`, `/commit-push-pr`, `/clean_gone`

### 2.6 `claude-md-management`
- `/revise-claude-md`, `claude-md-improver` skill

### 2.7 `skill-creator`
- `skill-creator` skill — guided creation/editing of skills, eval support

### 2.8 `claude-code-setup`
- `claude-automation-recommender` skill — analyzes a codebase and suggests Claude Code
  automations (hooks, subagents, skills, plugins, MCP servers)

### 2.9 `ui-ux-pro-max` (v2.5.0)
- `ui-ux-pro-max` skill — 50+ styles, 161 color palettes, 57 font pairings, 99 UX
  guidelines, 25 chart types, 10 frontend stacks

### 2.10 `feature-dev`
- Subagents: `code-architect`, `code-explorer`, `code-reviewer`
- Skill: `feature-dev` (guided feature dev with codebase understanding)

### 2.11 `playwright`
- Browser automation MCP tools (navigate, click, fill, snapshot, screenshot, network,
  evaluate, wait_for, etc.)

### 2.12 `supabase`
- `supabase` skill, `supabase-postgres-best-practices` skill, `supabase` MCP server

### 2.13 Other plugins
- `claude-md-management`, `pr-review-toolkit`, `commit-commands`: covered above.
- `feature-dev`, `frontend-design`: covered above.

---

## 3. Project-level config

### 3.1 `optics-management/.claude/`
- `settings.json` — empty allow-list
- `settings.local.json` — broad permissions including `Bash` (unrestricted),
  Playwright MCP tools, `gh pr create`, `npm run`, `npx tsc`, plus several inline
  `node -e` commands with embedded DB credentials *(security concern — see gap analysis)*
- `enableAllProjectMcpServers: true`
- `enabledMcpjsonServers: ["supabase"]`
- `phases/` — past phasing-skill outputs

### 3.2 `optics-management/.mcp.json`
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=jbxsxyjxvlhtoezdscau"
    }
  }
}
```

### 3.3 `optics-management/.superpowers/`
- `brainstorm/` — superpowers brainstorming run state

### 3.4 Worktree organization
Two worktree roots in active use:
- `optics-management/worktrees/` (e.g. `feature-79-inventory-migration`, `seed-data`)
- `optics-management/optics_boutique/.worktrees/` (10 active feature branches:
  `feature-75`, `-80`, `-85`, `-86`, `-89`, `-90`, `-91`, `-158`, `-170`, `-179`)

Naming convention: `<type>/<issue-number>-<kebab-description>` per `optics_boutique/CLAUDE.md`.

---

## 4. Project memory: `optics-management/optics_boutique/CLAUDE.md`

20K-character living document. Sections (verbatim from the file):

- **Project Overview** — Mint Vision Optique staff portal; stack: Next.js 15 + Postgres
  (Supabase) + Prisma 7 + Tailwind + shadcn/ui; Node 22.12+
- **Architecture** — route groups (auth/portal/client/lens-match/forms), data layer
  (Server Components + Server Actions + DAL, no API routes for CRUD), staff auth
  (bcrypt + HMAC, 7-day session, `mvo_session` cookie), client auth (separate
  `mvo_client_session`, magic link + password, 60-min idle, PHIPA compliance)
- **Business Rules** — dual invoice, order status flow (DRAFT → … → PICKED_UP),
  prescription rules, legacy IDs, phone storage
- **Conventions** — component style, naming, Tailwind-only styling, DB transaction
  patterns, branch naming, **issue-driven development via `/work-issue`** (7-phase),
  **strict TDD enforcement** (Red-Green-Refactor with stop-after-3-failures rule)
- **Test Strategy** — four-tier pyramid (CI fast / E2E daily / local pre-PR / nightly)
- **Server Action Anatomy** — codified 6-step pattern (auth guard → validate → mutate →
  audit + revalidate → redirect rethrow → generic error fallback)
- **Audit Logging** — PHIPA/PIPEDA compliance, fire-and-forget `logAudit()` with full
  action vocabulary
- **Rate Limiting** — public endpoints with `checkRateLimit` + `timingSafeDelay` +
  identical response shape (anti-enumeration)
- **Middleware** — dual session, idle timeout per scope, PUBLIC_PATHS list
- **Version Status** — feature matrix tracking V1.0 launch
- **Documentation Requirements** — after every `/ship`, hard requirement to update
  CHANGELOG, project_status, setup_guide, architecture, PRD, reference_docs, README
- **Unit Tests — Required for Every Feature** — non-deferrable; specific Vitest patterns
- **User Guide — Required for Every Feature** — must update both
  `user-guide-site/index.html` and copy to `public/user-guide.html`
- **PR Merge Process** — 6-step checklist (test:run + build + verification + merge +
  master pull + post-merge docs); explicitly non-negotiable
- **Living Document** rules — when to update CLAUDE.md and what triggers an update

This file is the de facto team playbook today.

---

## 5. Project docs (`optics-management/optics_boutique/docs/`)

Existing maintained docs:
- `CHANGELOG.md`
- `PRD.md`
- `architecture.md`
- `capabilities.md`
- `project_status.md`
- `project-views-setup.md`
- `reference_docs.md`
- `setup_guide.md`
- `MintVision PMS Feature_Update Log (1).pdf` (legacy)
- `PMS Build.pdf` (legacy)

Plus a deployed user guide site at `user-guide-site/index.html` (single HTML file,
mirrored to `public/user-guide.html` and standalone-deployed to Vercel).

---

## 6. MCP servers wired in this session

Per the session env:
- `claude_ai_Gmail` (Gmail integration)
- `claude_ai_Google_Calendar`
- `claude_ai_Google_Drive`
- `ide` (VS Code/JetBrains diagnostics)
- `plugin_compound-engineering_context7` (live docs lookup)
- `plugin_playwright_playwright` (browser automation)
- `plugin_supabase_supabase` (Supabase admin)

---

## 7. Existing GitHub artifacts (for `optics_boutique`)

From the file listing only — content not read in this pass:
- `.github/` exists at the repo root (issue templates assumed per CLAUDE.md reference
  to "GitHub issue templates which enforce [the AC requirement]")
- No GitHub Actions workflows currently observed (would need a follow-up read of
  `.github/workflows/` to confirm)

---

## 8. Workflows in active use today

Inferred from CLAUDE.md, the worktree list, and the available skills/commands:

| Workflow | Trigger | Tooling |
|----------|---------|---------|
| Issue-driven feature dev | New GH issue with ACs | `/work-issue <N>` skill (8-phase gated) |
| Worktree-per-feature | Branch creation | `gh issue develop`, `git-worktree` skill |
| Strict TDD per AC | Each AC | superpowers `test-driven-development` skill |
| Phasing | Heavy/cross-cutting work | `/phase` slash command + phasing skill |
| Brainstorm-then-plan | Ambiguous/new features | superpowers `brainstorming` → `writing-plans` |
| Multi-agent code review | Pre-merge | compound-engineering `/review`, `/lfg`, pr-review-toolkit |
| Ship-and-deploy | After tests + build pass | `/ship` skill (commit, push, PR) |
| Doc maintenance | After every ship | Hard rule in CLAUDE.md (CHANGELOG, status, etc.) |
| User-guide maintenance | After every feature | Hard rule in CLAUDE.md (HTML site + mirror) |
| 4-tier testing | Per push / nightly | `npm run test:ci` / `test:e2e:daily` / `test:run` / nightly |

---

## 9. What the team currently does **not** have (relevant to the framework)

- **Security hooks** — none beyond the statusline; no `dangerous-actions-blocker`,
  `pre-commit-secrets`, `output-secrets-scanner`, `file-guard`, `claudemd-scanner`,
  `mcp-config-integrity`.
- **GitHub Actions for AI-driven PR review or issue triage** — not observed in repo.
- **MCP vetting policy doc** — none.
- **Configuration audit script** — none (would catch drift across teammates).
- **`llms.txt` file** — not present in `optics_boutique/`.
- **AI usage charter / team CLAUDE.md template** — `optics_boutique/CLAUDE.md` is
  excellent project memory but is not framed for *new-dev onboarding*; there is no
  "how this team uses Claude Code" doc.
- **Onboarding skill or runbook** — no curated path for a new dev to follow on day 1.
