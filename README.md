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
mature practice — so a new project (or new dev) lands on day one with an
enriched `CLAUDE.md` (Branch Naming, Spec Discipline, PR Merge Process, Living
Document Triggers), six security hooks installed, a comment-triggered PR-review
workflow wired up, a Specification-Driven Development layer (module + journey
spec templates + methodology canon), a test-discipline layer (CI test-split +
four-tier pyramid + workflow templates), community files (`CODE_OF_CONDUCT.md`,
`SECURITY.md`, PR + issue templates), and a short onboarding curriculum.

A consumer-side installer ([`scripts/init-project.sh`](scripts/README.md#init-projectsh))
substitutes the 20 `{{...}}` placeholders, writes a SHA-256 manifest for safe
re-runs, and handles existing-file conflicts via `--dry-run`, `--skip`, and
`--force`.

The kit composes existing plugins (`superpowers`, `compound-engineering`); it
does not replace them. The only mandatory mental model is `{{NAME}}` placeholder
syntax. Everything else is a default that you can change.

---

## What's in the box

- [`templates/`](templates/) — organized into the v2 tier structure (`core/`,
  `claude-runtime/`, `optional/`, `compliance/`, `snippets/{nextjs,testing,ci}/`).
  See [`templates/README.md`](templates/README.md) for the full inventory; the
  [`cheatsheet.md.template`](templates/core/cheatsheet.md.template) under `core/`
  is the source of truth for command vocabulary, daily skills, and reviewer-agent
  mapping.
- [`hooks/`](hooks/) — 6 security hooks (lifted CC0) + a settings-snippet to
  register them + a README with manual-test recipes.
- [`scripts/`](scripts/) — three consumer-facing Bash scripts:
  [`bootstrap-claude-config.sh`](scripts/bootstrap-claude-config.sh) (idempotent
  `~/.claude/` installer with mandatory backups + manifest),
  [`init-project.sh`](scripts/init-project.sh) (consumer-side template installer
  with 20-placeholder substitution + `--dry-run` + `--skip` + `--force` +
  `--snippets=<stack>` + `--with-ci-templates`, writes
  `<project>/.unify-kit-project-manifest.json` for safe re-runs), and
  [`audit-scan.sh`](scripts/audit-scan.sh) (config health check).
- [`github-actions/`](github-actions/) — Comment-triggered tiered PR-review
  workflow + the externalized review prompt + an adoption README.
- [`docs/`](docs/) — [`philosophy.md`](docs/philosophy.md) (5 stable
  principles) + [`methodology.md`](docs/methodology.md) (operational canon,
  §A–J) + [`decisions/`](docs/decisions/) (lightweight ADRs) +
  [`audit/`](docs/audit/) (historical audit findings that motivated the kit's
  hook bundle, scope, and methodology — read for context, not as living
  documentation).
- [`onboarding/`](onboarding/) — Day-1 / week-1 / day-30 curriculum with
  objectively verifiable hard gates on day-1 (now 5 gates including
  `init-project.sh` exit-0) and soft milestones afterward.
- [`specs/`](specs/) — 14 pre-implementation specs, all implemented as of
  v0.2.x. Historical record; see per-spec frontmatter for the version each
  landed in.

---

## Quick start

1. **Clone or fork** this repo locally.
2. **Read the core docs** in this order: [`docs/philosophy.md`](docs/philosophy.md)
   → [`docs/methodology.md`](docs/methodology.md) →
   [`templates/core/cheatsheet.md.template`](templates/core/cheatsheet.md.template).
3. **Install the security hooks** by running
   [`scripts/bootstrap-claude-config.sh`](scripts/bootstrap-claude-config.sh)
   from this repo's root. The script is idempotent, takes `--dry-run` and
   `--force`, makes timestamped backups before any change, and writes a
   manifest at `~/.claude/.unify-kit-manifest.json`.
4. **Bootstrap your project**. Run
   [`scripts/init-project.sh <your-project-dir>`](scripts/README.md#init-projectsh)
   from this repo's root. The script installs 11 one-shot templates (`CLAUDE.md`,
   cheatsheet, AI usage charter, MCP policy, security checklist, PR + issue
   templates, specs index, etc.) with `{{...}}` placeholder substitution, writes
   a SHA-256 manifest at `<project>/.unify-kit-project-manifest.json` for safe
   re-runs, and accepts `--dry-run`, `--force`, `--skip <basename>`,
   `--snippets=nextjs`, and `--with-ci-templates`. See
   [`scripts/README.md`](scripts/README.md#init-projectsh) for the full flag
   table and worked examples. If your project already has files that the kit
   installs, jump to §"Adopting the kit on an existing project" below.

---

## Adopting the kit on an existing project

If your project already has a `CLAUDE.md`, a `.github/` directory, or other
files that overlap with what `init-project.sh` installs, the script's
manifest + per-file SHA-256 comparison handles the conflict for you — but a
short up-front discovery pass keeps the live run uneventful.

**Step 1 — preview with `--dry-run`.** From the kit's root:

```bash
scripts/init-project.sh /path/to/your-project --dry-run --config /path/to/init-project-config.yml
```

The output lists every planned write classified as `would create`,
`would backup + overwrite`, `up-to-date`, or `WARNING: target exists with
different content` (the last only fires when the manifest doesn't already
record the file as kit-installed — i.e., you've edited it locally, or the
file pre-dates the kit). Nothing is written.

**Step 2 — classify each existing file.** For each `WARNING:` line, decide:

- **Skip** the kit's version and keep yours: add the basename to
  `--skip` (comma-separated or repeated `--skip` flags).
- **Merge** manually: copy the kit's intended template content from
  `templates/<name>` and integrate by hand, then add the file to `--skip`.
- **Install fresh** (replace yours): pass `--force` (the script backs up
  your version with a UTC-timestamped `.bak.*` suffix before overwriting).
- **Leave alone** (no kit equivalent): nothing to do — the script doesn't
  touch files outside its install map.

**Step 3 — run live.** With the `--skip` list decided:

```bash
scripts/init-project.sh /path/to/your-project \
  --config /path/to/init-project-config.yml \
  --skip cheatsheet.md.template,llms.txt.template
```

The script writes the manifest, installs every non-skipped target, and
reports per-file `created` / `backed-up + overwrote` / `up-to-date`. Re-runs
are idempotent — the manifest's SHA-256 map skips already-kit-installed
files.

**Step 4 — wire up the GitHub Action.** Copy
`github-actions/claude-code-review.yml` + `github-actions/prompts/code-review.md`
into `<your-project>/.github/workflows/` (and `.github/workflows/prompts/`).
Install the [Claude Code GitHub App](https://github.com/apps/claude) on your
repo or org (required for both auth paths; see
[`github-actions/README.md`](github-actions/README.md#secrets)), then set the
API-key secret:

```bash
gh secret set ANTHROPIC_API_KEY --repo <your-org>/<your-repo> --body "$YOUR_KEY"
```

Open a test PR and comment `/claude-review` to verify.

---

## See it in action

A reference consumer project exists at
[unifylabs-dev/unify-kit-example-nextjs](https://github.com/unifylabs-dev/unify-kit-example-nextjs).
It was scaffolded with `create-next-app`, bootstrapped end-to-end with
`init-project.sh`, and serves as the v1.0.0 trigger's "one project bootstrapped
end-to-end" reference (per
[`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md)
§7). The sandbox's
[PR #1](https://github.com/unifylabs-dev/unify-kit-example-nextjs/pull/1) shows
the `/claude-review` workflow invoked against a deliberately-flawed PR; the
workflow's `anthropics/claude-code-action@v1` integration is being refined
(comment-posting via the `prompt:`-input mode is tracked as a v1.0.1 follow-up
in [`BACKLOG.md`](BACKLOG.md)), so the PR itself doesn't yet carry a posted
tiered review comment.

---

## Status

`v1.0.0` — released 2026-05-11. One consumer project
([`unify-kit-example-nextjs`](https://github.com/unifylabs-dev/unify-kit-example-nextjs))
has been bootstrapped end-to-end via `init-project.sh`, which satisfies the
v1.0.0 single-gate trigger per
[`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md)
§7. All 14 specs (00–13) are implemented as of v0.2.x — see
[`specs/README.md`](specs/README.md) and per-spec frontmatter. Manual upgrade
guidance for future kit versions lives in [`UPGRADING.md`](UPGRADING.md).

Items deferred to v1.x — `update-from-upstream.sh`, filled-in `examples/`,
one-liner curl install, npm / Homebrew / cargo distribution, `unify-kit doctor`
composite check, `/adr new` scaffolder, multi-stack snippets beyond Next.js —
are tracked in [`BACKLOG.md`](BACKLOG.md).

---

## Compatibility

Bash + macOS / Linux. Windows users use WSL.
[`bootstrap-claude-config.sh`](scripts/bootstrap-claude-config.sh) targets
Bash 3.2+ (macOS default).
[`init-project.sh`](scripts/init-project.sh) requires Bash 4+ (associative
arrays) — on macOS, install via `brew install bash` and invoke as
`/opt/homebrew/bin/bash scripts/init-project.sh ...`.

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
