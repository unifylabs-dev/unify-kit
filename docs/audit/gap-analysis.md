# Gap Analysis — Framework vs. Current Stack

Two tables. Table A is "framework offerings → what we already have" (where they
contribute). Table B is "what we have → framework equivalent" (where we're ahead).

Gap level scale:
- **Full** — nothing equivalent today; framework adds net-new capability
- **Partial** — partial coverage today; framework would meaningfully improve it
- **None** — already covered as well or better; framework is duplicative

---

## Table A — Framework offerings vs. current coverage

### Security / safety hooks

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `examples/hooks/dangerous-actions-blocker.sh` | `~/.claude/hooks/` has only `gsd-statusline.js`; we rely on `defaultMode: auto` + manual review | **Full** | Adding new devs widens blast radius; this is a 30-min install. |
| `examples/hooks/pre-commit-secrets.sh` | No git pre-commit secrets gate observed | **Full** | `optics-management/.claude/settings.local.json` already contains inline `node -e` commands with embedded DB credentials — proof we need this. |
| `examples/hooks/output-secrets-scanner.sh` | None | **Full** | Catches keys/tokens in tool outputs *before* display; safety net for screen-shares and recordings. |
| `examples/hooks/file-guard.sh` | None | **Full** | Blocks any modification of `.env`, credentials, SSH keys. Directly relevant — `optics_boutique/.env` exists. |
| `examples/hooks/claudemd-scanner.sh` | None | **Full** | We have many CLAUDE.md files (root + 12 worktrees). One injected file would compromise sessions. Low effort to install. |
| `examples/hooks/mcp-config-integrity.sh` | None | **Full** | We use `.mcp.json` in `optics-management/`. CVE-mapped (CVE-2025-54135/54136). Hash-based tamper detection. |
| `examples/hooks/prompt-injection-detector.sh` | None | **Partial** | Catches role-override / jailbreak / delimiter-injection in inputs. Less critical for an internal team; still a freebie. |
| `examples/hooks/repo-integrity-scanner.sh` | None | **Partial** | Scans README/package.json for hidden injection. Useful when adding dependencies. |
| `examples/hooks/unicode-injection-scanner.sh` | None | **Partial** | Zero-width chars / RTL overrides in fetched content. Edge case but cheap. |
| `examples/hooks/permission-request.sh` | We have `defaultMode: auto` + `skipDangerousModePermissionPrompt: true` | **None / actively worse** | The framework's hook is *opposite* of our preference. Skip. |

### Quality / workflow hooks

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `examples/hooks/auto-format.sh` | None at hook level (likely Prettier in repo via husky/CI) | **Partial** | Optional. Most teams have this in pre-commit already. Verify before installing. |
| `examples/hooks/typecheck-on-save.sh` | Editor/IDE handles this; CI runs `npx tsc --noEmit` | **None** | IDE + CI already cover. Skip. |
| `examples/hooks/test-on-change.sh` | Vitest watch mode + `npm run test:ci` on push | **None** | Skip. |
| `examples/hooks/output-validator.sh` | superpowers `verification-before-completion` skill | **None** | Our skill is stricter — *evidence before assertions*. Skip. |
| `examples/hooks/pre-commit-evaluator.sh` | superpowers `code-reviewer` skill + `/work-issue` Phase 5 + manual `/review` | **None** | Already have stronger gates. Skip. |
| `examples/hooks/session-summary.sh` + JSONL logger | None | **Partial** | 15-section end-of-session analytics. Nice-to-have for cost tracking but not priority. |
| `examples/hooks/auto-checkpoint.sh` | superpowers + phasing already produce intermediate state | **None** | Skip. |

### GitHub Actions (CI integration)

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `examples/github-actions/claude-code-review.yml` | None observed in repo workflows | **Full** | `/claude-review`-comment-triggered async review with tiered findings (🔴/🟡/🟢). High value for new devs — they get review feedback before tagging a human. |
| `examples/github-actions/claude-pr-auto-review.yml` | None | **Full** | Automatic 8-axis review on every non-draft PR. Risk: noisy on small PRs; toggle-able. Pair with the manual one. |
| `examples/github-actions/claude-security-review.yml` | None | **Full** | OWASP-Top-10 scan on every PR. PHIPA app — security review per PR is justifiable. |
| `examples/github-actions/claude-issue-triage.yml` | None | **Partial** | We use issue templates and `/work-issue`; auto-triage adds severity rating + duplicate detection. Low priority. |
| `examples/github-actions/prompts/code-review.md` (externalized prompt) | None | **Partial** | Edit review criteria without touching workflow YAML — useful pattern. |

### Skills / methodology / docs

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `examples/skills/audit-agents-skills/` | None | **Full** | Audits a team's `.claude/` for consistency. Non-trivial value when 3+ devs run different setups. |
| `examples/skills/pr-triage/` (4-phase backlog management) | compound-engineering `/triage` (CLI todos), pr-review-toolkit | **Partial** | Different scope (PR backlog vs. internal todo triage). Low priority unless PR backlog grows. |
| `examples/skills/issue-triage/` | None for issues, but `/work-issue` consumes ACs | **Partial** | Could pair with `claude-issue-triage.yml` GH Action. Low priority. |
| `examples/skills/git-ai-archaeology/` | compound-engineering has `git-history-analyzer` agent | **None** | Already covered. Skip. |
| `examples/skills/skill-creator/` | We have `compound-engineering:skill-creator` and `skill-creator` plugin | **None** | Skip. |
| `examples/skills/release-notes-generator/` | compound-engineering `/changelog` | **None** | Skip. |
| `examples/skills/mcp-integration-reference/` | None | **Partial** | Reference patterns for MCP integrations. Useful if we build custom MCPs; skip otherwise. |
| `examples/skills/tdd-workflow.md` | superpowers `test-driven-development` skill (enforced) | **None** | Ours is stricter. Skip. |
| `examples/skills/security-checklist.md` | None at this level of formality | **Partial** | A reference doc; could be cited from a team CLAUDE.md. Lift verbatim. |
| `examples/skills/ast-grep-patterns.md` | None | **Partial** | Useful reference for refactors. Lift verbatim if/when needed. |
| `examples/skills/smart-explore.md` | superpowers `using-superpowers` + `Explore` agent | **None** | Skip. |

### Commands

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `examples/commands/validate-changes.md` | superpowers `verification-before-completion` + `/work-issue` Phase 5 | **None** | Ours is stronger. Skip. |
| `examples/commands/audit-codebase.md` | None directly equivalent | **Partial** | One-shot audit-on-demand. Could be useful for new-dev orientation pass. |
| `examples/commands/audit-agents-skills.md` | None | **Partial** | Pairs with the `audit-agents-skills` skill. Useful for cross-team consistency check. |
| `examples/commands/methodology-advisor.md` | superpowers' brainstorming/plan/TDD skills are picked situationally | **None** | We've already decided which methodology applies where. Skip. |
| `examples/commands/update-threat-db.md` | None | **Partial** | Refreshes the malicious-skills catalog. Run if/when we adopt threat-db checks. |
| `examples/commands/routines-discover.md` | None | **Partial** | Finds repeatable workflows in session history. Interesting but not load-bearing. |
| `examples/commands/{commit,pr,review-pr,ship,scaffold,refactor,explain,qa,…}` | All covered by superpowers + compound-engineering + commit-commands + pr-review-toolkit | **None** | Skip — adding more would dilute the menu. |

### Scripts / tooling

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `examples/scripts/audit-scan.sh` | None | **Full** | Scans a Claude config for security/quality issues, JSON or human output. Ideal as a pre-onboarding check ("is your `.claude` in a good state?"). |
| `examples/scripts/check-claude.sh` | None | **Partial** | Health check — install present, version check, config integrity. Onboarding-friendly. |
| `examples/scripts/sync-claude-config.sh` | Manual | **Partial** | Useful if we want a canonical team config. Probably not — dotfiles repo would be cleaner. |
| `examples/scripts/ai-usage-charter-template.md` | None | **Full** | A team-policy *template* for how/when AI is used. Cheap to adopt. |
| `examples/scripts/mcp-registry-template.yaml` | We have `.mcp.json` but no curated registry policy | **Partial** | Could codify "approved MCPs only" policy as the team grows. |
| `examples/scripts/test-prompt-caching.ts` | None | **None / niche** | Verifies Anthropic prompt-caching activation. Skip unless we hit cost issues. |
| `examples/scripts/session-stats.sh`, `session-search.sh`, `cc-sessions.py` | None | **Partial** | Useful for cost analysis and session resume. Low priority. |
| `examples/scripts/{statusline.py, og-image-astro.ts, pptx-to-pdf.sh, sonnetplan.sh, fresh-context-loop.sh, bridge.py, …}` | We have our own statusline | **None / niche** | Skip. |

### Educational / reference

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| 7-module `learning-path/` | None — `optics_boutique/CLAUDE.md` is project memory, not an onboarding curriculum | **Full** | Adopt the *shape* (modules → assessments) for our own onboarding. Don't lift the content — write our own around our stack. |
| 271-question `quiz/` | None | **Partial** | Could be reused as-is for general Claude Code literacy. Optional. |
| 16 specialized guides (`guide/`) | We don't need a Claude Code reference — superpowers + compound-engineering plugins serve as living reference | **None** | Skip wholesale; cite specific sections only when needed. |
| 41 Mermaid diagrams | None internally | **Partial** | Diagrams are CC BY-SA — embed selectively in our own onboarding doc with attribution. |
| `cheatsheet.md` (1-page) | None | **Partial** | A one-page team-specific cheatsheet (commands we actually use) is high-value for new devs. Don't copy theirs — write our own. |

### Security artifacts

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `threat-db.yaml` (24 CVEs + 655 malicious skills) | None | **Full** | A real security asset. Could feed an automated check across our installed plugins/skills. |
| MCP 5-step vetting workflow | We `enableAllProjectMcpServers: true` and trust `claude-plugins-official` | **Partial** | Document a team policy — even if light — before more devs install MCPs. |
| Production hardening templates | None at this level of detail | **Partial** | We have PHIPA-driven hardening in code but no Claude-specific hardening doc. |

### Machine-readable assets

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `llms.txt` | None in `optics_boutique/` | **Full** | Standard, ~1K-token LLM-context file. 30-min adoption. Makes the repo legible to any LLM tool. |
| `reference.yaml` | None | **None** | Their guide indexed; we don't need a guide-index of our own. Skip. |

### MCP server (querying the guide)

| Framework artifact | What we have today | Gap | Notes |
|---|---|---|---|
| `mcp-server/` (17 tools to query the guide) | `compound-engineering:context7` already provides "fetch current docs" | **None** | Skip. |

---

## Table B — Current-stack capabilities the framework lacks

These are the parts of our existing setup that the framework has no real equivalent for.
This is what we **must keep**, regardless of how much we adopt from the framework.

| Current-stack artifact | Why it beats the framework's alternative | New devs learn first? |
|---|---|---|
| **Phasing system** (`~/Projects/phasing` skill + commands) — master plan + per-phase specs + handoffs + verification gates | Framework's `plan-execute.md` + `plan-validate.md` are flat slash commands without master/phase decomposition or fresh-context handoffs. | Yes — week 2, after the day-1 basics. |
| **superpowers `brainstorming` → `writing-plans` → `executing-plans` pipeline** with hard gates | Framework has no equivalent gated pipeline. `methodology-advisor.md` is a single chooser, not an enforced workflow. | Yes — day 1 (the brainstorming gate is mandatory). |
| **superpowers `test-driven-development` skill** (mandatory red-green-refactor with stop-after-3-failures rule) | Framework's `tdd-workflow.md` is a reference doc — it does not enforce. | Yes — day 1 (codified in `optics_boutique/CLAUDE.md`). |
| **superpowers `verification-before-completion`** (evidence before assertions) | Framework's `output-validator.sh` is a heuristic check, not a discipline. | Yes — week 1. |
| **superpowers `systematic-debugging`** | No framework equivalent. | Week 2. |
| **`/work-issue` skill** — 8-phase issue-driven dev (analyze → branch → plan → TDD → verify → accept → review → PR) | Framework has `pr.md` and individual review/issue commands, but no end-to-end issue→PR pipeline with mandatory ACs. | Yes — day 1 (this is our default workflow). |
| **`/lfg` (compound-engineering)** — full autonomous engineering workflow | Framework has no autonomous-engineering equivalent. | Week 2. |
| **`/phase` (master + per-phase orchestration)** | Closest framework analog is `plan-start.md` + `plan-execute.md`, no phasing discipline. | Week 2. |
| **compound-engineering reviewer agents** (`security-sentinel`, `architecture-strategist`, `performance-oracle`, language-specific reviewers like `kieran-typescript-reviewer`, `dhh-rails-reviewer`) | Framework has flatter, generic agents (`code-reviewer.md`, `security-auditor.md`). | Week 2 — show new devs which reviewer to invoke when. |
| **`/ship` skill** (commit + push + PR in one) | Framework's `ship.md` is a deploy checklist, not the same shape. | Day 1. |
| **frontend-design plugin/skill** (production-grade UI generation, anti-AI-aesthetic) | Framework's `landing-page-generator/` skill is much narrower. | Week 2. |
| **`ui-ux-pro-max` plugin** (50+ styles, 161 palettes, 99 UX guidelines) | No framework equivalent. | Week 3+, on demand. |
| **Worktree-per-feature convention** with both `.worktrees/` and `worktrees/` directories already populated | Framework has `git-worktree*.md` commands but no organizational pattern. | Day 1. |
| **`optics_boutique/CLAUDE.md`** — 20K-char living project-memory doc | Framework's CLAUDE.md template is generic project-config. | Day 1 mandatory read. |
| **PHIPA/PIPEDA-aware patterns** in code: `logAudit()`, `verifySession()`, `verifyRole()`, `checkRateLimit` + `timingSafeDelay`, dual-session middleware, `legacyCustomerId` handling | Framework has zero domain-specific compliance patterns. | Week 1. |
| **4-tier test strategy** (CI fast / E2E daily / local pre-PR / nightly) | Framework's testing references are generic. | Week 1. |
| **Documentation-on-ship hard requirement** (CHANGELOG + project_status + setup_guide + architecture + PRD + reference_docs + README updated every ship) | Framework has no equivalent enforcement. | Week 1. |

---

## Verdict (input to recommendations.md)

- **Replace? No.** Nothing in the framework is structurally better than what we run.
- **Augment? Yes — selectively.** The high-confidence wins are concentrated in two areas:
  1. **Security hooks + GH Actions** (Table A "Full" rows in those sections).
  2. **Onboarding scaffolding** (`audit-scan.sh`, `ai-usage-charter-template.md`,
     `llms.txt`, plus the *shape* of a learning path written for our stack).
- **Skip? Yes — most templates duplicate or undercut what we have.** Our agent/skill
  inventory already covers their methodology and review surfaces, often more rigorously.

Recommendations are scoped to those high-confidence wins in the next file.
