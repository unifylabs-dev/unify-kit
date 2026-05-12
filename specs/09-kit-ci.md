# Spec 09 — The Kit's Own CI

> Status: Implemented in v0.2.x
> Depends on: 00 (forbidden-strings list, glossary), 01 (filename canon), 02 (placeholder vocabulary), 03 (hook bundle), 04 (workflow YAML), 05 (bootstrap script + fixtures), 08 (CHANGELOG discipline)
> Related: every other spec — this one validates them.

## Purpose

Specify the GitHub Actions workflows that run **against this repo** (`unify-kit`)
to enforce the spec acceptance criteria automatically. Without this spec, "shellcheck-
clean" and "no `optics-management` references" and "valid YAML" are aspirational —
this spec makes them gates.

The workflows here are **distinct from** the workflow we ship to consumers
(`github-actions/claude-code-review.yml`, spec 04). These run on the kit repo
itself; that one ships *to* consumers.

## Why this exists

A security-first kit that ships secrets-scanning hooks to consumers but doesn't
dogfood any quality gates on its own scripts is a credibility hit. Half the spec
acceptance criteria explicitly cite a CI gate (shellcheck-clean, lint clean, scrub
check). Without this spec, those gates have no automated owner.

## Workflows shipped

All four live in `.github/workflows/` (the kit's own workflows directory — not
`github-actions/` which ships *to consumers*).

### 1. `lint.yml` — shellcheck + yamllint + markdownlint + link-check + JSON schema

Triggers: every PR + push to `main`.

