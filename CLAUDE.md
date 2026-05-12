<!--
templates/core/claude.md.template
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Distilled minimal stack-agnostic core. Structurally inspired by but not lifted
from the Ultimate Guide CLAUDE.md example. Project-specific identifiers belong
in the consumer's filled-in copy, not here.
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# unify-kit

> Opinionated kickstarter for new Claude Code projects (templates, security hooks, GitHub Actions, scripts, onboarding docs).

This file is project memory for Claude Code. Keep it accurate; stale entries
teach errors. Update in the same commit as the code change that invalidates a
section. Stack-specific patterns live in `templates/snippets/<stack>/` and are
appended here à la carte by consumers on Next.js (or skipped on other stacks).

## 1. Project Overview

- **Name**: unify-kit
- **Description**: Opinionated kickstarter for new Claude Code projects (templates, security hooks, GitHub Actions, scripts, onboarding docs).
- **Repository**: https://github.com/unifylabs-dev/unify-kit
- **Stack**: Bash + Markdown + GitHub Actions

## 2. Architecture

unify-kit is a template / docs / scripts repository — no runtime, no DB. Consumers
adopt it via two scripts that mutate filesystem state.

- **Entry points**: `scripts/bootstrap-claude-config.sh` (per-machine `~/.claude/`
  hook + settings install) and `scripts/init-project.sh` (per-project template
  install with placeholder substitution). `scripts/audit-scan.sh` is a read-only
  consumer-side check.
- **Data layer**: none. Per-project state lives in `<consumer>/.unify-kit-project-manifest.json`
  (SHA-256 manifest written by `init-project.sh` for idempotent re-runs).
- **External services**: GitHub Actions for kit-CI (`lint`, `scrub-check`,
  `bootstrap-fixture`, `changelog-check` workflows under `.github/workflows/`).
  No cloud services in the kit's own runtime.

## 3. Conventions

