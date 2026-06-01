# Spec 02 — Templates

> Status: Implemented in v0.2.x
> Depends on: 00 (vision + glossary + sourcing modes), 01 (filename canon)
> Related: 03 (hooks reference templates), 06 (curriculum consumes onboarding + cheatsheet templates), 09 (kit's own CI scrubs template placeholders)

## Purpose

Specify each template that ships in `templates/`: what it is, what's in it, the
sourcing mode for each part, and how a consumer parameterizes it for their project.

## Common conventions

- **Placeholder syntax: `{{NAME}}` — single, mandatory.** No alternatives. Mustache-
  shape is greppable, doesn't collide with shell, HTML, or Python f-strings, and is
  immediately recognizable. The literal `<...>` is reserved for *prose* convention
  only (e.g., `/work-issue <N>` where `<N>` reads as "an integer issue number" in
  human English, not a placeholder).
- **Filename suffixes** follow spec 01's canon: `.md.template` for editable
  templates, plain `.md` for lift-as-is files.
- **Supported placeholder vocabulary** (the only ones any template uses):
  `{{PROJECT_NAME}}`, `{{ONE_LINE_DESCRIPTION}}`, `{{STACK}}`, `{{REPO_URL}}`,
  `{{TEAM_NAME}}`, `{{LANG}}`, `{{LANG_VERSION}}`, `{{FRAMEWORK}}`, `{{DB}}`,
  `{{KEY_LIBS}}`, `{{ROOT}}`, `{{BUILD_CMD}}`, `{{TEST_CI_CMD}}`, `{{TEST_FULL_CMD}}`,
  `{{LINT_CMD}}`, `{{TYPECHECK_CMD}}`, `{{DATA_MODEL_PATH}}`, `{{TEST_E2E_DIR}}`.
  The vocabulary is the contract; `templates/README.md` lists every placeholder
  + its meaning, and the kit's own CI fails when a template uses an undeclared
  placeholder (spec 09).

---

## Templates shipped

Each template names its **sourcing mode** per spec 00.

### 1. `templates/claude.md.template` — sourcing mode: `customization`

The team-ready project memory file. Distilled from `optics_boutique/CLAUDE.md` with
project-specific identifiers removed; structurally inspired by but not lifted from
the Ultimate Guide's CLAUDE.md example.

**Minimal stack-agnostic shape (8 sections, no optional appendices):**

1. Project Overview — `{{PROJECT_NAME}}`, one-line description, stack summary.
2. Architecture — placeholder skeleton; consumer fills in.
3. Conventions — placeholder skeleton with strong defaults (branch naming, commit
   convention, file naming, component patterns).
4. Issue-Driven Development — `/work-issue <N>` 8-phase flow (Phase 0 — Spec
   Sync — through Phase 7 — PR creation, per `docs/methodology.md` §D) if
   superpowers + compound-engineering plugins are present.
5. TDD Enforcement — Red-Green-Refactor with stop-after-3-failures rule.
6. Test Strategy — placeholder for the consumer's test pyramid.
7. Documentation Requirements — doc-on-ship rule (consumer fills in which files).
8. Living Document rules — when to update CLAUDE.md.

**Stack-specific patterns are NOT in the template.** They live in
`templates/snippets/` and consumers compose them à la carte:

- `snippets/server-action-anatomy-nextjs.md` — Next.js Server Action 6-step pattern
- `snippets/audit-logging-nextjs.md` — `logAudit()` fire-and-forget pattern
- `snippets/rate-limiting-nextjs.md` — `checkRateLimit` + `timingSafeDelay` pattern
- `snippets/middleware-nextjs.md` — dual-session + idle-timeout pattern

A consumer who wants the Next.js patterns appends the relevant snippet content into
their filled-in `CLAUDE.md`. The template itself stays minimal and stack-agnostic.

### 2. `templates/llms.txt.template` — sourcing mode: `pattern-only`

Standard `llms.txt` (≤1K tokens). The standard is a pattern; we author content.

**Sections:**

```
# {{PROJECT_NAME}}

> {{ONE_LINE_DESCRIPTION}}

## What this is
1-2 sentences.

## Stack
- {{LANG}} {{LANG_VERSION}}
- {{FRAMEWORK}}
- {{DB}}
- {{KEY_LIBS}}

## Key files
- CLAUDE.md ({{ROOT}}/CLAUDE.md): project memory + conventions
- README.md: setup
- docs/architecture.md: system design
- docs/PRD.md: product requirements

## Key conventions
- (Bullet list, ≤8 items)

## How to ask for help
- Use /work-issue <N> for issue-tracked work
- Use /brainstorm for ambiguous features
- Use /phase for cross-cutting changes
```

### 3. `templates/ai-usage-charter.md.template` — sourcing mode: `customization`

Based on `examples/scripts/ai-usage-charter-template.md` from the Ultimate Guide
(CC0). We use it as a starting point and add our specifics.

**Sections:**

1. **Scope** — what AI is permitted to write; what it isn't.
2. **Required sequences** — `/work-issue` for issue-tracked work; brainstorming
   before non-trivial new features; TDD per AC.
3. **MCP allowlist** — pointer to `mcp-policy.md.template`.
4. **Code review expectations** — AI-generated code goes through the same review as
   human-written code; reviewers note AI-assisted commits in PR descriptions.
5. **Prompt hygiene** — never paste secrets, customer data, or proprietary
   third-party content into prompts.
6. **Escalation** — when to stop and ask a human (e.g., GREEN phase fails 3 times in
   TDD).

**Charter strictness:** AI-generated code must pass the same review as human code.
Direct merges of un-reviewed AI output are not permitted. (Hard rule in v1; can be
relaxed via ADR if practice diverges.)

### 4. `templates/mcp-policy.md.template` — sourcing mode: `pattern-only`

The MCP vetting policy. Inherits the Ultimate Guide's 5-step workflow as a pattern
(provenance → code review → permissions → testing → monitoring); content is ours.

**Sections:**

1. **Allowlist** — table of approved MCPs with purpose and provenance.
2. **Vetting workflow** — 5-step pattern from Ultimate Guide.
3. **Adding an MCP** — process: open issue, run vetting, get sign-off, update
   allowlist, merge.
4. **Removing an MCP** — when, why, who decides.
5. **Project-level vs. user-level MCPs** — clarify scoping.

### 5. `templates/security-checklist.md` — sourcing mode: `customization`

Authored from the patterns documented in
`github.com/FlorianBruniaux/claude-code-ultimate-guide/examples/skills/security-checklist.md`
(upstream is CC BY-SA 4.0; we cite as pattern reference, do not lift expression —
see [`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md)).
The 3-bullet diff *intent* is preserved (kept all 10 OWASP categories; dropped
threat-db / 655-malicious-skills catalog references; added a labeled
`## Stack example: Next.js` block):

| Edit class | Specifics |
|---|---|
| **OWASP items kept verbatim** | All 10 items in the Top-10 spine |
| **Framework-specific items dropped** | Threat-db catalog references (we don't ship the threat-db scanner in v1); 655-malicious-skills catalog references (same) |
| **Stack-specific example items added** | One clearly-labeled "Next.js example" section: HMAC session cookies, audit logging via `logAudit()`, public-endpoint rate limiting + `timingSafeDelay`, Server Action auth-guard pattern |

The diff is small enough that an Ultimate Guide upstream change to the OWASP spine
can be merged manually. Sourcing mode label appears in a header comment at the top
of the file.

### 6. `templates/team-onboarding.md.template` — sourcing mode: `customization`

Pointer file new devs read on day one. Heavier curriculum content lives in
`onboarding/` (spec 06); this template stitches it together for one specific project.

**Sections:**

1. **Welcome to `{{PROJECT_NAME}}`** — 1 paragraph + day-1 checklist.
2. **Required reading** — `<consumer>/CLAUDE.md`, `docs/architecture.md`,
   `templates/cheatsheet.md.template`, `templates/ai-usage-charter.md.template`.
3. **Day 1 / Week 1 / Day 30** — links to `onboarding/day-1.md`, etc., with project-
   specific overrides.
4. **Bootstrap** — pointer to `scripts/bootstrap-claude-config.sh` and what it does.
5. **Who to ask** — placeholder for code-area owners.

### 7. `templates/cheatsheet.md.template` — sourcing mode: `customization`

The kit's *single source of truth* for the canonical command vocabulary, daily
skills list, and reviewer-agent mapping. Specs 06 and 07 cite this file by
reference; they do not redefine these lists.

**One-page layout (cuts deliberate to fit):**

- **Daily slash-commands** (8): `/work-issue`, `/brainstorm`, `/phase`, `/lfg`,
  `/ship`, `/review`, `/commit`, `/commit-push-pr`
- **Daily skills you invoke** (4 — the truly daily ones): `brainstorming`,
  `writing-plans` / `executing-plans`, `test-driven-development`,
  `verification-before-completion`
- **Build/test commands** (parameterized): `{{BUILD_CMD}}`, `{{TEST_CI_CMD}}`,
  `{{TEST_FULL_CMD}}`, `{{LINT_CMD}}`, `{{TYPECHECK_CMD}}`
- **Context thresholds** (window-fraction of the full context window): <60% free /
  ~60% warn / ~75% suggest `/handoff` / ~85%+ urgent `/handoff`
- **Plan mode + phasing trigger** — 1-line each

**Reviewer-agent mapping** — moved out of the cheatsheet body into an appendix at
the end (`## Appendix A — Which reviewer when`). The appendix is the kit's canonical
listing of compound-engineering reviewers (`kieran-typescript-reviewer`,
`security-sentinel`, `architecture-strategist`, `silent-failure-hunter`,
`data-migration-expert`). Specs 06 and 07 reference this appendix; they do not
restate the list.

---

## Decisions needed

All template-level decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | Placeholder syntax | `{{NAME}}` — mandatory single convention. |
| 2 | One CLAUDE.md flavor or several | One stack-agnostic core in `templates/claude.md.template` + opt-in stack snippets in `templates/snippets/`. (Closed by spec 00 #4.) |
| 3 | Sibling `examples/` with filled-in samples | **Deferred to v1.1.** Closed by spec 00 / spec 01 #3. |
| 4 | Charter strictness | Hard rule: AI-generated code must pass the same review as human code. Relax via ADR only. |
| 5 | Cheatsheet depth | One page strict; reviewer-agent mapping appended as Appendix A. |

## Out of scope

- Stack-specific business logic templates beyond the named `snippets/` set.
- Replacing the Ultimate Guide's `security-checklist.md` content wholesale — light
  edits only, bounded by the 3-bullet diff rule above.
- Filled-in example outputs (deferred to v1.1).

## Acceptance criteria

- Each named template exists in `templates/` with the proposed sections,
  parameterized using only the supported placeholder vocabulary.
- `templates/README.md` lists every supported placeholder, every template + its
  sourcing mode, and a short usage guide.
- **Mechanical placeholder check (replaces "1 hour" hand-wave AC):** running the
  kit's CI scrub script (`.github/workflows/scrub-check.yml`) on `templates/`
  produces:
  - Zero references to `optics-management|mvo_*|Mint Vision|Mvo\$Staff` (or any
    other forbidden string from spec 09's list).
  - Zero `{{...}}` placeholders that aren't in the supported vocabulary.
  - Every supported placeholder appears in at least one template.
- The cheatsheet template fits one US-letter page when rendered (verified by a
  manual print-preview — non-blocking, but flagged if it overflows).
- The single canonical command list and reviewer-agent appendix in
  `templates/cheatsheet.md.template` are referenced by anchor from specs 06 and 07.

## Revisions

Addressed: R-005 (placeholder pinned to `{{NAME}}`), R-006 (filename canon applied
— lowercase-hyphenated `.md.template` suffix), R-007 (canonical glossary terms used),
R-008 (CLAUDE.md.template minimized + snippets directory), R-009 (cheatsheet trimmed
to fit one page; reviewers moved to appendix), R-010 (cheatsheet established as
single source of truth for command vocab + reviewer mapping), R-011 (mechanical AC
replaces "1 hour" hand-wave), R-013 (every artifact tagged with sourcing mode),
R-040 (examples deferred to v1.1), R-045 (security-checklist diff bounded to a
3-bullet rule).

**v0.3 revision (2026-05-04):** `templates/security-checklist.md` reclassified
from `verbatim-with-light-edit` to `customization` for the same upstream-license
reason as the hook bundle, `audit-scan.sh`, and the consumer GH Actions workflow
(CC BY-SA 4.0 not CC0). The 3-bullet diff *intent* is preserved (OWASP categories
kept, threat-db references dropped, Next.js example block added) but every word
is now original kit-authored prose; the upstream is cited as `Pattern reference:`
in the file's HTML comment header. See
[`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md)
— ADR 0001 scope is extended to cover this reclassification (the third batch
under the same precedent).
