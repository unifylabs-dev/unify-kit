# Upgrading unify-kit

> Manual upgrade guide. Companion to [`CHANGELOG.md`](CHANGELOG.md): the
> changelog says **what changed**; this file says **what to DO when something
> changed**.

The kit ships three classes of artifact, each with its own upgrade mechanism.
Read [§Overview](#overview) for the taxonomy, then jump to the section that
matches the artifact class you're updating.

---

## Overview

The kit's artifacts fall into three classes per
[`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md)
§4:

| Class | Examples | Update mechanism |
| --- | --- | --- |
| **Drop-in** | `hooks/*.sh`, `scripts/*.sh`, `github-actions/*.yml`, `~/.claude/settings.json` entries | Re-run [`scripts/bootstrap-claude-config.sh`](scripts/bootstrap-claude-config.sh) after `git pull`. Manifest + SHA-256 detects tampered files; `--force` restores kit content. |
| **Fork-and-customize** | `templates/core/*.md.template`, `templates/snippets/<stack>/*`, `templates/core/issue-templates/*`, `templates/core/specs/*` | Re-run [`scripts/init-project.sh`](scripts/init-project.sh) with `--dry-run`; classify each diverged file; merge by hand OR `--force` (with auto-backup) OR `--skip <basename>`. |
| **Reference** | [`docs/philosophy.md`](docs/philosophy.md), [`docs/methodology.md`](docs/methodology.md), [`docs/decisions/`](docs/decisions/), the 14 specs under [`specs/`](specs/) | Cite by URL (auto-fetches latest) OR snapshot into `<consumer>/CLAUDE.md` (frozen at snapshot time). Kit updates don't auto-propagate. |

If you're not sure which class an artifact falls into, check the relevant
spec's frontmatter or grep [`templates/README.md`](templates/README.md) for
the basename.

---

## Drop-in artifacts

Drop-in artifacts are mechanically replaceable: their content is kit-authoritative
(no consumer customization expected), so the upgrade flow is "re-run the
installer; let the manifest figure out what changed."

### Hooks + audit-scan (`~/.claude/` install)

`scripts/bootstrap-claude-config.sh` writes a manifest at
`~/.claude/.unify-kit-manifest.json` recording per-file SHA-256s for every kit
hook it installs. Re-running the script compares the live SHA-256s to the
manifest's recorded values + the kit's current source.

```bash
cd /path/to/unify-kit
git pull
scripts/bootstrap-claude-config.sh --dry-run    # preview changes
scripts/bootstrap-claude-config.sh              # apply (with auto-backup)
```

What you'll see:

- `no changes needed` — your install matches both the manifest AND the kit's current source. Nothing to do.
- `update: <file>` — kit shipped a new version. The script overwrites in place + writes a `.bak.<UTC-timestamp>` backup of your old version.
- `tampered: <file>` — the live file diverges from the manifest's recorded SHA-256 (you edited it locally). Re-run with `--force` to overwrite + backup.

### Consumer GitHub Action (`<your-project>/.github/workflows/`)

The kit ships a single comment-triggered review workflow at
`github-actions/claude-code-review.yml` + its prompt at
`github-actions/prompts/code-review.md`. Updates are manual `cp` because the
workflow lands in your project's repo, not in `~/.claude/`:

```bash
cp /path/to/unify-kit/github-actions/claude-code-review.yml \
   .github/workflows/claude-code-review.yml
cp /path/to/unify-kit/github-actions/prompts/code-review.md \
   .github/workflows/prompts/code-review.md
git add -A && git commit -m "chore: sync kit GH Action to v<X.Y.Z>"
```

Diff against the previous version with `git diff HEAD~1 .github/workflows/`
before committing if you've made local edits to the workflow.

---

## Fork-and-customize artifacts

Fork-and-customize artifacts are the kit's templates: the kit ships a skeleton
with `{{...}}` placeholders, you fill them in once at project init, and
thereafter the file is yours to edit. The kit's source-of-truth template can
still evolve, but propagating those changes is consumer-side judgment.

### Re-running init-project.sh

`scripts/init-project.sh` writes a manifest at
`<your-project>/.unify-kit-project-manifest.json` recording per-file SHA-256s,
install timestamps, and the kit version. Re-running compares the live
SHA-256s to the manifest's recorded values and the kit's current template
content.

```bash
cd /path/to/unify-kit
git pull
scripts/init-project.sh /path/to/your-project --dry-run \
  --config /path/to/init-project-config.yml
```

The dry-run output classifies every planned write:

- `up-to-date` — the live file matches the manifest's SHA-256 AND the kit's current template renders identically. Nothing to do.
- `would create` — the file doesn't exist in your project. The live run would install it.
- `would backup + overwrite` — the live file matches the manifest's SHA-256 (you haven't touched it since install) AND the kit's template has changed. Safe to overwrite with auto-backup.
- `WARNING: target exists with different content` — the live file diverges from the manifest's SHA-256 (you customized it). The script won't overwrite without `--force`. Decide: skip / merge / force.

### Classification matrix

For each `WARNING:` line:

| Decision | Action |
| --- | --- |
| **Keep yours unchanged** | Add the basename to `--skip` (comma-separated or repeated `--skip` flags). Re-run with the skip list. |
| **Merge by hand** | Read both files (`cat templates/<name>` and `cat <your-project>/<name>`). Integrate the kit's new content into your version. Add to `--skip` once merged so future re-runs don't flag it. |
| **Install fresh, discard your edits** | Pass `--force`. The script writes a `.bak.<UTC-timestamp>` backup of your file before overwriting. Restorable but requires explicit `cp` to undo. |
| **Leave alone** (no kit equivalent in your version) | Nothing to do. `init-project.sh` doesn't touch files outside its install map. |

### Worked example: v0.2.0 → v1.0.0 upgrade

The v1.0.0 release is backward-compatible: no breaking changes to existing
templates. `init-project.sh` debuts in v1.0.0 but is **opt-in** — projects that
were bootstrapped manually under v0.2.x don't have a manifest and can either
keep their manual install OR adopt the script-managed flow.

**Path A — your project was bootstrapped manually under v0.2.x** (no
`.unify-kit-project-manifest.json` in your project root):

```bash
cd /path/to/unify-kit
git pull && git checkout v1.0.0          # pin to a stable kit version

# Adopt init-project.sh's manifest-tracked flow:
scripts/init-project.sh /path/to/your-project --dry-run \
  --config /path/to/init-project-config.yml

# Every existing kit-shipped file will show "WARNING: target exists with
# different content" because there's no manifest to compare against.
# This is expected. Classify each per the matrix above.

scripts/init-project.sh /path/to/your-project \
  --config /path/to/init-project-config.yml \
  --skip cheatsheet.md.template,security-checklist.md   # example skip list
```

**Path B — your project has a manifest** (was bootstrapped under v1.0.0+ already):

```bash
cd /path/to/unify-kit
git pull && git checkout v1.1.0          # example future minor bump

scripts/init-project.sh /path/to/your-project --dry-run
# Manifest-based diff highlights only the templates the kit actually changed.
# Most lines will say "up-to-date"; review the rest.

scripts/init-project.sh /path/to/your-project   # apply
git add -A && git commit -m "chore: sync unify-kit to v1.1.0"
```

The manifest path is dramatically less noisy because the SHA-256 baseline
filters out untouched files.

### Hand-customized templates

If you've heavily edited a kit template (say, `templates/core/claude.md.template`
became your `<project>/CLAUDE.md` and you've added 200 lines of project-specific
sections), the upgrade flow is:

1. `--skip <basename>` on the live re-run so the kit doesn't touch your file.
2. Diff the kit's old template against the new one yourself:

   ```bash
   git -C /path/to/unify-kit diff v0.2.0..v1.0.0 -- templates/core/claude.md.template
   ```

3. Decide which of the kit's changes to port into your version. Merge by hand.

There is no automated diff-merge in v1.0.0. An automated path is tracked in
[`BACKLOG.md`](BACKLOG.md) as `update-from-upstream.sh` (v1.1+).

---

## Reference artifacts

Reference artifacts are the kit's authored docs: `docs/philosophy.md`,
`docs/methodology.md`, the [`docs/decisions/`](docs/decisions/) ADR set, and
the 14 specs under [`specs/`](specs/). These are the kit's operational canon,
design rationale, and historical record. Consumers don't fork these — they
either cite or snapshot.

### Cite by URL (auto-fetches latest)

In your `<consumer>/CLAUDE.md`, reference the kit's docs by URL:

```markdown
The methodology canon §A–J lives at:
https://github.com/unifylabs-dev/unify-kit/blob/main/docs/methodology.md

The philosophy lives at:
https://github.com/unifylabs-dev/unify-kit/blob/main/docs/philosophy.md
```

**Pro**: always-current. New kit minor versions propagate automatically.

**Con**: the URL changes if you pin to a tag (`/blob/v1.0.0/...`). If the
kit's branch organization changes (it won't, but theoretically), the URL
breaks.

### Snapshot into `<consumer>/CLAUDE.md`

For teams that want a frozen reference:

```bash
cd /path/to/your-project
mkdir -p docs/external/
curl -sL https://raw.githubusercontent.com/unifylabs-dev/unify-kit/v1.0.0/docs/methodology.md \
  > docs/external/methodology.md
```

Then reference `docs/external/methodology.md` from your `CLAUDE.md` instead of
the URL.

**Pro**: frozen. The kit can ship breaking changes to methodology canon
without affecting your team's day-to-day reference.

**Con**: stale-by-design. You must manually re-snapshot to pick up improvements.

### When kit reference docs change

`docs/methodology.md` and `docs/philosophy.md` evolve under the
"living document" principle (per `docs/methodology.md` §G). Watch
[CHANGELOG.md](CHANGELOG.md) `### Changed` entries for the rare prose
revisions, and decide per-revision whether to update your URL pin or
re-snapshot.

---

## When to re-run init-project.sh

Use `init-project.sh --dry-run` whenever:

- You've pulled a new kit minor version (e.g., v1.0.0 → v1.1.0). Most minor releases ship template changes that flow through.
- A spec you care about has been updated. Check [`specs/README.md`](specs/README.md)'s Status column for the version label.
- You added a new template or snippet to your config (e.g., switched `--snippets=none` → `--snippets=nextjs`).
- You suspect drift — your manifest claims SHA `abc...` but your file looks different. Re-run dry-run to confirm + reconcile.

Skip the re-run when:

- The kit version bump is a patch release (`v1.0.0` → `v1.0.1`) AND CHANGELOG `[1.0.1] ### Fixed` doesn't touch any template you installed.
- The kit version bump touches only docs / specs / hooks / scripts / GH Actions (none of which `init-project.sh` writes — those are drop-in artifacts).

---

## Breaking changes policy

unify-kit follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **Patch** (v1.0.x → v1.0.x+1): bug fixes only. No template content changes that affect downstream behavior. Always safe to upgrade.
- **Minor** (v1.x → v1.x+1): backward-compatible additions. New templates, new placeholders, new flags, new optional config. Existing templates may gain non-breaking sections. Always safe to upgrade; `init-project.sh --dry-run` shows what's new.
- **Major** (v1.x → v2.0): breaking changes. Removed templates, removed placeholders, renamed flags, changed default behavior. Every major release requires a new top-level UPGRADING section here with a migration recipe AND an ADR under [`docs/decisions/`](docs/decisions/) explaining the break + cost-benefit.

The current v1.x line will not introduce breaking changes. If you're reading
this in a future v2.0+ release, expect a `## v2.0 migration` section above
this one.

---

## Future automation

A manual upgrade flow has friction. The kit explicitly deferred automation
to v1.1+ per `specs/08-living-docs-and-decision-log.md` §4. Tracked work:

- **`scripts/update-from-upstream.sh`** — automated "pull new kit version → re-run bootstrap + init-project → diff against current install → present per-file accept/reject" flow. Tracked in [`BACKLOG.md`](BACKLOG.md). Depends on the manifest format stabilizing across multiple consumers.

Until that ships, the dry-run + `--skip` + `--force` triad documented above is
the canonical upgrade flow.

---

## Reporting upgrade friction

Hit a snag the docs above don't cover? Open an issue using the bug-report
template at
[`unifylabs-dev/unify-kit/issues/new/choose`](https://github.com/unifylabs-dev/unify-kit/issues/new/choose).
Include your previous kit version, the version you're upgrading to, and the
specific file or command that surfaced friction. Upgrade-flow refinements are
high-priority for v1.1.
