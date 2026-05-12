<!--
templates/README.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-04 (v0.1.0); restructured 2026-05-12 (v2 template tiers)
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# templates/

Every consumer-facing template the kit exposes, organized into tiers that map
to `scripts/init-project.sh` flags. Templates with `.template` suffix carry
`{{...}}` placeholders that get substituted at install time; plain `.md`
files are lift-as-is.

## Tier layout

```
templates/
├── core/              # Always applied (no flag needed)
│   ├── claude.md.template
│   ├── cheatsheet.md.template
│   ├── ai-usage-charter.md.template
│   ├── mcp-policy.md.template
│   ├── security-checklist.md
│   ├── pull-request-template.md.template
│   ├── issue-templates/{bug-report,feature-request}.yml.template
│   ├── specs/{README,module,journey}.md.template
│   └── github/CODEOWNERS.template
├── claude-runtime/    # Always applied: per-project Claude Code config
│   ├── .mcp.json.template
│   ├── .mcp.json.examples.md         # reference for MCP server configs
│   └── .claude-settings.json.template
├── optional/          # Opt-in via --include=<name>
│   ├── team-onboarding.md.template
│   ├── methodology-retro.md.template
│   └── llms.txt.template
├── compliance/        # Opt-in via --compliance=<profile>
│   ├── README.md                     # how profiles work
│   └── profiles/{baseline-pipeda,healthcare-phipa,financial-canada,general-soc2}/
└── snippets/          # Opt-in via --snippets=<stack>
    ├── nextjs/        # Next.js-specific patterns
    ├── testing/       # Stack-agnostic test conventions
    └── ci/            # CI workflow + bash helpers
```

## Tier flags (init-project.sh contract)

| Flag | Effect |
|---|---|
| (none) | Always applies `core/` + `claude-runtime/`. |
| `--include=<name>` | Adds the named template from `optional/` (e.g. `--include=team-onboarding`). Repeatable. |
| `--compliance=<profile>` | Applies the named profile from `compliance/profiles/`. Each profile's docs land under `<consumer>/docs/compliance/` and `<consumer>/runbooks/`. The profile's claude-md addendum is appended to `<consumer>/CLAUDE.md`. |
| `--snippets=<stack>` | Adds the named stack's snippets reference into `<consumer>/CLAUDE.md` (the snippet content itself stays under `templates/snippets/<stack>/` for reference). |

`--snippets=<stack>` ships today (v1 behavior, unchanged). `--include` and
`--compliance` are the v2 contract that `scripts/init-project.sh`'s phase-4
refactor will wire up; the template tree above defines what those flags will
apply. Until phase 4 lands, the kit ships the tree but the script still
operates on v1's flat-layout assumptions (`init-project-fixture` CI is red by
design for the duration of this transition).

## Templates by tier

### `core/` — always applied

| Template | Purpose |
|---|---|
| `claude.md.template` | 8-section project memory file (stack-agnostic). |
| `cheatsheet.md.template` | One-page pocket reference: daily commands, daily skills, reviewer roster (Appendix A). |
| `ai-usage-charter.md.template` | 6-section AI usage charter. |
| `mcp-policy.md.template` | 5-section MCP allowlist + vetting + add/remove process. |
| `security-checklist.md` | OWASP Top-10 spine + labeled Next.js stack-example block. |
| `pull-request-template.md.template` | PR template with the load-bearing Spec Changes two-checkbox gate. |
| `issue-templates/feature-request.yml.template` | GitHub form-schema YAML; required "Spec sections affected" field. |
| `issue-templates/bug-report.yml.template` | GitHub form-schema YAML; drift-fix vs behavior-change framing. |
| `specs/README.md.template` | Index for `<consumer>/docs/specs/`. |
| `specs/module.md.template` | Durable module-spec template (200–500 lines). |
| `specs/journey.md.template` | Durable journey-spec template (100–300 lines). |
| `github/CODEOWNERS.template` | Routes Claude config + compliance docs to the repo owner. |

### `claude-runtime/` — always applied

| Template | Purpose |
|---|---|
| `.mcp.json.template` | Empty `{ "mcpServers": {} }` skeleton; populate per project. |
| `.mcp.json.examples.md` | Reference doc with worked examples for Supabase / Playwright / context7. |
| `.claude-settings.json.template` | `enableAllProjectMcpServers: true` + permission allowlist for safe-default Bash commands. |

