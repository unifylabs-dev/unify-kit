# unify-kit

> **Status:** Pre-development, specs hardened (2026-05-03).
> Specs awaiting final review and approval in [`specs/`](specs/).

A starter kit for spinning up new projects with a structured, opinionated Claude
Code workflow. Distilled from production practice on a Next.js + Postgres app and
best practices from the
[Claude Code Ultimate Guide](https://github.com/FlorianBruniaux/claude-code-ultimate-guide).

**The Ultimate Guide teaches; this kit ships.** Clone, bootstrap, work.

---

## What this kit will eventually ship

- A team-ready `claude.md.template` with stack-agnostic core + opt-in stack
  snippets
- A bundle of six security hooks (verbatim CC0 lifts) with a non-destructive
  bootstrap installer
- A comment-triggered GitHub Actions workflow for AI-assisted PR review
- An onboarding curriculum (day-1 / week-1 / day-30) with verifiable gates
- An AI usage charter, MCP vetting policy, security checklist, cheatsheet
- Bootstrap and audit scripts (with reproducible test fixtures)
- A philosophy doc (5 stable principles) + methodology canon (the actual
  workflows)
- The kit's own CI: shellcheck, scrub-check, bootstrap-fixture, changelog-check
- An upgrade-flow contract so v0.x consumers can pull v0.y without losing
  customizations
- A public-readiness checklist gating v1.0.0 release
- Living docs (CHANGELOG, ADRs) so the kit improves over time

---

## Repo layout (current)

```
unify-kit/                                (renamed from project-framework on 2026-05-04)
├── README.md                             ← you are here
├── docs/
│   └── audit/                            ← historical record
│       ├── framework-deep-dive.md        ← what the Ultimate Guide is
│       ├── current-stack-inventory.md    ← what we run today
│       ├── gap-analysis.md               ← framework vs ours
│       ├── recommendations.md            ← tiered adoption recs
│       └── spec-review-2026-05-03.md     ← the hardening review
└── specs/                                ← pre-implementation specs
    ├── README.md                         ← specs index + decisions resolved
    ├── 00-vision-and-license.md
    ├── 01-repo-structure.md
    ├── 02-templates.md
    ├── 03-hooks.md
    ├── 04-github-actions.md
    ├── 05-scripts.md
    ├── 06-onboarding-curriculum.md
    ├── 07-philosophy-and-methodology.md
    ├── 08-living-docs-and-decision-log.md
    └── 09-kit-ci.md                      ← the kit's own CI
```

After approval, top-level component directories (`hooks/`, `github-actions/`,
`templates/`, `scripts/`, `onboarding/`, `.github/workflows/`) get built per
spec 01's layout, one (or a few) per `/phase` execution.

---

## How to review

Start at [`specs/README.md`](specs/README.md). It indexes all 10 specs, lists
every decision that was resolved during the hardening pass, and points to the
review report.

The hardening pass (per
[`docs/audit/spec-review-2026-05-03.md`](docs/audit/spec-review-2026-05-03.md))
ran three parallel reviewers (DHH, Kieran, code-simplicity) and produced 47
deduplicated findings. The current spec set incorporates all 12 must-fix and ~25
quality-critical should-fix findings.

---

## What's *not* in scope

- Not a Claude Code clone, fork, or replacement. Assumes you're using
  [Claude Code](https://claude.com/claude-code) and gives you a workflow on top.
- Not an alternative to existing plugins like `superpowers`,
  `compound-engineering`, or `frontend-design`. Composes with them.
- Not a deploy framework, build tool, or app scaffold. The
  `templates/claude.md.template` ships stack-agnostic; Next.js patterns live as
  opt-in snippets in `templates/snippets/`.
- Filled-in examples (`examples/`) are deferred to v1.1 — once the kit has been
  used to bootstrap one real project, the sanitized output of that bootstrapping
  becomes the v1.1 examples.

---

## Pointers

- Specs (start here): [`specs/README.md`](specs/README.md)
- Background analysis: [`docs/audit/`](docs/audit/)
- Hardening review: [`docs/audit/spec-review-2026-05-03.md`](docs/audit/spec-review-2026-05-03.md)
- Source inspiration: [Claude Code Ultimate Guide](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)
  by Florian Bruniaux (CC BY-SA 4.0 content / CC0 templates)
