---
name: integrate-branch
description: >
  Take an external/untrusted branch (built outside the standard workflow — by a
  junior dev with GSD, a contractor, a quick spike, etc.) and audit it against
  the full set of project standards plus cross-cutting impact on other features,
  then route to one of three execution paths: salvage (fix the existing code
  in place via /work-issue), rebuild (extract specs to an issue and rebuild
  from scratch via /extract-prototype-review + /work-issue), or discard. Every
  successful invocation ends in a PR that meets every CLAUDE.md standard, OR
  a documented decision to discard with rationale. Use when the user says
  "/integrate-branch <branch>", "audit and integrate this branch", "is this
  branch safe to merge", or has a branch from outside the standard workflow
  that needs to be brought up to standards.
tags: [audit, integration, review, salvage, rebuild, external-branch, workflow]
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
  - Glob
  - Grep
  - Agent
  - Skill
---

# /integrate-branch — Audit & integrate an external branch

You are integrating a branch built outside the project's standard workflow. The branch's credibility is unknown: it may have production-ready code that just needs the project's standards layered in (auth guards, audit logging, tests, spec sync), it may be fundamentally broken and need a full rebuild from extracted specs, or it may be unsafe and need to be discarded.

**Your job:** audit it, recommend a route, get user confirmation, set up the right downstream invocation, and hand off cleanly.

**Companion skill:** `/extract-prototype-review` (formerly `/review-prototype`) is for *sanctioned* prototypes — branches under `prototype/*` with a Draft PR + screenshots where the junior intentionally skipped standards per `CLAUDE-PROTOTYPE.md`. This skill is for everything else.

## Invocation

| Form | Meaning |
|------|---------|
| `/integrate-branch <branch-name>` | Full or partial branch name. Auto-resolves on remote. |
| `/integrate-branch <PR#>` | PR number → resolves to head branch. |
| `/integrate-branch <PR-URL>` | PR URL → resolves to head branch. |
| `/integrate-branch` (no args) | Currently checked-out branch (refused if in main repo on master, or on master anywhere). |

**Flags:**
- `--skip-final-review` — skip the suggested `/iterative-review` pass in the handoff message (default: suggest it).

## Pre-flight (runs before Phase 1)

Refuse with a clear message in any of these states:

1. **In main repo on a non-master branch** — violates worktree-first rule. Tell the user to switch back to master in the main repo and use a worktree for the audit.
2. **Branch is `master`** — nothing to integrate.
3. **Branch has no diff vs. master** — `git diff master...origin/<branch> --quiet` → exit 0. Nothing to integrate.
4. **Uncommitted changes in cwd** — refuse; ask user to commit/stash first.

## Phase 1: Resolve & gather

### Resolve the branch

```bash
git fetch origin

# Try exact match
git rev-parse --verify origin/<branch> 2>/dev/null

# If input includes a PR number/URL, resolve via gh:
gh pr view <N-or-URL> --json headRefName --jq '.headRefName'

# If no match, search partial:
git branch -r --list "origin/*<input>*"
```

If unresolvable, list candidates and stop. Do not proceed with a guess.

Once resolved, store the **canonical branch name** for all subsequent steps.

### Detect staleness & merge conflicts

```bash
# Days since branch tip
git log -1 --format=%cr origin/<branch>

# Commits behind master
git rev-list --count origin/<branch>..master

# Merge-conflict probe (no actual merge):
git merge-tree $(git merge-base master origin/<branch>) master origin/<branch>
```

Flag in audit:
- **Stale** if >30 days behind master (warn — may force rebuild)
- **Conflicts** if merge-tree shows conflict markers (`<<<<<<<`) — must rebase before any integration

### Get diff context

```bash
# Files changed
git diff master...origin/<branch> --name-only

# Lines changed (size signal)
git diff master...origin/<branch> --stat

# Full diff (for audit reads)
git diff master...origin/<branch> -- . ':!package-lock.json' ':!pnpm-lock.yaml' ':!yarn.lock'
```

### Read every changed file from the branch

```bash
git show origin/<branch>:<path>
```

Read every modified or added file. Do not skip — config, styles, tests, and migrations all contain signal.

### Check for associated PR / issue

```bash
gh pr list --head "<branch>" --state all --json number,title,body,url --limit 1
```

