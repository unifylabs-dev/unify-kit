# unify-kit

> The Ultimate Guide teaches; this kit ships. Clone, bootstrap, work.

[![lint](https://github.com/unifylabs-dev/unify-kit/actions/workflows/lint.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/lint.yml)
[![scrub-check](https://github.com/unifylabs-dev/unify-kit/actions/workflows/scrub-check.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/scrub-check.yml)
[![bootstrap-fixture](https://github.com/unifylabs-dev/unify-kit/actions/workflows/bootstrap-fixture.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/bootstrap-fixture.yml)
[![changelog-check](https://github.com/unifylabs-dev/unify-kit/actions/workflows/changelog-check.yml/badge.svg)](https://github.com/unifylabs-dev/unify-kit/actions/workflows/changelog-check.yml)

---

## What it is

A reusable, opinionated kickstarter for any new Claude Code project. Unify-kit
ships templates, hooks, GitHub Actions, scripts, and onboarding docs that encode
mature practice — so a new project (or new dev) lands on day one with a
team-ready `CLAUDE.md`, six security hooks installed, a comment-triggered
PR-review workflow wired up, and a short onboarding curriculum.

The kit composes existing plugins (`superpowers`, `compound-engineering`); it
does not replace them. The only mandatory mental model is `{{NAME}}` placeholder
syntax. Everything else is a default that you can change.

---

## What's in the box

- [`templates/`](templates/) — 7 templates + 4 Next.js snippets + README.
  [`cheatsheet.md.template`](templates/cheatsheet.md.template) is the source of
  truth for command vocabulary, daily skills, and reviewer-agent mapping.
- [`hooks/`](hooks/) — 6 security hooks (lifted CC0) + a settings-snippet to
  register them + a README with manual-test recipes.
- [`scripts/`](scripts/) — [`bootstrap-claude-config.sh`](scripts/bootstrap-claude-config.sh)
  (idempotent installer, `--dry-run` + `--force`, mandatory backups,
  manifest-tracked) + [`audit-scan.sh`](scripts/audit-scan.sh) (config health
  check) + test fixtures.
- [`github-actions/`](github-actions/) — Comment-triggered tiered PR-review
  workflow + the externalized review prompt + an adoption README.
- [`docs/`](docs/) — [`philosophy.md`](docs/philosophy.md) (5 stable
  principles) + [`methodology.md`](docs/methodology.md) (operational canon) +
  [`decisions/`](docs/decisions/) (lightweight ADRs).
- [`onboarding/`](onboarding/) — Day-1 / week-1 / day-30 curriculum with
  objectively verifiable hard gates on day-1 and soft milestones afterward.
- [`specs/`](specs/) — Pre-implementation specs (historical record).

---

## Quick start

1. **Clone or fork** this repo locally.
2. **Read the core docs** in this order: [`docs/philosophy.md`](docs/philosophy.md)
   → [`docs/methodology.md`](docs/methodology.md) →
   [`templates/cheatsheet.md.template`](templates/cheatsheet.md.template).
3. **Install the security hooks** by running
   [`scripts/bootstrap-claude-config.sh`](scripts/bootstrap-claude-config.sh)
   from this repo's root. The script is idempotent, takes `--dry-run` and
   `--force`, makes timestamped backups before any change, and writes a
   manifest at `~/.claude/.unify-kit-manifest.json`.
4. **Apply the kit to your project**: copy the templates you want into your
   project, replace the `{{...}}` placeholders, and ship. The
   [`templates/README.md`](templates/README.md) lists every placeholder and
   per-template sourcing mode.

---

## Status

`v0.1.0` — released 2026-05-05. Development release; v1.0.0 lands when one
consumer project has been bootstrapped end-to-end with the kit (per
[`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md)
§7). Items deferred to v1.0.0 — `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue
templates, PR template, auto-on-PR review variants, `claude-md-validator`,
`update-from-upstream`, the filled-in `examples/` directory — are tracked in
[`BACKLOG.md`](BACKLOG.md).

---

## Compatibility

Bash + macOS / Linux. Windows users use WSL.

---

## License

MIT for code, CC0 1.0 for templates, CC BY-SA 4.0 for narrative documentation.
See [`LICENSE`](LICENSE) for the full breakdown.

---

## Contributing

Spec-first per [`CONTRIBUTING.md`](CONTRIBUTING.md). Open an issue describing
the change, write a numbered spec under [`specs/`](specs/), get review,
implement; every PR that touches a kit artifact updates `CHANGELOG.md`'s
`[Unreleased]` block (the kit's own
[`changelog-check.yml`](.github/workflows/changelog-check.yml) workflow
enforces this).

---

## Acknowledgments

Hooks, the `audit-scan` script's core, and the security-checklist OWASP spine
are lifted (or distilled) from
[`github.com/FlorianBruniaux/claude-code-ultimate-guide`](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)
under that project's CC0 examples sub-tree, with header comments preserving
provenance per the kit's
[`docs/decisions/0001-hook-bundle-licensing.md`](docs/decisions/0001-hook-bundle-licensing.md).
The Ultimate Guide teaches; this kit ships.
