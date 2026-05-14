---
name: spec-it
description: >
  Turns a raw feature idea into a `/work-issue`-ready GitHub issue with an embedded
  draft spec, grounded in repo + memory + external standards research. Mirrors
  `/work-issue`'s gated phased workflow but UPSTREAM of it — `/spec-it` produces
  the issue, `/work-issue` implements it. Adapts to whatever spec conventions the
  target repo defines (optics-style behavioral modules+journeys, unify-kit-style
  numbered specs, ADR-style decision records, or none → bootstrap from kit
  templates). Use when the user says "/spec-it <one-liner>", "/spec-it" with no
  args, "draft a spec for ...", "turn this idea into an issue", "I want to add
  <feature>", "create an issue for this", or otherwise wants to start a new
  feature/fix/process change from scratch. Also use proactively whenever the user
  describes a not-yet-tracked feature idea before `/work-issue` would have an
  issue number to consume. Strongly prefer this over filing an issue manually —
  it grounds the spec in research and enforces the project's spec discipline.
tags: [spec, issue, sdd, brainstorm, planning, front-door, work-issue]
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Agent
  - EnterPlanMode
  - ExitPlanMode
  - WebSearch
  - Skill
---

# /spec-it — Idea → spec + GitHub issue (front-door to /work-issue)

Take a raw feature idea and turn it into a properly-shaped GitHub issue with an embedded draft spec, ready for `/work-issue <N>` to implement. The skill is **generic across projects** — it reads each target repo's conventions at runtime and adapts. `unify-kit` is the canonical source of spec/template conventions; this skill ships in the `unifylabs-workflow` plugin and runs anywhere the plugin is installed.

**Invocation:**
- `/spec-it "<one-line idea>"` — start with a seed sentence
- `/spec-it` — start with no argument; first turn captures the idea
- `/spec-it --quick "<paragraph>"` — minimize the brainstorm dialog when the user already has a clear write-up

**What `/spec-it` produces:**
1. A draft spec in the target repo's spec format — embedded in the issue body so it ships with code in the eventual `/work-issue` PR (per the "specs ship in the same PR as code" rule). Exception: when invoked inside a repo that lands pre-implementation specs on master (e.g. unify-kit itself), the spec commits to a `spec/<slug>` branch + PR — see Phase 9.
2. A GitHub issue filled per the target repo's issue template — ACs in checkbox format, "Spec sections affected", scope, type, design notes, and any flagged unify-kit propagation note.
3. Optionally: a parallel unify-kit issue or PR when the feature introduces a generalizable pattern worth absorbing back into the kit.
4. A handoff line: `▶ Next: /work-issue <N>`.

**Both code and non-code deliverables are first-class.** A process/docs/methodology change becomes an issue with a spec and `/work-issue`-friendly ACs — Phase 4's TDD step is replaced with doc edits when there's no code to write.

---

## Workflow at a glance

| # | Phase | Gate? | Delegates to |
|---|---|---|---|
| 0 | Pre-flight & repo schema detection | implicit | — |
| 1 | Idea capture & brainstorm | yes | `superpowers:brainstorming` |
| 2 | Grounded research (repo + memory + external + prior art) | yes | Explore / context7 / WebSearch / `compliance-research` |
| 3 | Spec-shaping clarifications | yes | — |
| 4 | Decomposition check | yes | — |
| 5 | Convention-propagation check (unify-kit impact) | yes | — |
| 6 | Plan mode → draft spec + issue body | yes | `EnterPlanMode` |
| 7 | Iterative plan review | yes | `iterative-review` (doc mode) |
| 8 | User approval | yes | — |
| 9 | Execution (file issue(s), propagate if approved) | implicit | `gh` CLI |
| 10 | Deliverable verification | yes | `iterative-review` |
| 11 | Handoff (`/work-issue <N>` invocation) | terminal | — |

