# Issue body templates — Phase 6 construction guide

This file describes how Phase 6 assembles the final issue body. The actual content comes from accumulated brainstorm + impact map + clarifications + draft spec; this guide just describes the structural shape.

The skill's goal: produce an issue body that satisfies the target repo's issue template AND is parseable by `/work-issue` Phase 0. Both depend on consistent section headers and well-formed field values.

---

## Universal sections (every issue body)

Order matters — `/work-issue` Phase 0 reads these in order.

### `## Description`

2–3 sentences. The problem this feature solves. **Why** it matters. Not the implementation approach.

### `## Acceptance Criteria`

Checkbox list. If both behavioral and visual ACs exist, split into subsections:

```markdown
### Behavioral
- [ ] User can do X
- [ ] System validates Y
- [ ] Error is shown when Z

### Visual Fidelity
- [ ] Layout matches the prototype's grid structure
- [ ] Cards use `bg-white rounded-xl border border-gray-100 shadow-sm`
- [ ] Empty state renders the prototype's empty-state card
```

**Rules:**
- One AC per checkbox. ACs are testable statements.
- Avoid implementation language ("use bcrypt for the hash") — that's a design note, not an AC.
- Behavioral ACs are about observable behavior; visual ACs are about appearance and interaction states.

### `## Spec sections affected`

This is the field `/work-issue` Phase 0 parses. Format:

```markdown
- docs/specs/modules/<name>.md
    § Behavior: add rule "When isDualInvoice = true, …"
    § Edge Cases: add rule for null lensType handling
- docs/specs/journeys/<slug>.md
    § Steps: add step 6 "Given QC fails, When optician marks failed, Then …"
- NEW: docs/specs/modules/<new-name>.md (bootstrap on first touch)
```

**Conventions:**
- One bullet per spec file affected
- Indented `§ <section>: <change summary>` lines under each spec — these are the deltas
- `NEW:` sentinel for spec files that don't exist yet — `/work-issue` Phase 0 will bootstrap them
- `None — fixing drift from spec` for pure drift fixes
- `None — no behavior change` for pure docs/config/typo issues
- Always use forward slashes; never quote paths

### `## Design Notes`

Free-form. Anything non-obvious surfaced in research or clarifications:
- Library version constraints (e.g. "requires Prisma 7 transaction syntax")
- Compliance trade-offs (e.g. "PHIPA s.12 requires audit even for bulk deletes")
- UX precedent decisions (e.g. "matches Stripe's payment-method-attached pattern")
- Performance considerations
- Alternatives considered and why they were rejected

### `## Research notes`

The grounded research from Phase 2. Format:

```markdown
**Library docs (context7):**
- `prisma@7.x` — transaction syntax with adapter-pg ([source](https://prisma.io/docs/...) — checked 2026-05-13)

**Industry standards:**
- OWASP Authentication Cheat Sheet — password complexity ([source](https://cheatsheetseries.owasp.org/...) — checked 2026-05-13)
- NIST 800-63B — session timeout guidance ([source](https://pages.nist.gov/...) — checked 2026-05-13)

**Compliance:**
- PHIPA s.12 — audit requirements for destruction events (per `compliance-research` skill, profile `healthcare-phipa`)

**Prior art:**
- `unify-rolfing-app` implements similar magic-link auth — see `src/lib/client-auth.ts`
- `optics-management` had a similar feature in PR #234

**Memory hits:**
- User feedback (2026-04): integration tests must hit real DB, not mocks
```

This section is what gives reviewers (and future Claude sessions) traceable grounding. Without it, the spec is "trust me".

### `## Doc updates for the same PR`

`/work-issue` Phase 7 checks for these in the final PR diff. List target-repo guide docs that should be updated:

```markdown
- `docs/methodology.md` — note new rate-limit convention under §"Public endpoints"
- `CHANGELOG.md` — entry under `[Unreleased]`
- `docs/SECURITY.md` — reference new audit action enum value
```

`/work-issue` Phase 7's spec-discipline check will flag if the PR diff doesn't include these.

### `## Kit impact`

Only present if Phase 5 fired. Either a link (when propagation was filed as a separate issue/PR) or a short note (when deferred).

```markdown
- Linked: unifylabs-dev/unify-kit#42 — proposes new env-var snippet
```

OR

```markdown
- Note: This feature introduces a new `OBSERVABILITY_*` env-var category not in current kit templates. Deferred to future kit update.
```

### `## Priority`

From clarifications. Single value: `Low | Medium | High | Critical`.