If a PR exists, note its title, body, and URL. If the PR body or branch name references an issue number (`Closes #N`, `#N`, etc.), capture it — the salvage path will reuse that issue rather than creating a new one.

## Phase 2: Audit (read-only, weighted 0–100)

Run all six dimensions. Each emits findings categorized **Critical / Important / Suggestion** and a per-dimension score (0–100).

**Composite score** = `0.30·D1 + 0.20·D2 + 0.15·D3 + 0.10·D4 + 0.20·D5 + 0.05·D6` (D6 omitted and renormalized if not applicable).

### Dimension 1: CLAUDE.md non-negotiables (weight 30%)

For every modified/added Server Action (typically `src/app/.../actions.ts` or `src/lib/actions/**`):

- **Auth guard** — top of every mutating action: `verifySession()` or `verifyRole("STAFF"|"ADMIN")` from `src/lib/dal.ts`. **Critical** if missing on a mutation.
- **Audit logging** — every mutation calls `logAudit({...})` (typically `void logAudit({...})` fire-and-forget). **Critical** if missing on a mutation.
- **Server Action contract** — actions return `{ error }` or `{ fieldErrors }` on Zod failure; re-throw `NEXT_REDIRECT` from `redirect()`. **Important** if action throws raw errors instead.
- **Zod validation** — input parsed via `Schema.safeParse(formData)` or equivalent. **Important** if missing.
- **PHI in logs** — grep modified files for `console.log` / `console.error` containing template literals with patient fields (name, email, phone, dob, healthCard, prescription). **Critical** if found (PHIPA violation).
- **Rate limiting on public endpoints** — public routes (anything under `/api/public/*`, `/f/*`, `/intake/*`, `/book/*`, `/my/*`) use `checkRateLimit()` from `src/lib/rate-limit.ts`. **Critical** if missing on a public mutating endpoint.
- **Timing-safe auth responses** — login / magic-link / password-reset endpoints have constant-time response shape (no early returns leaking user existence). **Critical** if missing.
- **Cron secret** — anything under `src/app/api/cron/**` calls `verifyCronSecret()`. **Critical** if missing.

**Scoring:** start at 100. Each Critical finding subtracts 20; each Important subtracts 10. Floor 0.

### Dimension 2: Test bar (weight 20%)

```bash
# In a worktree (use a temporary one for the audit):
git worktree add --detach /tmp/integrate-audit-<branch> origin/<branch>
cd /tmp/integrate-audit-<branch>
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"  # see CLAUDE.md
npm install --silent

# Run gates
npm run test:run        # unit + integration tests
npx tsc --noEmit        # type check
npm run build           # production build

# Coverage signal: for each new src/ file, look for sibling .test.ts
git diff master...HEAD --name-only --diff-filter=A | grep -E '^src/.+\.(ts|tsx)$' | grep -v test
```

- Tests pass: **Important** if any fail, **Critical** if >50% fail (catastrophic — flag for rebuild).
- tsc clean: **Critical** if errors present.
- Build succeeds: **Critical** if fails.
- New code has tests: **Important** per uncovered new file.
- E2E `@daily` tag on critical-path tests (read-only golden paths): **Suggestion** if missing.

Clean up the audit worktree at end of audit phase (regardless of route): `git worktree remove /tmp/integrate-audit-<branch>`.

**Scoring:** 100 - (40 × build_fail) - (30 × tsc_fail) - (20 × tests_fail) - (5 × untested_new_file_count, max 30). Floor 0.

### Dimension 3: Spec sync (weight 15%)

```bash
# Find modules covered by specs
ls docs/specs/modules/*.md 2>/dev/null
ls docs/specs/journeys/*.md 2>/dev/null
```

For each modified file, identify whether it falls under a documented module/journey (e.g., changes in `src/app/orders/**` → `docs/specs/modules/orders.md`).

- Spec drift — behavior in modified file diverges from a documented invariant in its module spec. **Important** per drift.
- Required spec update missing — branch touches spec-covered code but diff has zero `docs/specs/*.md` changes. **Important**.
- New feature without spec entry — added a new route/module not in specs. **Suggestion** (may be intentional NEW work).

**Scoring:** 100 - (20 × drift_count) - (15 × missing_update_count). Floor 0.

### Dimension 4: Code quality (weight 10%)

Dispatch the `pr-review-toolkit` agents **in report-only mode** against the branch diff. Run in parallel:

```
Agent(subagent_type: "pr-review-toolkit:code-reviewer", prompt: "Review the diff origin/master..origin/<branch>. REPORT-ONLY. Return findings categorized Critical / Important / Suggestion. Do NOT apply fixes.")
Agent(subagent_type: "pr-review-toolkit:silent-failure-hunter", prompt: similar)
Agent(subagent_type: "pr-review-toolkit:type-design-analyzer", prompt: similar)
Agent(subagent_type: "pr-review-toolkit:comment-analyzer", prompt: similar)
Agent(subagent_type: "pr-review-toolkit:code-simplifier", prompt: similar)
Agent(subagent_type: "pr-review-toolkit:pr-test-analyzer", prompt: similar)
```

Aggregate Critical/Important/Suggestion counts across all six agents. Findings carry forward into the audit report and become salvage-path ACs if the salvage route is chosen.

**Scoring:** 100 - (10 × critical_count) - (4 × important_count). Floor 0.

### Dimension 5: Cross-cutting impact (weight 20%)

For every modified file, find dependents. **List-only** mode (do NOT auto-run dependent tests at audit time — that happens in /work-issue Phase 5/5.5 and final /iterative-review).

```bash
# For src/lib/* utilities — grep for imports
for file in $(git diff master...origin/<branch> --name-only | grep '^src/lib/'); do
  base=$(basename "$file" .ts)
  dirname=$(dirname "$file")
  rg --files-with-matches "from ['\"](@/${dirname#src/}/${base}|\\.\\./${base})" src/ \
    | grep -v "^$file$"
done

# For shared components — same pattern under src/components/
# For Prisma schema changes — extract changed model names, grep src/ for prisma.<modelName>.
# For shared types — grep imports of the type name
```

Categorize each modified shared resource:

| Category | Definition | Score impact |
|---|---|---|
| **Isolated** | 0 dependents | No penalty |
| **Shared** | 1–10 dependents | Listed in audit table |
| **Foundational** | >10 dependents | **Important** finding — high-attention review needed |

**Adjacent spec invariants:** for each module spec under `docs/specs/modules/*.md` NOT directly modified, grep for references to symbols (functions, types) the branch DOES modify. If found, flag as adjacent-spec invalidation risk — **Important**.

**Migration safety:** if `prisma/schema.prisma` or `prisma/migrations/**` modified, check that migration name doesn't collide with any migration on master not present on the branch (out-of-order migrations) — **Critical** if conflict.

**Special discard signal:** if the branch modifies foundational auth/security files in ways that break the invariants (e.g., `src/lib/dal.ts`, `src/lib/auth.ts`, `middleware.ts`) AND removes or weakens existing checks → **Critical** + recommend Discard route regardless of composite score.

**Scoring:** 100 - (15 × foundational_count) - (5 × shared_count, max 30) - (15 × adjacent_drift_count) - (40 × migration_conflict). Floor 0.

### Dimension 6: Visual fidelity (weight 5%, conditional)

Only applies if:
- Branch modifies `.tsx` files under `src/app/**` or `src/components/**`
- AND a visual ground truth exists: PR has screenshots OR branch resembles a prototype source style

If neither: omit dimension entirely (renormalize remaining weights to 100%).

If applicable, compare each modified UI file's Tailwind classes against the prototype/screenshot ground truth — same logic as `/extract-prototype-review` Phase 2.5 but read-only. Flag drift as **Important**.

**Scoring:** 100 - (10 × drift_count). Floor 0.

### Compute composite score & assemble audit

After all dimensions run, compute the weighted composite. Build the audit report (see below) — this is shown to the user before any routing decision.

## Phase 3: Route recommendation

### Recommendation matrix

