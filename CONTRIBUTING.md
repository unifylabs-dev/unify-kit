# Contributing to `unify-kit`

## Welcome

`unify-kit` is a reusable, opinionated kickstarter for new Claude Code projects — templates, hooks, GitHub Actions, scripts, and onboarding docs that turn a fresh repo into a working starter on day one. Contributions follow a Spec-first flow: every non-trivial change is described in a spec under `specs/` before code lands.

## Spec-first contribution flow

The same six-step flow that produced v1 is the contribution flow, whether the contribution comes from the maintainer, the team, or a public OSS user.

1. **Open a GitHub issue** describing the proposed change. State the problem, the goal, and (if you have one) a sketch of the approach. One issue per change; small unrelated cleanups can land via a `chore:` PR without an issue.

2. **Discuss.** The maintainer comments on scope, alternatives, and risk. Some issues are closed as out-of-scope at this stage — that is a normal outcome, not a rejection of the contributor. Most are accepted with a refined scope.

3. **Write a spec** in `specs/` once the issue is accepted. Use the next sequential numeric prefix (zero-padded) and a lowercase-hyphenated slug, e.g. `specs/10-something-new.md`. The spec describes purpose, in-scope, out-of-scope, decisions made, alternatives considered, and acceptance criteria. Existing specs are the format reference.

4. **Maintainer reviews the spec.** Revisions may be requested. Treat the review as a design conversation; once the spec is approved it becomes the contract.

5. **Implement.** Open a PR that satisfies the spec's acceptance criteria. The PR description links to the spec and the originating issue. Self-review against the spec before requesting review from the maintainer.

6. **Update `CHANGELOG.md`, write an ADR if applicable, merge.** Add a one-line entry under `## [Unreleased]` in the appropriate subsection (Added / Changed / Fixed / Security / etc.). For decisions a future maintainer will ask "why did we…?" about, also add an ADR under `docs/decisions/`.

## Branching and PRs

Branch naming follows `<topic>/<short-slug>` (e.g. `hooks/add-claudemd-scanner`). ADR-only branches use `adr/<NNNN>-<slug>` (e.g. `adr/0007-placeholder-syntax`). Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) are encouraged for commit messages and PR titles but not gated by CI. PRs target `main`. Keep PRs focused — one logical change per PR makes review and revert tractable.

## CHANGELOG discipline

Every PR that touches `templates/`, `hooks/`, `scripts/`, `github-actions/`, `specs/`, `docs/methodology.md`, or `docs/philosophy.md` must update `## [Unreleased]` in `CHANGELOG.md`. The kit's own CI (`.github/workflows/changelog-check.yml`) enforces this. The format is one short bullet under the appropriate subsection, written in the imperative mood (e.g. `### Added` → `- Bootstrap script supports --dry-run flag (#42).`).

If the change is genuinely infrastructural and has no consumer-visible effect (e.g. a CI workflow polish that doesn't alter shipped artifacts), include `[skip-changelog]` in the PR title to bypass the check. This bypass is rare and gets reviewer scrutiny — when in doubt, write the changelog entry.

## ADRs (Architecture Decision Records)

Decisions worth preserving as history land in `docs/decisions/` as one Markdown file per decision. The lightweight ADR format is documented in [`docs/decisions/README.md`](docs/decisions/README.md), along with an example. Use ADRs for naming and license decisions, adding or removing a v1 component, changing a template format, public release timing, and any decision a future maintainer will ask "why did we…?" about. Bug fixes and small content tweaks do not need an ADR.

## Code of Conduct and Security

A `CODE_OF_CONDUCT.md` (Contributor Covenant) and `SECURITY.md` (vulnerability disclosure SLA) land at the v1.0.0 release per `specs/08-living-docs-and-decision-log.md` §5. Until then, please be kind and patient with one another, and report security issues by opening a GitHub issue with the `security` label rather than disclosing details publicly first.

## License

By contributing, you agree that your contribution is licensed under the project's licenses per [`LICENSE`](LICENSE): MIT for code, CC0 1.0 for templates under `templates/`, and CC BY-SA 4.0 for narrative documentation. If you are contributing a substantial new file, please match its license to the surrounding directory.
