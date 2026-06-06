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

