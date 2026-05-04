# Framework Deep Dive — `claude-code-ultimate-guide`

> Source: [github.com/FlorianBruniaux/claude-code-ultimate-guide](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)
> Author: Florian Bruniaux • Latest version observed: v3.40.0 (May 3, 2026)
> Licensing: **CC BY-SA 4.0** for content (attribution + share-alike) • **CC0** for templates (public domain — lift freely)
> Landing site: [cc.bruniaux.com](https://cc.bruniaux.com)

This document is a faithful, opinionated catalog of what the framework actually contains.
It is the input for the gap analysis. Where I use the word "noise" I mean *for our context*
(an existing, mature Next.js + superpowers + compound-engineering setup), not absolute.

---

## 1. What it actually is

It is **not a workflow you adopt** — it is an educational reference plus a template
buffet. Three layers stack:

1. **Educational layer** (the bulk) — ~25,000 lines of documentation across 16 specialized
   guides, a 7-module learning path, a 271-question quiz, and 41 Mermaid diagrams.
2. **Template layer** (the practical part) — 186+ production templates split across
   agents, commands, hooks, skills, scripts, and GitHub Actions. CC0 licensed.
3. **Operational layer** — a self-hosted MCP server (17 tools) that lets you query the
   guide from inside any Claude Code session, plus machine-readable indices
   (`reference.yaml`, `threat-db.yaml`, `llms.txt`) for programmatic consumption.

The author's stated goal: get readers from "copy-pasting configs" to "designing their own
agentic workflows with confidence."

---

## 2. Philosophy — the Five Golden Rules

These are the non-negotiables the guide imposes:

| # | Rule | Operational meaning |
|---|------|---------------------|
| 1 | **Verify Trust** | Test every AI output. Claude is reported to generate ~1.75× more logic errors than humans, so verification is the floor. |
| 2 | **Vet MCPs** | Never approve an unknown MCP. Run a 5-step audit (provenance → code review → permissions → testing → monitoring). |
| 3 | **Manage Context** | Hard thresholds: 0–50% free, 50–70% pay attention, 70–90% `/compact`, ≥90% `/clear`. |
| 4 | **Phase Adoption** | Start with `CLAUDE.md` + a few commands. Add agents/MCPs only when proven necessary. |
| 5 | **Use Methodologies** | TDD/SDD/BDD aren't optional — AI amplifies whatever discipline you have, including the bad. |

Cultural stance: zero marketing hype, evidence-based. "Claude Code isn't magic.
Transparency on limitations is critical."

---

## 3. Methodology canon

The guide elevates four methodologies and is opinionated about when each applies:

- **TDD** (Test-Driven Development) — Red → Green → Refactor. Recommended for *all*
  critical logic; the guide's claim is that AI specifically amplifies the cost of
  skipping tests.
- **SDD** (Spec/Design-Driven) — write the contract first; the implementation pass is
  scoped by the spec. Recommended for architectural changes and cross-cutting features.
- **BDD** (Behavior-Driven) — user stories as the unit of intent. Recommended when
  stakeholder alignment matters (product/legal/clinical sign-off).
- **GSD** ("Get Shit Done") — pragmatic delivery for small fixes; the guide's escape
  hatch from heavier methodology when the work doesn't justify it.

The framework's *AI-specific* angle: with AI in the loop, methodology matters **more**,
not less. Specs and tests are how you keep the agent honest.

---

## 4. Catalog — `examples/` (the lift-able templates)

All filenames below are real and present in the repo as of the version cited.

### 4.1 Hooks (`examples/hooks/`) — 30+ files

**Standout — security:**
- `dangerous-actions-blocker.sh` — blocks `rm -rf /`, DB drops, unauthorized file edits
- `pre-commit-secrets.sh` — git pre-commit preventing secrets from entering history
- `output-secrets-scanner.sh` — scans Claude tool outputs for keys/tokens before display
- `file-guard.sh` — protects `.env`, credentials, SSH keys from any modification
- `claudemd-scanner.sh` — detects prompt-injection inside `CLAUDE.md` at session start
- `mcp-config-integrity.sh` — validates MCP config hash (CVE-2025-54135/54136)
- `prompt-injection-detector.sh` — role-override, jailbreak, delimiter-injection scanner
- `unicode-injection-scanner.sh` — zero-width chars, RTL overrides, ANSI escapes
- `repo-integrity-scanner.sh` — scans README/package.json for hidden injection payloads

**Standout — workflow & quality:**
- `auto-format.sh` (+ `.ps1`) — Prettier/Black/etc. after every edit
- `typecheck-on-save.sh` — runs `tsc --noEmit` on save
- `test-on-change.sh` — triggers test suite on file change
- `pre-commit-evaluator.sh` — LLM-as-judge gate before commits finalize
- `output-validator.sh` — heuristic check for placeholders/incomplete code in outputs

**Other:**
- `auto-checkpoint.sh`, `auto-rename-session.sh` — session housekeeping
- `session-logger.sh`, `session-summary.sh`, `session-summary-config.sh` — JSONL logs and
  15-section end-of-session analytics
- `notification.sh`, `tts-selective.sh` — macOS sound + TTS
- `learning-capture.sh` — prompts user for daily learnings at session end
- `subagent-stop.sh` — cleans up sub-agent resources
- `permission-request.sh` — explicit-approval flow for high-risk operations
- `setup-init.sh`, `sandbox-validation.sh`, `privacy-warning.sh`
- `rtk-baseline.sh`, `rtk-auto-wrapper.sh` — token-reduction-kit instrumentation

### 4.2 Commands (`examples/commands/`) — 41 files

**Most overlap with what we already have** via compound-engineering and superpowers, but
some standouts:

- `validate-changes.md` — pre-commit quality gate using LLM evaluation
- `update-threat-db.md` — refreshes the `threat-db.yaml` malicious-skill catalog
- `methodology-advisor.md` — interactive picker for which methodology fits the task
- `routines-discover.md` — finds repeatable workflows from session history
- `audit-codebase.md`, `audit-agents-skills.md` — health audits
- `recipe-template.md` — scaffolding for new commands

**Already covered in our stack** (skip — duplicates): `commit.md`, `pr.md`, `review-pr.md`,
`generate-tests.md`, `git-worktree*.md` (4 files), `plan-*.md` (5 files), `scaffold.md`,
`security*.md` (3 files), `ship.md`, `refactor.md`, `qa.md`, `explain.md`, `release-notes.md`.

### 4.3 Agents (`examples/agents/`) — 15 files + 2 subdirs

Almost all overlap with compound-engineering's reviewer agents. Notable items:

- `adr-writer.md` — generates Architecture Decision Records (ADRs)
- `plan-challenger.md` — stress-tests a proposed plan before execution
- `loop-monitor.md` — tracks iterative agent processes
- `output-evaluator.md` — assesses quality of generated outputs
- Subdirs: `analytics-with-eval/`, `cyber-defense/`

The rest (`code-reviewer`, `architecture-reviewer`, `security-auditor`, `test-writer`,
`refactoring-specialist`, `devops-sre`, `implementer`, `planner`, `planning-coordinator`,
`integration-reviewer`, `security-patcher`) duplicate what you already have via plugins.

### 4.4 Skills (`examples/skills/`) — 18 folders + 5 standalone files

**Standout — usable as-is or as inspiration:**
- `audit-agents-skills/` — quality audit for a team's `.claude/` configuration
- `pr-triage/` — 4-phase PR backlog management
- `issue-triage/` — automated issue categorization & prioritization
- `git-ai-archaeology/` — AI-driven git history analysis
- `skill-creator/` — scaffold for new skills (overlaps with what we have)
- `mcp-integration-reference/` — pattern library for MCP integrations
- `release-notes-generator/` — automated release docs

**Standalone files:**
- `tdd-workflow.md`, `security-checklist.md` — reference docs
- `ast-grep-patterns.md` — AST pattern matching for refactors
- `smart-explore.md` — codebase exploration methodology
- `pdf-generator.md` — PDF generation reference

**Mostly noise for us:** `ccboard/`, `cyber-defense-team/`, `landing-page-generator/`,
`talk-pipeline/`, `voice-refine/`, `rtk-optimizer/`, `eval-rules/`, `eval-skills/`,
`design-patterns/`, `guide-recap/`, `token-audit/`.

### 4.5 Scripts (`examples/scripts/`) — 24 files

**Standout:**
- `audit-scan.sh` — security/quality scanner for a Claude Code config (JSON or human
  output) — directly useful for cross-team audits
- `check-claude.sh` (+ `.ps1`) — health check verifying Claude Code installation
- `session-stats.sh`, `session-search.sh` — session analytics & resume
- `cc-sessions.py` — advanced session search with incremental indexing
- `sync-claude-config.sh` — sync `~/.claude` configs across machines
- `ai-usage-charter-template.md` — template for an organizational AI usage policy
- `mcp-registry-template.yaml` — template for a curated MCP registry
- `bridge.py` + `bridge-plan-schema.json` — local plan execution via LM Studio (cost
  optimization — niche)
- `test-prompt-caching.ts` — verifies Anthropic prompt-caching activation
- `fresh-context-loop.sh` — auto-restart at token limits

**Less relevant for us:** `clean-reinstall-claude.*`, `migrate-arguments-syntax.*`,
`og-image-astro.ts`, `pptx-to-pdf.sh`, `rtk-benchmark.sh`, `smart-suggest-roi.py`,
`sonnetplan.sh`, `statusline.py` (we have our own).

### 4.6 GitHub Actions (`examples/github-actions/`) — 4 workflows + 2 supporting files

| File | Trigger | Output |
|------|---------|--------|
| `claude-code-review.yml` | PR open/sync/ready + `/claude-review` comment | Tiered findings (🔴 MUST FIX / 🟡 SHOULD FIX / 🟢 CAN SKIP) + inline comments. Read-only tools. |
| `claude-pr-auto-review.yml` | Auto on every non-draft PR | 8-axis review (correctness, security, perf, readability, maintainability, testing, best practices, breaking changes) + risk summary |
| `claude-security-review.yml` | Every PR | OWASP-Top-10 vulnerability scan, configurable exclusions |
| `claude-issue-triage.yml` | New issues opened | Auto-classification, severity rating, duplicate detection, optional auto-labeling |

Supporting:
- `prompts/code-review.md` — externalized review criteria (edit without touching YAML)
- `.coderabbit.yaml` — CodeRabbit integration config

---

## 5. Educational layer

### 5.1 16 specialized guides (`guide/`)

Topical references covering: Claude Code architecture internals, methodology deep-dives,
multi-agent topology, security hardening, MCP ecosystem, cost optimization, DevOps
integration, agent design patterns. ~25K lines total. Source material — not workflows.

### 5.2 Learning path (`learning-path/`) — 7 modules

Structured beginner → advanced progression. Tied to the 271-question quiz. Module shape
and pacing are the genuinely useful artifacts (the *content* would be re-written for
our stack, since theirs assumes a vanilla setup).

### 5.3 Quiz (`quiz/`) — 271 questions, 9 categories

Self-assessment with instant feedback linking to guide sections. 4 skill profiles
(beginner / intermediate / advanced / expert).

### 5.4 Cheatsheet

Single-page reference (printable). Currently 404s for raw fetch but is rendered on the
landing site.

---

## 6. Security artifacts

This is genuinely the framework's strongest differentiator vs. anything else in the
ecosystem:

- **`threat-db.yaml`** — structured catalog of MCP/skill attack patterns. Designed for
  programmatic scanning.
- **24 CVE-mapped vulnerabilities** — each tied to a mitigation in the guide.
- **655 known-malicious skills catalog** — vetting reference for any skill before
  installing.
- **MCP 5-step vetting workflow** — provenance → code review → permissions → testing →
  monitoring. Operationalized as the `update-threat-db.md` command.
- **Production hardening templates** — injection defense, sandbox isolation patterns.

---

## 7. Machine-readable assets

- **`reference.yaml`** — full guide indexed for programmatic lookup. Powers landing-site
  CMD+K search.
- **`threat-db.yaml`** — see above.
- **`llms.txt`** — standard LLM-context file (~1K tokens) at the repo root. Adopting
  this pattern in our own repos makes them legible to any LLM tool, not just Claude Code.

---

## 8. MCP server (`mcp-server/`) — 17 tools

A self-hosted MCP server lets you query the guide from inside any Claude Code session
without cloning. Notable tools include guide search, recipe lookup, threat-db query,
quiz fetcher.

For us, this is duplicative — `compound-engineering:context7` already covers
"fetch current documentation" — but it's worth flagging for completeness.

---

## 9. Built-in command vocabulary the guide assumes

The guide's day-to-day rhythm leans on these built-in commands:
`/compact`, `/clear`, `/status`, `/plan`, `/model`, `/usage`, `/mcp`, `/effort`,
`/ultrareview`. Note that `/ultrareview` and `/effort` are recent additions on Anthropic's
side, not framework-specific.

---

## 10. What the guide *doesn't* have

Honest gaps in the framework relative to what mature workflows actually need:

- **No phasing system.** Closest analog is `plan-execute.md` + `plan-validate.md`, but
  there's no master-plan / per-phase-spec / handoff discipline.
- **No equivalent to superpowers' brainstorming → writing-plans → executing-plans
  pipeline** with hard gates.
- **No worktree-per-feature convention.** Has `git-worktree*.md` commands but no
  prescribed workflow.
- **No issue-driven development pattern** equivalent to `/work-issue`'s 7-phase gated
  flow.
- **No `verification-before-completion` discipline** — the guide *recommends* verifying
  outputs but doesn't enforce a "evidence before assertion" gate.
- **No team-CLAUDE.md template specifically tuned for onboarding** — the CLAUDE.md
  template provided is project-config oriented, not team-conventions oriented.

These gaps are exactly where our existing stack is strongest, and they're the reason
the recommendation is **augment, not replace**.