| Step | Tool | Scope | Failure mode |
|---|---|---|---|
| Shellcheck | `koalaman/shellcheck-action` (or equivalent) | `hooks/*.sh`, `scripts/*.sh` | Any warning fails the build (we want clean Bash). |
| Actionlint | `rhysd/actionlint` | `github-actions/*.yml`, `.github/workflows/*.yml` | Any error fails the build. |
| Markdownlint | `markdownlint-cli2` | `docs/**/*.md`, `specs/*.md`, `templates/**/*.md`, root `*.md` | Standard ruleset; tunable in `.markdownlint.json`. |
| Link-check | `lycheeverse/lychee-action` | All `.md` files | External 404s warn (don't block); internal broken links fail. |
| JSON schema | `jsonschema-cli` (or `ajv-cli`) | `hooks/settings-snippet.json` | Validates against the expected hook-schema shape (see spec 03). Fails if invalid JSON or wrong shape. |

### 2. `scrub-check.yml` — forbidden-strings + placeholder vocabulary

Triggers: every PR + push to `main`.

**Forbidden-strings scan** runs `grep -r` against the **shipped artifacts only** —
the directories whose contents go into a consumer's repo or `~/.claude/`. Specs
and docs are explicitly out of scope: they *describe* what's forbidden and must
be able to name the patterns.

In scope (must be clean):
- `templates/`
- `hooks/`
- `github-actions/`
- `scripts/` (excluding `scripts/test-fixtures/` — fixtures intentionally contain
  bad patterns to test against)
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `llms.txt`
- `docs/philosophy.md`, `docs/methodology.md`

Out of scope (allowed to reference forbidden patterns as documentation):
- `specs/*`
- `docs/audit/*`
- `docs/decisions/*` (ADRs may discuss why patterns are forbidden)
- `scripts/test-fixtures/*`

The scrub patterns:

| Pattern | Reason |
|---|---|
| `optics-management` | project-specific, must not leak |
| `optics_boutique` | same |
| `mvo_` | session-cookie name from internal project |
| `Mint Vision` / `mintvisionsoptique` | internal brand |
| `Mvo\$Staff` | internal credential pattern |
| `aws-1-ca-central-1.pooler.supabase.com` | internal infra hostname |
| `postgres\.[a-z]+:` | inline credential pattern (anchored to avoid false positives) |
| Anthropic API key pattern (`sk-ant-`) | secret |
| AWS access key pattern (`AKIA[0-9A-Z]{16}`) | secret |

Hits in any file outside `docs/audit/` fail the build.

**Placeholder vocabulary scan** runs against `templates/`:

- Every `{{...}}` token must appear in spec 02's supported placeholder vocabulary.
- Every supported placeholder must appear in at least one template (catches dead
  vocabulary).

### 3. `bootstrap-fixture.yml` — bootstrap idempotency + hook firing

Triggers: every PR that touches `hooks/`, `scripts/`, or `templates/`. Plus weekly
on `main`.

**Steps:**

1. Set up an isolated `~/.claude` (use `HOME=$RUNNER_TEMP/fake-home`).
2. Copy `scripts/test-fixtures/settings.json.good-fixture` into the fake home;
   rename to `~/.claude/settings.json`.
3. Run `scripts/bootstrap-claude-config.sh`. Assert: exit 0; backup created;
   hook files in `~/.claude/hooks/`; hooks registered in `settings.json`.
4. Run it again. Assert: exit 0; "no changes needed" in stdout (idempotency).
5. Run with `--dry-run` on a fresh fake home. Assert: exit 0; no files created or
   modified.
6. Run with `--force` after manually editing a kit-shipped hook entry. Assert: kit
   entry overwritten; consumer's edit backed up.
7. For each hook in `hooks/*.sh`, run the manual-test recipe from
   `hooks/README.md` (the recipes are runnable bash). Assert: each recipe prints
   PASS.
8. Run `audit-scan.sh test-fixtures/settings.json.good-fixture`. Assert: exit 0;
   zero findings.
9. Run `audit-scan.sh test-fixtures/settings.json.bad-fixture`. Assert: exit
   non-zero; `inline-credential`, `unrestricted-mcp`, `missing-hook-file` flagged.

### 4. `changelog-check.yml` — `[Unreleased]` discipline

Triggers: every PR.

**Behavior:**

- If the PR touches any file in `templates/`, `hooks/`, `scripts/`,
  `github-actions/`, `specs/`, or `docs/methodology.md` / `docs/philosophy.md`:
  - Assert that `CHANGELOG.md` `[Unreleased]` section has changed in the PR diff.
  - If unchanged, fail the check with: "PR touches kit artifacts but
    `CHANGELOG.md` `[Unreleased]` is unchanged. Add an entry."

**Exemptions:** `[skip-changelog]` in the PR title bypasses (for purely
infrastructural PRs like fixing the changelog-check workflow itself). Used
sparingly; reviewed for abuse.

## Decisions needed

All CI-level decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | Run on every PR or only `main`? | Every PR + push to `main` for lint, scrub, bootstrap-fixture. Changelog-check on PRs only. |
| 2 | Block merges on lint warnings vs. just errors? | Block on warnings for shellcheck + actionlint (we want zero noise in shipped scripts). Markdownlint warnings are advisory. |
| 3 | External link-check failure mode | Warn-don't-fail (external 404s are common). Internal broken links fail. |
| 4 | CHANGELOG enforcement scope | All kit-artifact directories. Not `specs/` revisions footers (those don't belong in CHANGELOG). |
| 5 | Where to store CI helpers (e.g., scrub script) | `scripts/ci/` for any CI-only helpers. Reuse `audit-scan.sh` and bootstrap fixtures wherever possible. |

## Out of scope

- Performance benchmarks for the bootstrap script. The kit is small enough that
  speed isn't a v1 concern.
- Multi-OS testing (Windows / WSL). v1 is Bash on `ubuntu-latest`.
- Code coverage metrics. Most artifacts here aren't really "code" in a coverage
  sense.
- Auto-merging Dependabot PRs. Out of v1.

## Acceptance criteria

- All four workflows live in `.github/workflows/` and are valid YAML (self-
  validating: `lint.yml` lints itself).
- A clean `main` branch passes all four workflows green.
- A PR that introduces `optics-management` in any in-scope file (per the scope
  rules above) fails `scrub-check.yml`. References inside `specs/`, `docs/audit/`,
  `docs/decisions/`, or `scripts/test-fixtures/` are exempt.
- A PR that introduces a shellcheck warning in `hooks/` fails `lint.yml`.
- A PR that touches `templates/` without updating `CHANGELOG.md` `[Unreleased]`
  fails `changelog-check.yml`.
- A regression that breaks `bootstrap-claude-config.sh` idempotency fails
  `bootstrap-fixture.yml`.
- The kit's `README.md` displays a status badge for each workflow.

## Revisions

Addressed: R-039 (this entire spec), R-038 (CHANGELOG enforcement via
`changelog-check.yml`).

**v0.2 revision (2026-05-03):** scrub scope tightened to shipped artifacts only.
Specs, audit docs, ADRs, and test fixtures are exempt — they must be able to
discuss forbidden patterns as documentation.

This is a new spec added during the spec-hardening pass per the spec-review
2026-05-03 findings.