| Composite | Blocking signal (any) | Route |
|---:|---|---|
| ≥80 | None | **Salvage** (recommended) |
| 40–79 | None | **User decides** (no opinion; show audit, let user pick) |
| <40 | — | **Rebuild** (recommended) |
| Any | Build fails AND no obvious fix path | **Rebuild** |
| Any | Test suite >50% failing | **Rebuild** |
| Any | PHI-in-logs detected | **Rebuild** (PHIPA violation — code can't be salvaged in place) |
| Any | Hard-coded secrets | **Discard** |
| Any | Unprotected mutating action on a public route | **Discard** |
| Any | Foundational auth/security file (dal.ts, auth.ts, middleware.ts) broken | **Discard** |
| Any | Migration conflicts with master that can't auto-rebase | **Rebuild** |

**Always print the full audit report first** — the user must see findings before being asked to choose. The skill never silently routes.

### Audit report format

```markdown
# Integration Audit — <branch>

**Composite score:** <N>/100
**Recommended route:** <Salvage|Rebuild|Discard|User decides>
**Rationale:** <1–2 sentences explaining the recommendation>

## Branch summary
- Branch: <canonical name>
- Files changed: <N> (<+lines>/<-lines>)
- Days behind master: <N>
- Linked issue/PR: <#N or "none">
- Stale: <yes/no>
- Merge conflicts: <yes/no>

## Per-dimension scores

| Dimension | Score | Weight | Findings |
|---|---:|---:|---:|
| CLAUDE.md non-negotiables | <N>/100 | 30% | <C>/<I>/<S> |
| Test bar                  | <N>/100 | 20% | <C>/<I>/<S> |
| Spec sync                 | <N>/100 | 15% | <C>/<I>/<S> |
| Code quality              | <N>/100 | 10% | <C>/<I>/<S> |
| Cross-cutting impact      | <N>/100 | 20% | <C>/<I>/<S> |
| Visual fidelity           | <N>/100 |  5% | <C>/<I>/<S> |

## Critical findings
<bullet list of every Critical finding with file:line where applicable>

## Important findings
<grouped by dimension>

## Cross-cutting impact

| Modified file | Category | Dependents |
|---|---|---|
| src/lib/foo.ts | Foundational (14 deps) | src/app/orders/page.tsx, src/lib/bar.ts, ... |
| ...           | ...          | ... |

## Suggestions
<bullet list — may be ignored on salvage; surfaced for rebuild>
```

### Confirm the route with the user

After printing the audit, ask via `AskUserQuestion`:

```
question: "Audit complete. Composite score <N>/100. Recommended route: <X>. Proceed?"
options:
  - <Recommended route> (Recommended)
  - Salvage — fix gaps in place, produce PR from existing code
  - Rebuild — extract specs, rebuild from scratch via /work-issue
  - Discard — abort with documented rationale
  - Show me a specific finding before deciding
```

The user's choice locks in the route. Proceed to Phase 4.

## Phase 4: Execute the route

### 4.1 Salvage path

**Goal:** end with the external branch's code as the foundation, plus gap-fixes that bring it up to project standards, delivered through `/work-issue`'s standard gates.

**Steps:**

1. **Determine issue strategy:**
   - If the branch has a linked existing issue → reuse it; append integration ACs as a new section.
   - Otherwise → create a new issue.

2. **Convert audit findings → checkbox ACs.** One AC per gap. Examples:
   - `- [ ] verifySession() called at top of createOrder action (src/app/orders/actions.ts:42)`
   - `- [ ] logAudit({...}) call added to deleteCustomer (src/app/customers/actions.ts:88)`
   - `- [ ] OrderWizard.tsx has unit tests covering happy path + Zod validation errors`
   - `- [ ] Order workflow matches docs/specs/modules/orders.md §3.2 (or spec updated)`
   - `- [ ] Cross-cutting: verify all 7 Button consumers render after shared-component change`
   - `- [ ] Rate limit added to /api/public/intake/start (src/app/api/public/intake/start/route.ts)`

3. **Compute branch name + worktree path:**
   - Branch name: `feature/<issue#>-salvage-<orig-slug>` where `<orig-slug>` is the original branch name slugified to kebab-case (e.g., `customer-export-tool`).
   - Worktree path: `.worktrees/feature-<issue#>-salvage-<orig-slug>` (relative to the main repo checkout).

4. **Create the integration issue:**

```bash
gh issue create \
  --title "Integrate <orig-branch>: salvage and complete standards compliance" \
  --label "integration,salvage,ready-for-implementation" \
  --body "$(cat <<'ISSUE_BODY'
## Description

This issue tracks the integration of branch `<orig-branch>` into the project's standards-driven workflow. An audit of the branch (composite score <N>/100) found it salvageable: the existing code is the foundation; this issue adds the gap-fixes needed to make it production-ready.

**Suggested worktree branch:** `feature/<issue#>-salvage-<orig-slug>` (pre-created at `.worktrees/feature-<issue#>-salvage-<orig-slug>` by /integrate-branch)

## Acceptance Criteria

### Standards gap-fixes
<one AC per Critical/Important audit finding>

### Cross-cutting verification
<one AC per Shared/Foundational dependent that may regress>

### Spec sync
<one AC per spec module that needs to be updated or verified — or "None — no spec drift detected">

## Spec sections affected

<list paths under docs/specs/modules/*.md or docs/specs/journeys/*.md OR "None — fixing drift from spec" OR "NEW: <path>" for new specs>

## Audit summary

<paste the per-dimension score table + critical findings list>

## Cross-cutting impact

<paste the cross-cutting impact table>

## Original branch

`<orig-branch>` — retained as historical reference; the salvage worktree is based on this branch's HEAD.
ISSUE_BODY
)"
```

5. **Create the worktree from the external branch:**

```bash
# Run from the main repo checkout (not inside any worktree)
cd "$(git rev-parse --show-toplevel)"  # or `cd <path-to-main-repo>`

NEW_BRANCH="feature/<issue#>-salvage-<orig-slug>"
WORKTREE_PATH=".worktrees/feature-<issue#>-salvage-<orig-slug>"

# Create branch from the external branch's HEAD
git branch "$NEW_BRANCH" origin/<orig-branch>
git worktree add "$WORKTREE_PATH" "$NEW_BRANCH"
cd "$WORKTREE_PATH"
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm install
```

6. **Verify baseline tests pass on the salvage branch** (re-run from audit if needed; if catastrophic failure, the route should have been Rebuild, not Salvage — bail back to Phase 3 routing decision).

7. **Hand off — print this message:**

```
✅ Salvage setup complete.

  Audit:     Salvage route (composite <N>/100)
  Issue:     #<N> — <title>
  Worktree:  <WORKTREE_PATH>
  Branch:    <NEW_BRANCH> (based on origin/<orig-branch>)

Next steps (run from the MAIN repo, not the worktree):

  1. /work-issue <N>
     • Phase 1 will parse the gap-ACs from the issue body
     • Phase 2 will detect the existing worktree at <WORKTREE_PATH> and offer
       "Use existing worktree" — choose that option
     • Phase 4 (TDD) will address each gap-AC in sequence
     • Phase 7 will create the PR

  2. After the PR is created: /iterative-review <PR#>
     This is the final agent-suite quality gate — catches any subtle issues
     the explicit gap-ACs may not have addressed. Salvage path benefits most
     from this pass since the original code was never agent-reviewed before
     integration.

  3. Standard merge process (CLAUDE.md "PR Merge Process").
```

### 4.2 Rebuild path

**Goal:** treat the external branch as a *living spec only*; rebuild the feature from scratch through `/work-issue`'s TDD pipeline. The external branch's code is never reused.

**Steps:**

1. **Invoke `/extract-prototype-review` against the external branch:**

```
Skill(skill: "extract-prototype-review", args: "<orig-branch>")
```

(Note: this skill was renamed from `/review-prototype`. It accepts non-`prototype/*` branch names.)

That skill will:
- Read every file from the branch
- Extract visual + behavioral acceptance criteria
- Create a GitHub issue with the extracted ACs

2. **Wait for the issue number** returned by `/extract-prototype-review`. Capture it.

3. **Hand off — print this message:**

```
✅ Rebuild setup complete.

  Audit:        Rebuild route (composite <N>/100)
  Source branch: <orig-branch> (retained as living spec; never to be merged)
  Issue:        #<N> created by /extract-prototype-review

Next steps:

  1. /work-issue <N>
     • Phase 2 will create a fresh worktree from master (NOT from <orig-branch>)
     • Phase 4 (TDD) will rebuild the feature from scratch using the issue's ACs
       and the original branch as a reference: git show origin/<orig-branch>:<file>
     • Phase 7 will create the PR

  2. After the PR is created: /iterative-review <PR#>
     Independent agent-suite check — even though /work-issue TDD produced
     clean code by construction, this is defense in depth.

  3. Standard merge process.
```

### 4.3 Discard path

**Goal:** clearly document why the branch can't be integrated, what to do next, and any salvageable patterns worth referencing in a future from-scratch implementation.

**Steps:**

1. **Build the discard report:**

```markdown
# Discard recommendation — <branch>

**Audit composite:** <N>/100
**Reason for discard:** <one-paragraph explanation citing the specific Critical findings that triggered the discard route — typically hard-coded secrets, foundational security file corruption, or unrecoverable architectural mismatch>

## What to do next

1. Delete the remote branch (after confirming with the original author):
   `git push origin --delete <branch>`
2. If the underlying feature is still wanted, create a fresh GitHub issue
   describing the requirement and run `/work-issue <N>` from scratch.
3. Do NOT attempt to cherry-pick from `<branch>` — the failure modes are
   architectural, not local.

## Salvageable patterns (reference only)

<List any specific design decisions, UI patterns, or business-logic
insights from the branch that are worth preserving as input to a fresh
implementation. These do NOT come with the code itself — they're notes
for whoever rebuilds the feature.>

- ...

## Audit details

<paste the full audit report>
```

2. **Print the report** to the user. No issue created, no worktree created, no PR.

3. **End the skill.** Do not suggest /work-issue or /iterative-review.

## Phase 5: Final quality gate (handoff reminder)

The `/integrate-branch` skill does NOT directly invoke `/work-issue` or `/iterative-review` — those are interactive workflows the user drives. The handoff messages in Phases 4.1 and 4.2 tell the user exactly what to run next.

**`/iterative-review` runs after `/work-issue` creates the PR.** It is the final agent-suite quality gate. Unless `--skip-final-review` was passed to `/integrate-branch`, always include this step in the handoff.

If `--skip-final-review` was passed: omit the `/iterative-review` step from the handoff message and note "Final review skipped per --skip-final-review flag."

## Edge cases

- **Branch already has a linked issue** — reuse the existing issue on salvage; append integration ACs as a new section. On rebuild, `/extract-prototype-review` will either reuse the issue (its existing behavior) or create a new one — defer to its logic.
- **Merge conflicts vs. master** — audit flags as Critical. Tell the user to rebase the branch first (or rebase as part of the salvage worktree setup if the user opts in). Do not proceed to salvage with unresolved conflicts.
- **Stale branch (>30 days)** — audit flags as Important. May force rebuild if conflicts compound.
- **Force-push during audit** — between Phase 1 (resolve SHA) and Phase 4 (execute), capture `git rev-parse origin/<branch>` at start; re-check at execute. If SHA changed, abort with "branch was force-pushed during audit; please re-run."
- **Branch has no diff vs. master** — refused in pre-flight. Tell the user the branch contains no changes.
- **Audit finds zero gaps** (composite ≈100) — still surface the audit. Ask the user via `AskUserQuestion`: "Audit found no standards gaps. Options: (a) skip salvage workflow, fast-track as feature/<N>-promote-<orig> and run /work-issue from Phase 5 onward for verification only; (b) full salvage anyway; (c) review the cross-cutting impact table before deciding." Default behavior: option (a).
- **User invokes in main repo on non-master** — pre-flight refuses with the worktree-first reminder.

## Important notes

- **Never modify the external branch.** It remains a historical reference on the remote.
- **Never silently route.** Always show the audit and confirm the route via `AskUserQuestion`.
- **Never invoke `/work-issue` or `/iterative-review` directly from this skill** — those are interactive flows. Hand off cleanly via the message in Phase 4 and let the user drive.
- **Clean up the temporary audit worktree** at the end of Phase 2 (`/tmp/integrate-audit-<branch>`), regardless of route.
- **Audit is read-only.** No fixes applied during the audit phase. All fixes happen later in `/work-issue` Phase 4 (TDD) and `/iterative-review`'s fix loop.
- **`/extract-prototype-review` (formerly `/review-prototype`)** — the sister skill for sanctioned `prototype/*` branches. If the input branch IS a sanctioned prototype (named `prototype/*` + has Draft PR + has screenshots), suggest the user run `/extract-prototype-review` directly instead of going through the full audit — it's faster and the prototype-specific extraction is what they want.

## Companion skills referenced

- `/extract-prototype-review` — invoked on the Rebuild path; also recommended for sanctioned prototypes.
- `/work-issue` — invoked by the user after handoff; handles the actual remediation/rebuild lifecycle.
- `/iterative-review` — invoked by the user after `/work-issue` creates the PR; final quality gate.
- `/pr-review-toolkit:*` — dispatched as report-only agents during Dimension 4 of the audit.
- `/promote-to-marketplace` — used by the skill author to move this skill into the `unifylabs-workflow` plugin after local validation.
