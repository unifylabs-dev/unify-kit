<!--
templates/snippets/nextjs/semantic-release.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern derived from `unify-rolfing-app/.github/workflows/release.yml` —
semantic-release on push to main, husky commitlint pre-commit hook, and
the Vercel `ignoreCommand` that prevents the release-commit from
triggering a deploy loop.
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Semantic-release on Next.js / Vercel

`semantic-release` automates versioning + tagging + GitHub release notes
from Conventional Commits. The pieces that matter in a Next.js + Vercel
project are: (1) the release workflow, (2) the commit-message lint gate,
and (3) preventing the release commit from triggering another deploy.

## 1. The release workflow

```yaml
# .github/workflows/release.yml
name: release

on:
  push:
    branches: [main]

permissions:
  contents: write       # tag + push
  issues: write         # comment on closed issues
  pull-requests: write  # comment on merged PRs

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0      # semantic-release needs full history
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The `fetch-depth: 0` is non-negotiable — semantic-release reads tags to
compute the next version.

## 2. `.releaserc.json`

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
    }],
    "@semantic-release/github"
  ]
}
```

The `[skip ci]` in the commit message tells GitHub Actions to skip the
release-commit; otherwise the new commit triggers `release.yml` again,
which finds no new commits and exits — wasted CI time, no loop, but noisy.

## 3. Commit-message lint (husky + commitlint)

semantic-release only works if the team writes Conventional Commits. Gate
this with a husky pre-commit hook calling commitlint.

```bash
npm i -D husky @commitlint/cli @commitlint/config-conventional
npx husky init
```

```js
// commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

`feat:` → minor bump. `fix:` → patch bump. `feat!:` or `BREAKING CHANGE:`
in the footer → major bump. `chore:` / `docs:` / `refactor:` / `test:` → no
release.

## 4. Vercel ignoreCommand (prevent release-loop deploys)

The release commit lands on `main` → Vercel deploys it → no behavior change,
but you've paid a build minute and produced a deploy entry. Skip it:

```json
{
  "ignoreCommand": "git log -1 --pretty=%B | grep -qE '^chore\\(release\\)' && exit 0 || exit 1"
}
```

Vercel runs `ignoreCommand` per push; exit 0 = skip build, exit 1 =
proceed. The grep matches the `chore(release): X.Y.Z` prefix produced by
`@semantic-release/git`.

## 5. CHANGELOG.md ownership

semantic-release writes `CHANGELOG.md` automatically. Don't hand-edit it;
your edits will be overwritten on the next release. If you need a
human-flavored release note, write it into the PR body — semantic-release
uses the PR body verbatim in the release notes generator.

## Common pitfalls

- **No tags in the repo on first run**: semantic-release starts at v1.0.0.
  If you want to start at v0.1.0, tag `v0.0.0` manually before the first
  release run.
- **Forgetting `persist-credentials: false`**: the default GITHUB_TOKEN
  has push rights but the checkout action's cached credential confuses
  semantic-release's git plugin. Explicit `false` + the explicit `env:
  GITHUB_TOKEN` resolves it.
- **`[skip ci]` not honored**: GitHub Actions honors `[skip ci]` in the
  HEAD commit message only when the workflow trigger is `push`. If you
  also have a `workflow_run` trigger reacting to the push, that one fires
  regardless. Audit your other workflows for this.
- **Release on branches other than main**: add `branches: ["main", "next"]`
  for a release-candidate channel; semantic-release supports the
  pre-release flow natively.