### `## Proposed Spec Draft` (collapsed)

The full draft spec content embedded in a `<details>` block:

```markdown
<details>
<summary>📄 Proposed Spec Draft — &lt;target spec path&gt;</summary>

```markdown
<!-- The full spec content, ready for /work-issue Phase 0 to write to disk as the first commit. -->
---
name: ...
type: module
last_reviewed: 2026-05-13
...
---

# <Module Name>

## Purpose
...
```

</details>
```

**Why embedded:** specs ship in the same PR as code. The issue body carries the draft; `/work-issue` Phase 0 reads it and writes the file as the first commit on the work branch. This avoids two PRs per feature and keeps the spec attached to the code that implements it.

**Format constraints:**
- Use a `<details>` block so it doesn't clutter the issue view
- Use a fenced code block (` ``` `) inside the details so markdown renders the spec as-is, including its frontmatter
- The summary text MUST include the target path so `/work-issue` Phase 0 can extract it deterministically

---

## Type-specific sections

### feature

Add no extra sections beyond the universal set. Type-specific labels: `enhancement`, optionally `spec-it-authored`.

### fix

Add:

```markdown
### Reproduction Steps
1. <step>
2. <step>
3. <observed bad behavior>

### Expected Behavior
<what should happen instead>
```

Labels: `bug`, optionally `spec-it-authored`. If it's a drift fix (no behavior change, just code realigning with the spec), include in `## Spec sections affected`:

```markdown
None — fixing drift from spec.
Verifying spec still accurate: docs/specs/modules/<name>.md
```

### process / docs (non-code)

Replace `## Acceptance Criteria` content with doc-shaped ACs:

```markdown
- [ ] `docs/methodology.md` updated under section §"<X>"
- [ ] `CHANGELOG.md` entry added under `[Unreleased]`
- [ ] Cross-reference added to `docs/<other>.md`
```

Labels: `documentation` (or `process` if the repo has that label), optionally `spec-it-authored`.

**No code changes expected.** `/work-issue` Phase 4 (TDD) is skipped for non-code issues — Phase 4 becomes "apply doc edits + verify they render correctly". The PR diff shows only doc files.

---

## Issue title format

Generic shape: `<type>: <short description>`

Examples:
- `feat: add bulk customer merge with audit trail`
- `fix: prevent duplicate session creation under concurrent login`
- `docs: methodology — require iterative-review on doc-only PRs`
- `chore: bump Prisma to 7.2 + adapter-pg`

**Constraints:**
- Title under 70 characters (GitHub truncates in many views)
- Lowercase after the colon (conventional-commits style)
- Imperative mood ("add", "fix", not "added", "fixes")

---

## Cross-reference format (decomposition)

When Phase 4 splits an issue:

**Child issue body — first line:**
```markdown
> Parent: #<P> — <parent title>
> Siblings: #<M>, #<O>
```

**Parent issue body — Acceptance Criteria:**
```markdown
## Acceptance Criteria
- [ ] #<M> completes — <child title>
- [ ] #<O> completes — <child title>
- [ ] #<P-or-other> completes — <child title>
```

The parent is a tracking issue; its ACs are "child issue X is done". This pattern lets `gh issue close <parent>` auto-close when all children close.

---

## Labels — what to apply

Phase 9 infers labels from clarifications and applies them via `--label`:

| Source | Labels |
|---|---|
| Type = feature | `enhancement` |
| Type = fix | `bug` |
| Type = chore | `chore` |
| Type = refactor | `refactor` |
| Type = process or docs | `documentation` |
| Priority = High or Critical | `priority:high` or `priority:critical` (if repo uses priority labels) |
| Compliance touch | `compliance` (if repo uses it) |
| Has Visual Fidelity ACs + prototype branch reference | `visual-fidelity` |
| All `/spec-it`-authored | `spec-it-authored` |

If a label doesn't exist in the target repo, the skill prints a warning but doesn't fail — the gh command's `--label` flag silently ignores unknown labels by default unless `gh` is configured otherwise.

---

## Validation before posting (Phase 10 anchor)

Before Phase 10's `gh issue view` verification, the local draft already contains:
- Title (under 70 chars)
- All universal sections in order
- Type-specific sections present
- Spec impact field formatted in `/work-issue`-parseable shape
- Embedded spec draft in `<details>` with the target path in the summary

If any of these are missing, Phase 7's `iterative-review` should have caught them. Phase 10 verifies they survived gh CLI submission (which can mangle nested markdown — particularly nested code fences inside `<details>` blocks).