### `optional/` — opt-in

| Template | Use when |
|---|---|
| `team-onboarding.md.template` | Team grows past 1 dev; a new joiner needs a guided path. |
| `methodology-retro.md.template` | Running methodology retros (recommended cadence every 4–6 features). |
| `llms.txt.template` | Public-facing project; `llms.txt` published at the repo root for LLM tools. |

### `compliance/` — opt-in

See `templates/compliance/README.md` for the full profile contract + matrix.

| Profile | Regulators | When to use |
|---|---|---|
| `baseline-pipeda` | PIPEDA + provincial privacy | Default for any Canadian project handling personal info. |
| `healthcare-phipa` | PHIPA (Ontario) + PIPEDA baseline | Ontario health-information custodians/agents. |
| `financial-canada` | PIPEDA + FINTRAC + provincial securities | Canadian financial-services projects. |
| `general-soc2` | SOC 2 Trust Services Criteria | B2B SaaS targeting enterprise vendor reviews. |

### `snippets/nextjs/` — opt-in

| Snippet | Pattern |
|---|---|
| `server-action-anatomy.md` | 6-step Server Action: auth-guard → validate → audit-start → business → audit-success → return. |
| `audit-logging.md` | `logAudit()` fire-and-forget helper for security-relevant events. |
| `rate-limiting.md` | `checkRateLimit` + `timingSafeDelay` for public endpoints. |
| `middleware.md` | Dual-session + idle-timeout middleware; actor identification, not authorization. |
| `prisma-7.md` | Prisma 7 + `prisma.config.ts` + `@prisma/adapter-pg` + dual-seed pattern. |
| `drizzle.md` | Drizzle ORM in a monorepo `packages/db` workspace package. |
| `custom-auth.md` | bcrypt + HMAC-signed cookie session + DAL `verifySession` / `verifyRole`. |
| `forms.md` | `useActionState` + Server Action + Zod with a discriminated-union result. |
| `semantic-release.md` | semantic-release + husky commitlint + Vercel `ignoreCommand`. |

### `snippets/testing/` — opt-in

| Snippet | Pattern |
|---|---|
| `bdd-lite-test-naming.md` | `Journey: <slug>` describe block + Given/When/Then test names + `@daily` tagging. Stack-agnostic. |

### `snippets/ci/` — opt-in

| Snippet | Pattern |
|---|---|
| `ci-test-split-bash.sh` | Smart CI test-split: always-run core + diff-driven action tests + full-suite fallback. |
| `ci-pr-fast.yml.template` | GitHub Actions: Tier-1 PR-fast + Tier-2 daily-E2E with secrets-gate pattern. |
| `ci-nightly.yml.template` | GitHub Actions: Tier-4 nightly (full unit + full e2e on cron + workflow_dispatch). |

## Placeholder vocabulary

Templates use one mandatory placeholder syntax: double-curly-braces around an
uppercase identifier (matching the regex `\{\{[A-Z][A-Z0-9_]*\}\}`). Every
placeholder used in any template is listed below; nothing else. The kit's
own CI (`scrub-check.yml`) fails when an undeclared placeholder appears,
AND when a declared placeholder is never used.