- **Commit convention**: Conventional Commits enforced (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **File naming**: lowercase-dash for shell scripts (`bootstrap-claude-config.sh`); `.template` suffix on every consumer-facing template under `templates/`; UPPERCASE Markdown at root for canonical docs (`README.md`, `CHANGELOG.md`, `BACKLOG.md`).
- **Bash version**: `init-project.sh` requires Bash 4+ (associative arrays). `bootstrap-claude-config.sh` is Bash 3.2-compatible (macOS default).
- **Substitution invariant**: every `{{...}}` placeholder must resolve to a non-empty value OR be explicitly listed in `templates/README.md`'s vocabulary table as "may be empty". `scrub-check.yml` enforces this.
- **Error handling**: scripts use `set -euo pipefail` + atomic-write via tmp-file-then-rename; never partial state on failure.

### Branch Naming

`<type>/<issue-number>-<kebab-description>` where type is one of `feature/`,
`fix/`, `chore/`, `refactor/`. Created via:

```bash
gh issue develop <N> --name <branch> --checkout --base main
```

The `gh issue develop` command is the canonical issue-to-branch hop — it
wires the new branch back to the GitHub issue automatically, so the issue
closes when the resulting PR merges. Example: `feature/83-staff-management`.

## 4. Issue-Driven Development

Use `/work-issue <N>` for any GitHub issue with acceptance criteria. The 8-phase
gated workflow (Phase 0 — Spec Sync — through Phase 7 — PR creation): spec sync
→ analysis → branch → planning → TDD → verification → review prep → PR creation.
Ships in the `superpowers` + `compound-engineering` plugins. Phase 0 reads
`<consumer>/docs/specs/` before any code work; see `docs/methodology.md` §B
(Specification-Driven Development) and §D (Issue-driven dev) for the contract.
See `templates/core/cheatsheet.md.template` for the daily command list — this
file does not restate it.

### Specification Discipline

`/work-issue` Phase 0 reads `<consumer>/docs/specs/` before any code work
begins. Hard rules (full discipline in `docs/methodology.md` §B):

- Every issue with non-trivial behavior change lists "Spec sections affected"
  in its body. Pure drift fixes write `None — fixing drift from spec`.
- Specs ship in the same PR as the code that implements them. Never separate PRs.
- The spec describes behavior, not implementation. Don't quote schemas or copy
  function signatures into specs — link via `code_anchors:` and describe in prose.
- Module specs 200–500 lines; journey specs 100–300 lines. Longer = documenting
  implementation; start over.
- Bug-fix-only PRs (drift fix, no behavior change) tick the "no spec changes
  needed" box in the PR template.

See `templates/core/specs/{module,journey,README}.md.template` for the spec
scaffolding.

## 5. TDD Enforcement

Red-Green-Refactor. Don't modify existing passing tests to accommodate new code;
if existing tests break, fix the implementation, not the tests. If GREEN fails
3 times for the same acceptance criterion, stop and ask for help. The
`superpowers:test-driven-development` skill enforces this.

## 6. Test Strategy

- **Test surface**: lint (`shellcheck`, `actionlint`, `markdownlint`, `lychee`), CI-fixture runs (`bootstrap-fixture` + `init-project-fixture` jobs), and the `scrub-check` workflow that enforces the substitution invariant + template-vocabulary contract.
- **CI command (PR gate)**: the 4 workflows under `.github/workflows/` (`lint`, `scrub-check`, `bootstrap-fixture`, `changelog-check`) run automatically on push + PR.
- **Full local**: `gh workflow run bootstrap-fixture.yml` (runs both `bootstrap-fixture` and `init-project-fixture` jobs end-to-end against the fixture sets under `scripts/test-fixtures/`).
- **Tier discipline**: fixtures are the kit's e2e layer (known-good outputs committed); shell-level checks are the unit layer (shellcheck). No traditional unit/integration tests — the scripts are too simple and the workflows ARE the integration.

## 7. Documentation Requirements

Doc-on-ship rule: every PR that ships user-visible behavior updates the project's
living-doc set in the same commit. Stale docs teach errors. The starter list:

- `README.md` — setup, status, quickstart.
- `CHANGELOG.md` — per-PR `[Unreleased]` entry.
- `docs/architecture.md` — system design, updated when shape changes.

Add project-specific files here (PRD, runbooks, user guides) and tag which
behavior changes require which file to update.

### PR Merge Process

Before merging any PR, complete this checklist:

1. Run the full test suite (`gh workflow run bootstrap-fixture.yml`) — all tests pass (0 failures).
2. Lint clean (`shellcheck scripts/*.sh hooks/*.sh` + `actionlint .github/workflows/*.yml`) — no warnings.
3. Feature verification: trace each test-plan item end-to-end; confirm
   the relevant fixture set under `scripts/test-fixtures/` was regenerated +
   committed if the script's output shape changed; confirm CHANGELOG `[Unreleased]`
   has an entry covering the change.
4. Merge: `gh pr merge <number> --merge` (or your team's policy).
5. Pull updated default branch locally; confirm a clean working tree.
6. Update the project's living-doc set per the §"Documentation Requirements"
   list above. Same commit if the PR didn't already cover them.

This checklist is non-negotiable — never merge without running tests and build
first. The PR template's Verification Checklist mirrors items 1–3.

## 8. Living Document Rules

CLAUDE.md is a self-improving reference. Update it when:

| Trigger | Action |
|---------|--------|
| New pattern established | Add to the relevant section. |
| Bug caused by missing knowledge | Add a gotcha to prevent recurrence. |
| New env var or public route added | Update the relevant section (if your project carries Environment Variables or Middleware sections). |
| Feature shipped | Update the Version Status table (if your project carries one). |
| Outdated info found | Remove or correct — stale docs are worse than none. |

Any session that ships a feature or fixes a bug SHOULD update this file in the
same commit if the change introduces a pattern, convention, or gotcha not
already documented. See `docs/methodology.md` §G (kit doc — link from your
README) for the universal Living Documents principle.

---

Stack-specific patterns are NOT in this template. They live in `templates/snippets/<stack>/`.
A consumer using Next.js patterns appends snippet content into their filled-in `CLAUDE.md`.
