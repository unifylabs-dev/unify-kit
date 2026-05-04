# Spec 01 — Repo Structure & Filename Canon

> Status: Draft / awaiting review
> Depends on: 00 (foundational)
> Related: 02 (templates land in `templates/`), 03 (hooks in `hooks/`), 04 (workflows in `github-actions/`), 05 (scripts in `scripts/`), 06 (curriculum in `onboarding/`), 09 (kit's own CI in `.github/workflows/`)

## Purpose

Define the final directory layout once all specs are implemented, plus the canonical
filename rules every other spec must follow.

---

## Filename canon (every spec uses these conventions)

| Asset class | Convention | Examples |
|---|---|---|
| Templates (consumer copies and edits) | lowercase-hyphenated, `.md.template` suffix | `templates/claude.md.template`, `templates/cheatsheet.md.template`, `templates/mcp-policy.md.template` |
| Lift-as-is files (consumer doesn't edit, just lifts) | lowercase-hyphenated, plain `.md` | `templates/security-checklist.md`, `templates/llms.txt.template` (template because consumer fills stack lines) |
| Hook scripts | preserved upstream filename for traceability | `hooks/dangerous-actions-blocker.sh` |
| Scripts | lowercase-hyphenated `.sh` (Bash) | `scripts/bootstrap-claude-config.sh`, `scripts/audit-scan.sh` |
| GitHub Actions workflows | preserved upstream filename | `github-actions/claude-code-review.yml` |
| Spec / ADR files | zero-padded numeric prefix + lowercase-hyphenated | `specs/00-vision-and-license.md`, `docs/decisions/0001-naming.md` |
| Onboarding curriculum | lowercase + dash | `onboarding/day-1.md`, `onboarding/week-1.md` |

Rules:

- Cross-spec references use the **full filename** including `.md.template` suffix.
  E.g., `templates/cheatsheet.md.template`, never just "the cheatsheet."
- Banned filename styles in v1: SCREAMING_SNAKE_CASE for any new template (legacy
  files like the existing `CLAUDE.md` in optics-management are external and not in
  scope).
- The single canonical reference table is **this spec**. All other specs cite
  filenames from this canon — they do not introduce new naming rules.

---

## Directory layout

```
unify-kit/                          (renamed from project-framework on 2026-05-04)
├── README.md                       intro + status
├── LICENSE                         MIT (default; see spec 00)
├── CHANGELOG.md                    semver release log
├── CONTRIBUTING.md                 contribution rules + spec-first process
├── llms.txt                        repo's own LLM-context summary (~1K tokens)
│
├── docs/
│   ├── audit/                      preserved analysis docs (historical)
│   │   ├── framework-deep-dive.md
│   │   ├── current-stack-inventory.md
│   │   ├── gap-analysis.md
│   │   ├── recommendations.md
│   │   └── spec-review-2026-05-03.md
│   ├── philosophy.md               core philosophy
│   ├── methodology.md              methodology canon
│   ├── decisions/                  ADRs (Architecture Decision Records)
│   │   ├── README.md               ADR index + format
│   │   └── 0001-NAME.md            (one file per decision)
│   └── images/                     diagrams, screenshots
│
├── specs/                          pre-implementation specs
│   ├── README.md                   specs index
│   ├── 00-vision-and-license.md
│   ├── 01-repo-structure.md
│   ├── 02-templates.md
│   ├── 03-hooks.md
│   ├── 04-github-actions.md
│   ├── 05-scripts.md
│   ├── 06-onboarding-curriculum.md
│   ├── 07-philosophy-and-methodology.md
│   ├── 08-living-docs-and-decision-log.md
│   └── 09-kit-ci.md
│
├── templates/                      consumer-facing artifacts (per spec 02)
│   ├── README.md                   "what each template is, how to use it"
│   ├── claude.md.template
│   ├── llms.txt.template
│   ├── ai-usage-charter.md.template
│   ├── mcp-policy.md.template
│   ├── security-checklist.md
│   ├── team-onboarding.md.template
│   ├── cheatsheet.md.template
│   └── snippets/                   stack-specific opt-in fragments (Next.js, etc.)
│
├── hooks/                          drop-into-~/.claude/hooks/ (per spec 03)
│   ├── README.md                   what each hook does, install instructions
│   ├── settings-snippet.json       block to merge into ~/.claude/settings.json
│   ├── dangerous-actions-blocker.sh
│   ├── pre-commit-secrets.sh
│   ├── output-secrets-scanner.sh
│   ├── file-guard.sh
│   ├── claudemd-scanner.sh
│   └── mcp-config-integrity.sh
│
├── github-actions/                 drop-into-.github/workflows/ (per spec 04)
│   ├── README.md                   install + secrets setup
│   ├── claude-code-review.yml      comment-triggered tiered review
│   └── prompts/
│       └── code-review.md          externalized review criteria
│
├── scripts/                        executable utilities (per spec 05)
│   ├── README.md
│   ├── bootstrap-claude-config.sh  install hooks + register in settings.json
│   ├── audit-scan.sh               health/security audit of a Claude config
│   └── test-fixtures/              reproducible bad-config fixtures for audit-scan
│       ├── settings.json.good-fixture
│       └── settings.json.bad-fixture
│
├── onboarding/                     curriculum (per spec 06)
│   ├── README.md
│   ├── day-1.md
│   ├── week-1.md
│   └── day-30.md
│
└── .github/workflows/              the kit's OWN CI (per spec 09)
    ├── lint.yml                    shellcheck, yamllint, markdownlint, link-check
    ├── scrub-check.yml             forbidden-strings scan on templates/
    ├── changelog-check.yml         enforces [Unreleased] discipline
    └── bootstrap-fixture.yml       runs bootstrap-claude-config.sh against fixtures
```

Note: the kit's own CI (`.github/workflows/*`) is distinct from the PR-review
workflow shipped *to consumers* (`github-actions/claude-code-review.yml`). Consumers
copy from `github-actions/` into their own `.github/workflows/`.

---

## Naming conventions (file-level, beyond filename canon)

- **Top-level dirs:** lowercase, plural where they contain artifacts of a type.
- **Hidden files:** none planned for v1 except `.github/`. The pre-existing `.qodo/`
  is unrelated; remove or `.gitignore` before any commit.
- **`.gitignore` content:** standard noise (`.DS_Store`, `*.log`, editor swap files,
  `node_modules/` if anything ever grows one), plus `.qodo/` until decided.

---

## Considered alternatives

| Alternative | Rejected because |
|---|---|
| Flat structure (everything at root) | Doesn't scale; mixes templates with code with docs. |
| Single `assets/` directory | Templates and hooks have different install paths and audiences. |
| `src/` and `tests/` at top level | Implies application code. This is a kit. |
| Monorepo with sub-packages | Massive overkill for a flat repo. |
| `decisions/` at root vs. `docs/decisions/` | `docs/decisions/` chosen — keeps meta organized, consistent with `docs/audit/`. |
| `ci/` umbrella over `github-actions/` | Rejected for v1 — only GitHub Actions in scope. |

---

## Decisions needed

All structural decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | Top-level granularity | 7 top-level directories as listed above. |
| 2 | ADR location | `docs/decisions/`. |
| 3 | Examples directory | **Deferred to v1.1.** Closed by spec 00. The kit ships `templates/snippets/` for opt-in stack fragments; full filled-in examples come once the kit has bootstrapped at least one real project. |
| 4 | `.gitignore` content | Standard editor noise + `.qodo/`. Specific content captured in implementation. |
| 5 | Pre-existing `.qodo/` | Remove before first commit. |

## Out of scope

- File-by-file content within each directory (those are per-component specs 02–09).
- The actual implementation of any directory (this is the layout only).
- Migration tooling (the kit is small enough that a future restructure would be a
  manual change with an ADR).

## Acceptance criteria

- After the directory rename: `pwd` returns a path ending in `unify-kit`.
- All directories listed above exist with at minimum a `README.md` placeholder.
- Every spec from 02–09 maps cleanly to one top-level directory in this layout.
- Every cross-spec filename reference uses the canon defined here (verified by
  `grep`-based scrub in the kit's own CI per spec 09).
- A reader can navigate `README.md` → `specs/README.md` → individual specs → top-
  level component dirs without ambiguity.

## Revisions

Addressed: R-003 (tier vocabulary removed), R-006 (filename canon table added,
templates renamed to lowercase-hyphenated), R-040 (examples decision resolved as
defer-to-v1.1).
