# Spec 08 — Living Docs, Decision Log, Upgrade Flow, Public-Readiness

> Status: Implemented in v0.2.x
> Depends on: 00 (versioning + scrubbing decision), 01 (filename canon), 09 (kit's own CI enforces CHANGELOG discipline)
> Related: every other spec (this one defines how the kit evolves)

## Purpose

Specify the meta-process: how the kit evolves over time. CHANGELOG, ADRs, living-
doc rules, public release process, upgrade-flow contract for consumers, and the
public-readiness scrub gates.

---

## 1. `CHANGELOG.md`

Standard "Keep a Changelog" format, semver versioning.

**Sections per release:**

- `### Added` — net-new capabilities
- `### Changed` — behavior changes (non-breaking)
- `### Deprecated` — features marked for removal
- `### Removed` — features actually removed
- `### Fixed` — bug fixes
- `### Security` — security-relevant changes

**Version-bump rules:**

- **MAJOR** — breaking changes to template formats, hook contracts, or script flags
- **MINOR** — new templates / hooks / scripts / workflows / specs
- **PATCH** — fixes, doc updates, content tweaks within existing components

**Cadence: per-PR `[Unreleased]` flow.** Every PR that touches a kit artifact
updates the `## [Unreleased]` section in `CHANGELOG.md`. On release, the
`[Unreleased]` section gets renamed to the version + date. Spec 09's
`changelog-check.yml` workflow enforces this — it fails any PR that touches
`templates/`, `hooks/`, `scripts/`, `github-actions/`, `specs/`, or
`docs/methodology.md` / `docs/philosophy.md` without updating `[Unreleased]`.

---

## 2. `docs/decisions/` — Architecture Decision Records (ADRs)

**Format: lightweight ADR.** One file per decision, one decision per file.

```markdown
# 0001 — <Decision title>

- Status: accepted | superseded | deprecated
- Date: 2026-05-04
- Decision: <one paragraph stating what was decided>
- Context: <what motivated this>
- Consequences: <what changes because of this>
- Alternatives considered: <bullets>
- Supersedes / superseded by: <link if applicable>
```

**When to write an ADR:**

- Naming or license decisions
- Adding/removing a v1 component
- Changing template format (e.g., switching placeholder syntax)
- Public release timing or scope
- Style rewrites of `verbatim`-mode lifts (per spec 03)
- Any decision a future maintainer will ask "why did we…?" about

**When *not* to write an ADR:**

- Bug fixes
- Content tweaks within existing components
- Bumping plugin/dependency versions

**ADR index:** `docs/decisions/README.md` lists every ADR with title, date, status.
ADRs are immutable history; superseded ones get marked as such, never deleted.

---

## 3. Living-doc rules (the kit's own)

The same discipline encoded in `templates/claude.md.template` applies to *this*
repo:

- **`README.md`** — update when project status changes (specs phase →
  implementation phase → first release)
- **`CHANGELOG.md`** — update on every PR that touches kit artifacts; never skip
- **Each spec** — once approved, treat as historical record; mutate only via
  inline revisions referenced from the Revisions footer. New decisions get new
  specs or ADRs.
- **`docs/philosophy.md`** — update only on a major version bump (these are stable
  principles)
- **`docs/methodology.md`** — update when actual practice changes; cite the
  change in CHANGELOG
- **`templates/claude.md.template`** — update when we discover patterns worth
  encoding broadly

**Ground rule:** if a doc and the implementation disagree, the implementation wins
*and the doc becomes a bug to fix*.

---

## 4. Upgrade-flow contract (how consumers pull future versions)

The kit's value compounds across versions. Consumers who adopted v0.2 should be
able to pull v0.3 of the hooks without losing their CLAUDE.md customizations.

**Artifact taxonomy:**

| Artifact class | Update mechanism |
|---|---|
| **Drop-in** (hooks, scripts, GH Actions) | Re-run `bootstrap-claude-config.sh`. Backups created automatically. Idempotent. |
| **Fork-and-customize** (templates) | Consumer keeps their filled-in copy. The kit publishes diffs in CHANGELOG. Consumer applies diffs manually. |
| **Reference** (`docs/philosophy.md`, `docs/methodology.md`) | Consumer's `<consumer>/CLAUDE.md` cites these by URL or includes a snapshot — kit updates don't auto-propagate. |

**Version advertisement:** every release tags `vX.Y.Z` in git, with CHANGELOG
entry, with release notes summarizing breaking vs. additive changes.

**Customization detection:** the bootstrap script (spec 05) writes a manifest at
`~/.claude/.unify-kit-manifest.json` recording which kit artifacts were installed
at which version with what SHA-256. On re-run, if a consumer's installed file no
longer matches the recorded SHA (i.e., they edited it), the script prompts before
overwriting (or skips with `--force` documented as overwrite-anyway).

**`update-from-upstream.sh` is deferred to v1.1+.** v1's upgrade story is "re-run
the bootstrap script after pulling the new kit version." The manifest enables that
to work safely. v1.1's `update-from-upstream.sh` automates the pull + bootstrap
loop and adds a "diff against current kit version" report.

**No auto-merging of customized files in v1.** If a consumer customized a kit
artifact, the upgrade is manual. v1 prioritizes safety over automation.

---

## 5. Public-readiness scrub gates

The v1 kit ships scrubbed for public adoption (per spec 00). v1.0.0 release is
gated on the scrub being complete. Spec 09's `scrub-check.yml` workflow enforces
the gates continuously; this section codifies the human-verifiable additions.

**Required at v1.0.0 release:**

- [ ] `LICENSE` file at root, naming MIT (default) per spec 00
- [ ] All shipped artifacts (`templates/`, `hooks/`, `scripts/` excluding test
      fixtures, `github-actions/`, `docs/philosophy.md`, `docs/methodology.md`,
      `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `llms.txt`) pass
      `scrub-check.yml`. Specs, audit docs, ADRs, and test fixtures are exempt
      from the scrub — they describe forbidden patterns as documentation (per
      spec 09).
- [ ] `CONTRIBUTING.md` exists and describes the spec-first contribution flow
      (see §6)
- [ ] `CODE_OF_CONDUCT.md` exists (Contributor Covenant or equivalent)
- [ ] `SECURITY.md` exists describing vulnerability disclosure (where to report,
      response SLA)
- [ ] Issue templates exist in `.github/ISSUE_TEMPLATE/` (bug, feature, ADR
      proposal)
- [ ] PR template exists in `.github/PULL_REQUEST_TEMPLATE.md` referencing the
      changelog-discipline rule
- [ ] All ADRs status-marked `accepted`, `superseded`, or `deprecated` (no
      `proposed` or empty status)
- [ ] All specs have a `Revisions` footer (or "no revisions yet" placeholder)
- [ ] Public-facing GitHub repo description and topics tagged

**`scrub-check.yml` patterns** (the canonical forbidden-strings list, also cited
by spec 09):

```
optics-management
optics_boutique
mvo_
Mint Vision
mintvisionsoptique
Mvo$Staff
aws-1-ca-central-1.pooler.supabase.com
postgresql?://[a-z]+:        (anchored DB URL with inline credentials)
sk-ant-                       (Anthropic API key prefix)
AKIA[0-9A-Z]{16}              (AWS access key pattern)
```

Hits in any file outside `docs/audit/` fail the scrub gate.

---

## 6. Contribution flow (`CONTRIBUTING.md`)

**Spec-first.** The flow that produced v1 is the contribution flow:

1. Open an issue describing the proposed change.
2. Discuss; may be closed as out-of-scope.
3. If accepted, write a spec in `specs/` (numbered next sequential).
4. Maintainer reviews spec; may request revisions.
5. Once spec is approved, implement; PR closes by satisfying spec acceptance
   criteria.
6. Update `CHANGELOG.md` `[Unreleased]`, write ADR if applicable, merge.

This pattern is **the same** whether the contribution is from the author, the
team, or a public OSS contributor.

---

## 7. Public release process

### v0.x — Internal use

- Repo can be public (no secrets) but not advertised
- Used by the author's projects + team
- Spec churn allowed; ADRs are aspirational

### v0.x → v1.0.0 trigger (single condition)

Release v1.0.0 when **all v1 specs are implemented and the kit has been used to
bootstrap one new project end-to-end successfully.** That is the only gate.

The previous 5-condition trigger (day-30 retro completed, no critical changes for
30 days, etc.) has been collapsed — those were ceremony. Real-world successful
bootstrap is the one falsifiable signal.

### v1.0.0 release

- Tag the commit, push the tag
- Update README to remove "pre-development" status
- CHANGELOG `[Unreleased]` → `[1.0.0] — <date>` rename
- Pass the public-readiness scrub gates (§5)
- (Optional, audience-tier-dependent) submit to relevant aggregators

### Post-v1

- Follow semver
- ADRs for anything non-trivial
- Each new project that adopts the kit posts a "what worked / what didn't" issue
  — source material for next release

---

## Decisions needed

All meta-process decisions resolved as defaults:

| # | Decision | Resolution |
|---|---|---|
| 1 | ADR format | Lightweight per the template above. |
| 2 | CHANGELOG cadence | Per-PR `[Unreleased]` flow, enforced by spec 09's `changelog-check.yml`. |
| 3 | Public release timing | v1 specs implemented + one project bootstrapped. No soak window. |
| 4 | Aggregator submission on v1.0.0 | Optional; kit author's call at release time. Not gated. |
| 5 | (removed) | (Was "ADRs forever?" — that's the definition of an ADR, not a decision.) |

## Out of scope

- A formal RFC process. Specs in `specs/` are our RFC equivalent.
- A governance model. The kit is single-author for v1; revisit at v2.
- Multi-project upgrade orchestration tooling. Each consumer manages their own
  upgrades.

## Acceptance criteria

- `CHANGELOG.md` exists at root with a `[Unreleased]` section ready for the first
  implementation PRs.
- `docs/decisions/README.md` exists with the lightweight ADR format documented and
  an empty index.
- `CONTRIBUTING.md` describes the spec-first flow per §6.
- The bootstrap manifest (`~/.claude/.unify-kit-manifest.json`) format is specified
  in spec 05 and referenced from §4 here.
- Spec 09's `scrub-check.yml` enforces the forbidden-strings list in §5.
- Spec 09's `changelog-check.yml` enforces the per-PR `[Unreleased]` rule in §1.
- The public-readiness checklist in §5 is testable via a single CI workflow run
  before v1.0.0 tagging.

## Revisions

Addressed: R-003 (audience-tier references replaced with the binary scrubbed-or-not
decision from spec 00; §5 is now the canonical scrub list and gate), R-035 (ADR
format / CHANGELOG cadence alternatives cut; decision #5 "ADRs forever" cut as
definitional), R-036 (aggregator submission depends on the binary scrub decision —
cleaned up), R-037 (v1.0.0 trigger reduced to one condition: specs implemented +
one bootstrap successful), R-038 (CHANGELOG enforcement explicitly delegated to
spec 09's `changelog-check.yml`), R-041 (upgrade-flow contract sketched in §4 with
artifact taxonomy + manifest mechanism), R-042 (public-readiness checklist + scrub
gates added as §5; CONTRIBUTING flow as §6).
