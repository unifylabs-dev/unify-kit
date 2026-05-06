<!--
templates/README.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# templates/

This directory ships every consumer-facing template the kit exposes: a project
memory file, a charter, an MCP policy, a security checklist, an llms.txt, an
onboarding stitcher, a one-page cheatsheet, and four Next.js stack snippets.
Copy what you need into your repo, search-and-replace the `{{...}}` tokens with
your project's values, and you have a working baseline.

## Templates

| Template | Sourcing mode | Purpose |
|---|---|---|
| `cheatsheet.md.template` | `customization` | One-page pocket reference. Single source of truth for daily commands, daily skills, and the reviewer mapping (Appendix A). |
| `claude.md.template` | `customization` | Minimal, stack-agnostic 8-section project memory file. Stack-specific patterns live in `snippets/`. |
| `llms.txt.template` | `pattern-only` | The `llms.txt` standard, ≤1K tokens. The repo's elevator pitch for any LLM tool. |
| `ai-usage-charter.md.template` | `customization` | 6-section AI usage charter with the hard rule that AI-generated code passes the same review as human code. |
| `mcp-policy.md.template` | `pattern-only` | 5-section MCP policy: allowlist + 5-step vetting + add/remove process + scoping. |
| `security-checklist.md` | `customization` | OWASP Top-10 spine + a labeled Next.js stack-example block. Lift-as-is (plain `.md`). |
| `team-onboarding.md.template` | `customization` | 5-section onboarding stitcher: welcomes new devs, points at the kit's onboarding curriculum, lists area owners. |
| `specs/module.md.template` | `customization` | Durable module-spec template (Purpose / Behavior / Data Model / Permissions / Edge Cases / Compliance / Integration / Open Questions / Changelog). Aim 200–500 lines. See `docs/methodology.md` §B. |
| `specs/journey.md.template` | `customization` | Durable journey-spec template (Purpose / Verifying e2e / Steps / Modules touched / Edge Cases / Open Questions / Changelog). Aim 100–300 lines. Tier 1 / Tier 2. |
| `specs/README.md.template` | `customization` | Index for `<consumer>/docs/specs/`. Two tables (Module specs + Journey specs) + adoption rubric for Tier-1 picks. |
| `snippets/server-action-anatomy-nextjs.md` | `customization` | Next.js Server Action 6-step anatomy: auth-guard → validate → audit-start → business → audit-success → return. |
| `snippets/audit-logging-nextjs.md` | `customization` | `logAudit()` fire-and-forget helper pattern for security-relevant events. |
| `snippets/rate-limiting-nextjs.md` | `customization` | `checkRateLimit` + `timingSafeDelay` for public endpoints; defends against brute force AND timing leaks. |
| `snippets/middleware-nextjs.md` | `customization` | Dual-session + idle-timeout middleware for Next.js 14+. Identifies actors; does not authorize. |
| `snippets/bdd-lite-test-naming.md` | `customization` | BDD-Lite test naming convention: `Journey: <slug>` describe block + Given/When/Then test names + `@daily` tagging. Stack-portable example uses Playwright. |

## Placeholder vocabulary

Templates use a single mandatory placeholder syntax: double-curly-braces
around an uppercase identifier (the convention is greppable, doesn't collide
with shell, HTML, or Python f-strings, and is immediately recognizable). Every
placeholder used in any template is one of the 18 in this table; nothing else.
The kit's own CI (spec 09's `scrub-check.yml`) fails when an undeclared
placeholder appears.

| Placeholder | Meaning |
|---|---|
| `{{PROJECT_NAME}}` | The project's display name. Appears in headings, prose, and titles. |
| `{{ONE_LINE_DESCRIPTION}}` | One-sentence elevator description (≤120 chars). |
| `{{STACK}}` | One-line stack summary (e.g., "Next.js 14 + Postgres + tRPC"). |
| `{{REPO_URL}}` | Canonical repository URL (for docs that cross-reference it). |
| `{{TEAM_NAME}}` | The team or org name (for onboarding welcomes, owner tables). |
| `{{LANG}}` | Primary programming language (e.g., `TypeScript`, `Go`, `Python`). |
| `{{LANG_VERSION}}` | Pinned language version (e.g., `5.4`, `1.22`, `3.12`). |
| `{{FRAMEWORK}}` | Primary framework (e.g., `Next.js 14`, `Django 5`, `Spring Boot 3`). |
| `{{DB}}` | Primary database (e.g., `Postgres 16`, `MySQL 8`, `SQLite`). |
| `{{KEY_LIBS}}` | Comma-separated list of load-bearing libraries (≤5 items). |
| `{{ROOT}}` | Project root path label as shown in docs (e.g., `apps/web`). |
| `{{BUILD_CMD}}` | Build command (e.g., `npm run build`, `go build ./...`). |
| `{{TEST_CI_CMD}}` | Tests that run in CI (the PR gate). |
| `{{TEST_FULL_CMD}}` | Full local test suite (e2e + integration; slower). |
| `{{LINT_CMD}}` | Lint command (e.g., `npm run lint`). |
| `{{TYPECHECK_CMD}}` | Type-check command (e.g., `npm run typecheck`). |
| `{{DATA_MODEL_PATH}}` | Path to the project's data-model source of truth (e.g., `prisma/schema.prisma`, `db/schema.rb`, `migrations/`). Used in the module-spec template's Data Model section. |
| `{{TEST_E2E_DIR}}` | Directory where end-to-end tests live (e.g., `e2e/suites/`, `tests/e2e/`, `cypress/integration/`). Used in the journey-spec template's `verifying_e2e_test:` frontmatter. |

## Usage

1. **Copy the template you need** from this directory into your repo. Filenames
   ending in `.md.template` are editable; plain `.md` are lift-as-is.
2. **Search-and-replace the `{{...}}` tokens** with your project's values.
   `grep -ohrE '\{\{[A-Z_]+\}\}' your-copy/` lists what's left to fill in.
3. **For `templates/snippets/*.md`**, append the relevant snippet content into
   your filled-in `CLAUDE.md` if you're on Next.js (or skip if you're not).
   Adapt helper names to your codebase.

## Sourcing modes

Every template names how it relates to its conceptual prior art per
[`specs/00-vision-and-license.md` §"Sourcing modes"](../specs/00-vision-and-license.md#sourcing-modes):

- **`verbatim`** — Lifted byte-for-byte. Header cites source + upstream license.
- **`verbatim-with-light-edit`** — Lifted, then edited with a small bounded diff
  (drop framework-specific items the kit doesn't ship; add a clearly-labeled
  stack-specific example block).
- **`customization`** — Used as a starting point; substantially rewritten or
  extended. Header notes what was lifted vs. authored.
- **`pattern-only`** — Conceptual inheritance only; no prose, structure, or
  named items lifted. The upstream concept is cited inline.

The kit lifts expression only from genuinely permissive sources (CC0, MIT,
Apache-2.0). When upstream is copyleft (CC BY-SA, GPL), the kit authors from
patterns under `customization` rather than lifts expression — see
[`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md).

## The cheatsheet is the source of truth

`templates/cheatsheet.md.template` is the canonical list of daily commands,
daily skills, and reviewer-agent mapping (Appendix A). The kit's other
templates and `docs/methodology.md` reference the cheatsheet by anchor; they
do not restate its content. When the reviewer roster or daily-command list
changes, the cheatsheet is what you edit — not the methodology doc, not this
README.