Each gate uses `AskUserQuestion`. The convention: option 1 = Continue (Recommended), 2–3 = phase-appropriate alternatives (revise / re-explore / refresh research), 4 = Abort with cleanup instructions. Never use plain text questions like "Continue?" — always use `AskUserQuestion`.

**Abort handling.** If the user says "stop" or "abort" at any phase, halt immediately and print:
```
⛔ Aborted at Phase <N>.
Run state saved to: <repo>/.claude/spec-it/<run-id>/
To resume later: /spec-it --resume <run-id>
To discard: rm -rf <repo>/.claude/spec-it/<run-id>/
```

---

## Phase 0 — Pre-flight & repo schema detection

**Why this matters.** `/spec-it` is generic, but the deliverable must match the target repo's conventions exactly — its issue templates, its spec format, its compliance posture. Phase 0 builds a `repo_schema` object that every subsequent phase consults instead of hardcoding optics or unify-kit assumptions.

### Steps

1. **Confirm git repo.** If not in a repo, abort with: `"/spec-it must run inside a git repository. cd to the target repo and re-invoke."`
2. **Read project conventions.** Try in order: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` at repo root. Extract: compliance posture, role hierarchy, audit rules, branch naming, route group conventions, anything that constrains the eventual spec.
3. **Detect spec layout.** Scan in priority order:
   - `docs/specs/modules/` + `docs/specs/journeys/` → `optics-style` (behavioral, dual-axis modules + journeys)
   - `specs/NN-*.md` (numbered) → `unify-kit-style` (structural, pre-implementation specs land on master)
   - `docs/adr/` or `docs/decisions/` → `adr-style` (one decision per file, lightweight)
   - none of the above → `none` — Phase 6 will offer to bootstrap from `assets/spec-templates/`
4. **Read every `_template.md` found.** Capture frontmatter fields (`name`, `type`, `last_reviewed`, `code_anchors`, etc.) and required sections (Purpose, Behavior, Permissions, etc.). The skill writes drafts that match these templates exactly so reviewers don't have to reformat.
5. **Read issue templates.** Scan `.github/ISSUE_TEMPLATE/*.yml` (or `*.md`). Capture each template's required fields (`label`, `id`, `validations.required`). The skill's issue body must populate every required field.
6. **Read methodology pointer.** Try `docs/methodology.md`, `docs/METHODOLOGY.md`, `METHODOLOGY.md`. If present, record the file path so Phase 5's propagation check can link to it.
7. **Build `repo_schema`.** A working dict the rest of the skill reads. Includes:
   - `spec_style` (one of: optics-style, unify-kit-style, adr-style, none)
   - `template_paths` (paths to each `_template.md`)
   - `issue_template_fields` (per-template required-field lists)
   - `methodology_pointer` (path or null)
   - `compliance_posture` (e.g. "PHIPA/PIPEDA, app-layer access control") if `CLAUDE.md` declares one
   - `related_skills` (which workflow skills are available: `/work-issue`, `/integrate-branch`, etc.)
   - `is_kit_repo` (true if the current repo IS `unifylabs-dev/unify-kit` itself — affects Phase 9 lifecycle)

**No gate.** Proceeds directly to Phase 1.

---

## Phase 1 — Idea capture & brainstorm

**Why.** The user typically has a one-liner. A spec needs purpose, success criteria, constraints, scope boundaries. Brainstorming bridges that gap with one-question-at-a-time refinement.

### Steps

1. **Capture initial input.**
   - `--quick "<paragraph>"`: store as-is, skip to step 3 with the paragraph as the brainstorm output
   - `"<one-liner>"`: store as the seed
   - no argument: ask the user for the seed via `AskUserQuestion` with a single open-ended free-text option
2. **Invoke `superpowers:brainstorming`** with the seed + `repo_schema` as context. Brainstorming runs its standard dialog (purpose / constraints / success criteria, one question per message). When brainstorming would normally hand off to `writing-plans`, **intercept** — `/spec-it` resumes the gated flow with brainstorming's output as the input to Phase 2.

   Intercept mechanism: before invoking brainstorming, set an env-flag or in-context note that the current parent skill is `/spec-it`. When brainstorming returns its summary, do NOT also call `writing-plans`; treat the summary as a structured object and proceed to Phase 2.

   *Fallback:* if `superpowers:brainstorming` is unavailable, run a focused inline dialog: 3–5 `AskUserQuestion` rounds covering purpose, success criteria, scope boundaries, and non-goals.

3. **Distill** the brainstorm into a structured `brainstorm_output`:
   - `title` (working title, ~7 words)
   - `purpose` (1–2 sentences)
   - `success_criteria` (3–5 testable statements)
   - `constraints` (technical or business)
   - `non_goals` (explicit out-of-scope items)

**Gate 1.** Present `brainstorm_output` for review.
- 1. Continue to Phase 2 (Recommended)
- 2. Refine the brainstorm — return to brainstorming with new prompts
- 3. Abort

---

## Phase 2 — Grounded research

**Why.** A spec is only as good as what it's grounded in. Without research, the skill produces plausible-sounding but unverified specs that get pushback at review time. Read `references/research-triggers.md` for the full trigger-by-trigger guide.

The skill does **not** run every research stream on every invocation — that's wasteful. It runs **trigger analysis** against `brainstorm_output` and invokes only the streams that fire. Cheap streams (memory check, repo scan) always run; expensive streams (WebSearch, deep context7 queries) only when their triggers match. **Always surface the stream list before running so the user can veto.**

### Streams

#### 2a. Repo research (always)
1. Map the feature to candidate specs using `repo_schema.spec_style`:
   - optics-style: which of the 18 modules + 15 journeys does this touch? Read the methodology doc's module + journey lists.
   - unify-kit-style: which numbered spec(s) — 00–09 + any new ones?
   - adr-style: is this a new decision or an update to an existing ADR?
   - none: skip (Phase 6 will bootstrap)
2. Read the candidate specs to confirm fit. Cross-reference the `code_anchors` frontmatter.
3. `git log --oneline --all -- <related-paths>` and `gh issue list --search "<keywords>"` to surface similar past features (PR links, prior issues).
4. Use the Explore agent if scope crosses 3+ files or the surface area is uncertain.

#### 2b. Memory check (always)
1. Read `~/.claude/projects/<project-slug>/memory/MEMORY.md` if present. The project-slug is the cwd path with `/` → `-`.
2. Match memory entries against `brainstorm_output` keywords. Surface feedback/project/reference memories (per memory-system types) that touch the feature area.
3. **Flag contradictions.** If a saved memory contradicts Phase 1's brainstorm (e.g. user said "use bcrypt" but memory says "team standardized on Argon2"), surface the conflict before proceeding.

#### 2c. Prior art in sibling repos (conditional — triggers when feature is generic and user has multiple `unify-*` repos)
1. `ls ~/Projects/ | grep -E "^unify-"` and `ls ~/ | grep -E "^unify-"` to find sibling repos.
2. If the feature name suggests cross-project applicability (client portal, magic link auth, intake form, settings UI, etc.), grep sibling repos for similar implementations. Use `Agent` (Explore) to keep the main context clean.
3. Treat hits as "prior art examples" — useful for cross-project consistency, not authoritative.

#### 2d. Library/framework docs via context7 (triggers: feature names a specific library, framework, SDK)
1. Use the `context7` MCP server: `resolve-library-id` → `query-docs` for the specific library and feature area.
2. **Prefer context7 over WebSearch for library docs** — training data may be stale (months behind). context7 is current.
3. Capture findings inline: library + version + key API/pattern + source.

#### 2e. Industry standards & best practices (triggers: security-sensitive, compliance-touching, novel UX, regulated domain)
Use `WebSearch` (and `context7` where applicable). Queries must be targeted, not exploratory:
- **Security-sensitive** (auth, secrets, payments, sessions, encryption, RBAC): OWASP cheat sheets, NIST guidelines, CVE for the libraries in use.
- **Compliance-touching** (PHIPA, PIPEDA, HIPAA, GDPR, PCI-DSS, CASL, SOC2): invoke the `compliance-research` skill if `repo_schema.compliance_posture` is absent or empty; otherwise spot-check current rules against `docs/compliance/` (regulations evolve; never rely on training data alone).
- **Novel UX patterns** (no obvious precedent in the repo): search for established UX conventions in the domain ("duplicate-record merge UX patterns CRM").
- **Performance / scaling** (caching strategies, pagination, infinite scroll, large datasets): current patterns for the specific stack.

**Capture format:** for each external query, record `{ source_url, date_checked, key_takeaway }`. These embed as a "Research notes" section in the spec/issue so reviewers can trace decisions.

#### 2f. Prototype / mockup awareness (triggers: visual feature signals — UI, dashboard, form, flow, modal)
1. `git branch -a | grep "prototype/"` — list existing prototype branches.
2. `gh issue list --label prototype --state all` — surface prototype-tagged issues.
3. **If overlap is plausible**, surface it: the right path may be `/extract-prototype-review <branch>` rather than `/spec-it`. Ask the user before continuing.

#### 2g. Synthesis — Impact map
Aggregate into a single artifact (write to `<repo>/.claude/spec-it/<run-id>/impact-map.md`):
- **Specs affected** — paths + the section of each spec impacted
- **Code anchors** — file paths to be touched, with one-line reasons
- **Similar past features** — PR links, issue numbers, brief description
- **Memory hits** — relevant prior decisions or user preferences
- **External findings** — URLs + dated takeaways
- **Prior art examples** — sibling repos
- **Research gaps** — what couldn't be answered; flagged for Phase 3 clarification

**Gate 2.** Present the impact map.
- 1. Continue to Phase 3 (Recommended)
- 2. Deeper research on a specific stream
- 3. Skip a stream that's pulling in noise
- 4. Abort

---

## Phase 3 — Spec-shaping clarifications

**Why.** Brainstorming captures the idea; research grounds it; but project-specific fields (compliance touch, role-required, env vars introduced, prototype branch reference, etc.) still need explicit answers. Asking for them once now is much cheaper than discovering gaps at `/work-issue` Phase 0.

### Approach

Run targeted `AskUserQuestion` rounds. **Only ask what's needed** — skip questions already answered by the brainstorm or impact map. Common fields:

- **Scope estimate** (S / M / L) — informs Phase 4's decomposition check
- **Type** (feature / fix / chore / refactor / process / docs) — drives the issue label and the eventual `/work-issue` branch prefix
- **Visual ACs needed?** — yes/no; if yes, ask about a prototype branch
- **Compliance touch** — multi-select against `repo_schema.compliance_posture`: PHI, PII, payment data, audit-impacting, retention-impacting, role-elevation
- **Role required** — VIEWER / STAFF / ADMIN / public / cron — sourced from `CLAUDE.md`'s role hierarchy
- **New env vars / public routes / cron schedules / notification types** — anything that adds a new project-level surface
- **Acceptance criteria** — auto-propose from brainstorm + impact map + clarifications; user edits in a single AskUserQuestion round

**Gate 3.** Present the full clarified field set.
- 1. Continue to Phase 4 (Recommended)
- 2. Revise specific fields
- 3. Re-run a research stream — go back to Phase 2 with new context
- 4. Abort

---

## Phase 4 — Decomposition check

**Why.** A feature that spans 4 modules and has 18 ACs is not one issue — it's a small project. Without decomposition, `/work-issue` Phase 3.5 will fire phasing inside it, and the user loses the granularity of independent PRs. Split now while the spec context is fresh.

### Heuristic (read `references/decomposition-heuristics.md` for full rules)

Propose a split if **any** of:
- Scope = L AND >2 modules with significant work each
- >12 candidate ACs
- "Cross-system" feature language in brainstorm output (e.g. "rebuild", "refactor X to support Y", "add Z across modules A and B")
- Acceptance criteria can be cleanly partitioned along orthogonal axes (data model / UI / API / integration)

### If split is warranted

Draft a decomposition:
- (1) `<title>` — focused scope, own ACs, own spec deltas
- (2) `<title>` — depends on (1)
- (3) `<title>` — depends on (1)
- Optional: a tracking "parent" issue that lists the children and provides a unified scope view

Cross-reference markdown: child issues link to parent via `Parent: #N`; parent lists children as a checkbox list.

**Gate 4.**
- 1. Keep as one issue (Recommended if heuristic doesn't fire)
- 1. Accept the proposed split (Recommended if heuristic fires)
- 2. Different split — user proposes the decomposition
- 3. Add a tracking parent issue
- 4. Abort

---

## Phase 5 — Convention-propagation check (unify-kit impact)

**Why.** `unify-kit` improves by absorbing patterns from real consumer use. A feature that introduces a new env-var category, hook pattern, methodology rule, or convention is more valuable to the team if it lands in the kit too — future projects benefit automatically. Skipping this check costs nothing now but loses the learning forever.

This check **always runs**, but it's lightweight and stays out by default. Read `references/propagation-heuristics.md` for the full trigger list.

### Triggers

Propose unify-kit propagation if **any**:
- New env-var category not present in current `.env.example` patterns
- New hook pattern (pre-commit, post-edit, etc.)
- New CI step worth shipping across projects
- New security/privacy rule worth codifying in templates
- New methodology rule (e.g. "always do X before Y")
- New plugin requirement / MCP server worth recommending
- New convention not yet documented in unify-kit `specs/07-philosophy-and-methodology.md`

### If a trigger fires

Draft a 1-paragraph "kit-impact analysis" and ask the user via `AskUserQuestion`:
- 1. File parallel unify-kit issue (Recommended when target repo is the consumer)
- 2. Open a direct PR against unify-kit (when the user is also a kit maintainer)
- 3. Just note it in the target-repo issue body — defer the kit update
- 4. Decline — not kit-worthy

**Gate 5.** Confirm propagation plan (even if "decline").

### Special case — when target repo IS unify-kit

When `repo_schema.is_kit_repo == true`, propagation is "to itself" — skip the propagation gate and Phase 9 uses the unify-kit lifecycle (commit to `spec/<slug>` branch + PR, not issue-body embedding).

---

## Phase 6 — Plan mode → draft

**Why.** Plan mode gives structured thinking space; the draft is dense and benefits from focused reasoning before committing to text.

### Steps

1. `EnterPlanMode`.
2. **Draft the spec content** using the matching template from `assets/spec-templates/` (or read the repo's `_template.md` directly if present). Fill every required section from accumulated brainstorm + impact map + clarifications. Length targets:
   - optics module spec: 200–500 lines
   - optics journey spec: 100–300 lines
   - unify-kit numbered spec: shorter, decision-focused (depends on the topic)
   - ADR: 50–150 lines per the lightweight format

   **Crucial:** the spec describes **behavior**, not implementation. Link to file paths in `code_anchors`; do NOT copy code, Zod schemas, or function signatures into the spec body.

3. **Draft the issue body** using `assets/issue-templates/<type>.md` as the starting structure, filling every required field from `repo_schema.issue_template_fields`:
   - Description
   - Acceptance Criteria — checkbox list, split into `### Behavioral` and `### Visual Fidelity` subsections when applicable
   - Spec sections affected — paths into the repo. Use `NEW: <path>` for files that don't exist yet. Format compatible with `/work-issue` Phase 0 parsing.
   - Design Notes — any non-obvious decisions surfaced in research
   - Priority — from clarifications
   - **Proposed Spec Draft** — full spec content embedded under a collapsed `<details>` block. This is what `/work-issue` Phase 0 reads to write the spec file as the first commit on the work branch.
   - **Research notes** — URL + date + takeaway for every external finding from Phase 2e/2d
   - **Doc updates for the same PR** — list of guide docs (CHANGELOG, methodology, conventions index) that should be updated in the `/work-issue` PR
   - **Kit impact** (if Phase 5 fired) — link to the parallel unify-kit issue/PR, or a propagation note

4. **Draft convention-propagation artifacts** if Phase 5 approved one — a unify-kit issue body or PR description.

5. `ExitPlanMode` and write the assembled draft to `<repo>/.claude/spec-it/<run-id>/draft.md`. This is the source of truth for Phases 7–10.

**Gate 6.** Present the draft summary + offer to preview the full file.
- 1. Continue to Phase 7 review (Recommended)
- 2. Revise specific sections
- 3. Add more context — back to Phase 2 with new triggers
- 4. Abort

---

## Phase 7 — Iterative plan review

**Why.** Self-critique before showing the user catches embarrassingly-fixable issues (missing fields, contradictions, placeholder TODOs). `iterative-review` is purpose-built for this loop.

### Steps

1. Invoke `iterative-review` in **doc mode** against `<repo>/.claude/spec-it/<run-id>/draft.md`.
2. Severity-gated stopping rules apply:
   - **Critical** findings (missing required fields, internal contradictions, malformed embedded spec, broken markdown that won't render in GitHub) → gate the user; do not auto-fix
   - **Important** findings → auto-fix unless flipped per finding
   - **Suggestion** findings → report only, no auto-fix
3. Loop up to 3 iterations (configurable via `--cap`). Hard stop at the cap.
4. Skip-if-clean: if the initial review surfaces no Critical or Important findings, exit Phase 7 immediately.

**Gate 7.** Present the review report.
- 1. Accept fixes and continue (Recommended)
- 2. Reject specific fixes — revise the draft manually
- 3. Re-run review with `--include-suggestions` to also apply suggestions
- 4. Abort

---

## Phase 8 — Approval

**Why.** Once external action begins (filing issues, opening PRs), undoing is messier. One final confirmation against the polished draft.

### Steps

Present the final draft summary (issue title, AC count, scope, type, decomposition status, propagation status). Use `AskUserQuestion`:
- 1. Approve and execute (Recommended) — file issue(s), propagate if confirmed in Phase 5
- 2. Revise specific sections — re-enter plan mode (Phase 6) with feedback
- 3. Save draft and stop — preserved at `.claude/spec-it/<run-id>/draft.md` for resume
- 4. Abort — discard run state

---

## Phase 9 — Execution

**Why.** Mechanical. Surface every `gh` command before running it so the user can intervene. Failures should be visible, not swallowed.

### Steps

For each command: print → run → record URL.

1. **Primary issue** in target repo:
   ```bash
   gh issue create \
     --title "<type>: <description>" \
     --body-file "<repo>/.claude/spec-it/<run-id>/issue-body.md" \
     --label "<inferred-labels-from-clarifications>"
   ```
   Inferred labels: type (`enhancement` / `bug` / `chore`), priority if non-default, `spec-it-authored`.

2. **Decomposed issues** (if Phase 4 split) — file each child first, capture issue numbers, then file the parent (if chosen) with cross-reference links. Update each child's body to reference the parent: `gh issue edit <N> --body-file <updated>`.

3. **Unify-kit propagation** (if Phase 5 approved):
   - Issue path: `gh issue create --repo unifylabs-dev/unify-kit --title "<title>" --body-file <propagation-body> --label kit-propagation`
   - PR path (maintainer mode): create branch + PR in the unify-kit local checkout if present; otherwise fall back to issue path.

4. **Special case — invoked inside unify-kit itself** (`repo_schema.is_kit_repo == true`):
   - Create a `spec/<feature-slug>` branch from `origin/main` via worktree
   - Write the spec file to `specs/NN-<topic>.md` (next available NN)
   - Commit with a co-authored message
   - Push and `gh pr create --base main --title "spec: <topic>" --body-file <pr-body>`
   - No issue is filed; the PR IS the deliverable for kit pre-implementation specs.

Record every URL produced into `<repo>/.claude/spec-it/<run-id>/urls.json`.

**No gate.** Execution runs through; failures surface and pause for user intervention.

---

## Phase 10 — Deliverable verification

**Why.** GitHub rendering can mangle markdown that previewed fine locally — collapsed `<details>` blocks, fenced code blocks, nested checkbox indentation. Better to catch and fix now than to find out at `/work-issue` Phase 0.

### Steps

1. For each created issue: `gh issue view <N> --json body,labels,title` and verify:
   - Title matches the intended title
   - Body contains every required field from `repo_schema.issue_template_fields`
   - "Spec sections affected" lists the right paths in a `/work-issue`-parseable format
   - Embedded "Proposed Spec Draft" `<details>` block renders (no broken markdown)
   - All requested labels applied
   - Cross-references between decomposed issues resolve
2. Run `iterative-review` (doc mode) one more time against the **posted** issue body (not the local draft) — surface any rendering issues that only appeared after gh CLI submission.
3. If any discrepancies surface, draft the fix and offer to apply via `gh issue edit --body-file <updated>`.

**Gate 10.**
- 1. Confirm and proceed to handoff (Recommended)
- 2. Apply fixes — re-run gh issue edit for the surfaced discrepancies
- 3. Abort

---

## Phase 11 — Handoff

Print:

```
✅ /spec-it complete.

Created:
  • Issue #<N> — <title> — <URL>
  • Issue #<M> — <title> — <URL>   (if decomposed)
  • unify-kit issue #<K> — <URL>   (if propagated)
  • Parent tracking issue #<P> — <URL>   (if decomposed with parent)

Spec drafts embedded:
  • <target-spec-path>   (will be written by /work-issue Phase 0)
  • <target-spec-path>   (for each issue, if decomposed)

Target-repo doc updates flagged for the /work-issue PR:
  • docs/methodology.md — <one-line summary>
  • CHANGELOG.md — <one-line summary>

Research grounded:
  • <count> external sources cited in issue body (URLs + dates)
  • <count> memory hits surfaced

Run state: <repo>/.claude/spec-it/<run-id>/

▶ Next:  /work-issue <N>
```

---

## File layout (when this skill ships)

```
plugins/unifylabs-workflow/skills/spec-it/
├── SKILL.md                          ← you are here
├── references/
│   ├── repo-schemas.md               ← spec schema definitions (optics / unify-kit / ADR / none)
│   ├── propagation-heuristics.md     ← what triggers unify-kit propagation
│   ├── issue-body-templates.md       ← per-flavor issue body construction guide
│   ├── decomposition-heuristics.md   ← when and how to split
│   └── research-triggers.md          ← which Phase 2 streams to fire and how
├── assets/
│   ├── spec-templates/
│   │   ├── optics-module.md          ← copy of optics docs/specs/modules/_template.md
│   │   ├── optics-journey.md         ← copy of optics docs/specs/journeys/_template.md
│   │   ├── unify-kit-numbered.md     ← the unify-kit Purpose/Sourcing/Decisions/AC shape
│   │   └── adr-lightweight.md        ← one-decision-per-file ADR
│   └── issue-templates/
│       ├── feature.md                ← matches optics' feature_request.yml field set
│       ├── fix.md                    ← matches bug_report.yml
│       └── process.md                ← non-code change shape
└── evals/
    └── evals.json                    ← skill-creator test prompts (no assertions before first run)
```

**Read references on-demand**, not upfront. The body above is self-contained for the common case; references handle edge cases and deep schema info.

---

## Integration points with other skills

| Skill | Role in `/spec-it` |
|---|---|
| `superpowers:brainstorming` | Phase 1 dialog. `/spec-it` intercepts the hand-off before brainstorming calls `writing-plans`. |
| `iterative-review` | Phases 7 + 10 doc-mode review of the draft and the posted issue. |
| `/work-issue` | The next step after `/spec-it` completes. Phase 11 prints the invocation. `/work-issue` Phase 0 reads "Spec sections affected" and the embedded "Proposed Spec Draft" from the issue body and writes the spec file as the first commit on the work branch. |
| `phasing` (`/phase`) | Not invoked by `/spec-it`. Phasing is for execution-time decomposition inside `/work-issue`; `/spec-it` Phase 4 does issue-level decomposition. |
| `compliance-research` | Phase 2e auto-invokes if the feature touches a regulated domain and `repo_schema.compliance_posture` is empty. Otherwise Phase 2e spot-checks against `docs/compliance/`. |
| `extract-prototype-review` | Phase 2f may suggest this skill if a relevant `prototype/*` branch already exists. |
| `context7` MCP | Phase 2d for library/framework docs. Mandatory when a specific library is named (training data may be stale). |
| `WebSearch` | Phase 2e for industry standards, security guidelines, regulatory updates, novel UX research. Targeted queries only. |
| Auto-memory system | Phase 2b always reads `~/.claude/projects/<project>/memory/MEMORY.md` and surfaces relevant prior decisions, feedback, or contradictions. |

---

## Edge cases summary

| Situation | Action |
|---|---|
| Not in a git repo | Abort with cd instructions |
| `repo_schema.spec_style == "none"` | Phase 6 offers to bootstrap from `assets/spec-templates/`; user picks the closest style or declines |
| Brainstorming skill unavailable | Fall back to inline 3–5 question dialog covering same fields |
| No `.github/ISSUE_TEMPLATE/` directory | Use `assets/issue-templates/<type>.md` directly; flag to user that the repo has no template (potential propagation hint) |
| context7 MCP unavailable | Fall back to WebSearch with a "training data may be stale" warning embedded in research notes |
| User has saved a memory contradicting Phase 1 | Flag at Gate 2; user decides which to trust |
| Decomposition heuristic borderline | Default to one issue; user can manually request split via Gate 4 |
| Target repo is unify-kit itself | Skip Phase 5 propagation; Phase 9 uses spec-branch + PR lifecycle |
| `gh` not authenticated | Phase 9 fails immediately; prompt user to `gh auth login` and resume |
| Prototype branch overlap surfaced | Suggest `/extract-prototype-review <branch>` instead; user confirms or proceeds anyway |
| User runs `--quick` but provides only a one-liner | Treat as standard invocation; run full brainstorm |

---

## Run state directory

Every invocation writes to `<repo>/.claude/spec-it/<run-id>/`:

- `brainstorm-output.md` — Phase 1's distilled output
- `impact-map.md` — Phase 2g's aggregated research
- `clarifications.md` — Phase 3's field values
- `draft.md` — Phase 6's full draft (spec + issue body + propagation artifacts)
- `issue-body.md` — final issue body posted in Phase 9
- `urls.json` — all created URLs (issues, PRs)

This directory is gitignored (add `.claude/spec-it/` to the target repo's `.gitignore` if not already covered). Useful for `--resume <run-id>` and post-hoc debugging.

`<run-id>` format: `<YYYY-MM-DD>-<kebab-slug-from-title>` — same convention as phasing.

---

## Why this skill exists

Manual issue authoring varies wildly in quality. Some issues have crisp ACs and clear spec impact; others have a one-line "add X" and no testable criteria. The downstream `/work-issue` Phase 0 spec-sync step depends on issue quality — a poorly-shaped issue blocks `/work-issue` until the user manually fills the gaps.

`/spec-it` removes that variance. The cost is one front-loaded brainstorm + research session; the savings compound across every future `/work-issue` invocation that doesn't have to re-discover the spec impact, re-research the compliance posture, or re-draft the ACs. It also captures research grounding (URLs, dates, sources) inline so future reviewers — and future Claude sessions — can trace decisions instead of re-litigating them.