| Placeholder | Meaning |
|---|---|
| `{{PROJECT_NAME}}` | Display name; appears in headings, prose, titles. |
| `{{ONE_LINE_DESCRIPTION}}` | One-sentence elevator description (≤120 chars). |
| `{{STACK}}` | One-line stack summary (e.g., "Next.js 14 + Postgres + tRPC"). |
| `{{REPO_URL}}` | Canonical repository URL. |
| `{{TEAM_NAME}}` | Team or org name (onboarding welcomes, owner tables). |
| `{{LANG}}` | Primary programming language (e.g., `TypeScript`, `Go`, `Python`). |
| `{{LANG_VERSION}}` | Pinned language version (e.g., `5.4`, `1.22`, `3.12`). |
| `{{FRAMEWORK}}` | Primary framework (e.g., `Next.js 14`, `Django 5`). |
| `{{DB}}` | Primary database (e.g., `Postgres 16`, `MySQL 8`, `SQLite`). |
| `{{KEY_LIBS}}` | Comma-separated list of load-bearing libraries (≤5 items). |
| `{{ROOT}}` | Project root path label (e.g., `apps/web`). |
| `{{BUILD_CMD}}` | Build command. |
| `{{TEST_CI_CMD}}` | Tests that run in CI (the PR gate). |
| `{{TEST_FULL_CMD}}` | Full local test suite. |
| `{{LINT_CMD}}` | Lint command. |
| `{{TYPECHECK_CMD}}` | Type-check command. |
| `{{DATA_MODEL_PATH}}` | Path to data-model source of truth (e.g., `prisma/schema.prisma`, `db/schema.rb`). |
| `{{TEST_E2E_DIR}}` | Directory where end-to-end tests live (e.g., `e2e/suites/`, `tests/e2e/`). |
| `{{REPO_OWNER}}` | GitHub user or team owning Claude config + compliance docs (e.g., `@org/security`). |
| `{{COMPLIANCE_PROFILE}}` | Active compliance profile slug. One of `baseline-pipeda`, `healthcare-phipa`, `financial-canada`, `general-soc2`. Set by `init-project.sh --compliance=<profile>`. |

## Usage

1. **Copy the template you need** into your repo. `.template` suffix files
   are editable; plain `.md` are lift-as-is.
2. **Search-and-replace `{{...}}` tokens** with your project's values.
   `grep -ohrE '\{\{[A-Z][A-Z0-9_]*\}\}' your-copy/` lists what's left.
3. **For `snippets/<stack>/*.md`**, append the relevant snippet content into
   your filled-in `CLAUDE.md` if you're on that stack. Adapt helper names to
   your codebase.

## GitHub repo scaffolding (manual install)

From the consumer repo's root, with `unify-kit` cloned alongside as `../unify-kit`:

```bash
# Create the GitHub directories.
mkdir -p .github/ISSUE_TEMPLATE

# PR template — has placeholders, requires search-and-replace after copy.
cp ../unify-kit/templates/core/pull-request-template.md.template \
   .github/pull_request_template.md

# Issue templates — lift-as-rename, no placeholders inside.
cp ../unify-kit/templates/core/issue-templates/feature-request.yml.template \
   .github/ISSUE_TEMPLATE/feature_request.yml
cp ../unify-kit/templates/core/issue-templates/bug-report.yml.template \
   .github/ISSUE_TEMPLATE/bug_report.yml

# CODEOWNERS — placeholder requires search-and-replace.
cp ../unify-kit/templates/core/github/CODEOWNERS.template .github/CODEOWNERS

# Strip the leading provenance comments from all four installed files.
# These document the kit's sourcing-mode for the kit's audit trail;
# they have no purpose in a consumer's repo.

# Search-and-replace placeholders in the PR template + CODEOWNERS.
# PR template uses {{TEST_FULL_CMD}} and {{BUILD_CMD}}; CODEOWNERS uses
# {{REPO_OWNER}}. All are in the kit's placeholder vocabulary.
```

After install, GitHub renders the issue templates as a guided form (with
required-field validation) and pre-populates the PR body on `New pull
request.`

## Sourcing modes

Every template names how it relates to its conceptual prior art per
[`specs/00-vision-and-license.md` §"Sourcing modes"](../specs/00-vision-and-license.md#sourcing-modes):

- **`verbatim`** — Lifted byte-for-byte; header cites source + upstream license.
- **`verbatim-with-light-edit`** — Lifted then bounded-edited.
- **`customization`** — Used as starting point; substantially rewritten.
- **`pattern-only`** — Conceptual inheritance; no prose/structure/named items lifted.

The kit lifts expression only from genuinely permissive sources (CC0, MIT,
Apache-2.0). When upstream is copyleft (CC BY-SA, GPL), the kit authors from
patterns under `customization` rather than lifting expression — see
[`docs/decisions/0001-hook-bundle-licensing.md`](../docs/decisions/0001-hook-bundle-licensing.md).

## The cheatsheet is the source of truth

`templates/core/cheatsheet.md.template` is the canonical list of daily
commands, daily skills, and reviewer roster (Appendix A). Other templates
and `docs/methodology.md` reference the cheatsheet by anchor; they do not
restate its content. When the reviewer roster or daily-command list changes,
the cheatsheet is what you edit — not the methodology doc, not this README.
