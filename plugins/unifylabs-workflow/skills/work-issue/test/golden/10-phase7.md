## Phase 7: PR Creation

**Goal:** Create PR with standardized body, link to issue.

### Commit any remaining changes:
```bash
git status --porcelain
```

If the working tree has uncommitted changes, stage and commit them:
```bash
git add -A
git commit -m "$(cat <<'EOF'
<type>: <description> (#<N>)

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

If the working tree is clean, skip staging and committing.

### Spec discipline check (before pushing):

If Phase 0 identified any spec deltas (i.e. the issue's "Spec sections affected" field listed one or more `docs/specs/*.md` paths or `NEW:` sentinels), verify that the diff against master includes spec changes:

```bash
SPEC_DIFF=$(git diff master..HEAD --name-only -- docs/specs/)
if [ -z "$SPEC_DIFF" ] && [ "<phase-0-impact>" != "none" ]; then
  echo "⛔ Spec discipline violation: issue listed spec impact but diff includes no docs/specs/* changes."
  echo "   Spec changes must ship in the same PR as the code that implements them."
  echo "   Either: (a) commit the spec deltas now, or (b) revise the issue's 'Spec sections affected' field."
  exit 1
fi
```

Compute the list of modified spec files for inclusion in the PR body:
```bash
SPEC_FILES=$(git diff master..HEAD --name-only -- docs/specs/ | sed 's|^|- |')
```

### Push and create PR:
```bash
git push -u origin <branch-name>

gh pr create --title "<type>: <description>" --body "$(cat <<EOF
## Summary
<1-3 sentences>

Closes #<N>

## Acceptance Criteria
- [x] AC1
- [x] AC2
- [x] AC3

## Spec Changes

- [<x or space>] This PR updates \`docs/specs/\` to reflect new behavior, OR
- [<x or space>] This PR fixes drift from existing spec (no spec change needed), AND I've verified the spec is still accurate.

Spec files modified:
${SPEC_FILES:-(none — drift fix or no behavior change)}

## Changes
| File | Change |
|------|--------|
| \`path/file.ts\` | Created — purpose |

## Test Coverage
- <N> new tests in `src/__tests__/...`
- All existing tests pass (<total> total)

## Verification Checklist
- [x] `npm run test:run` — all tests pass
- [x] `npm run build` — no errors
- [x] Feature verification: code paths traced, auth checks confirmed
- [x] Scope guard: all changed files map to acceptance criteria

## Design Decisions
<decisions or "None — straightforward implementation.">

## Test Plan
- [ ] <manual verification step 1>
- [ ] <manual verification step 2>
EOF
)"
```

### Update issue acceptance criteria checkboxes:
After the PR is created, update the issue body to check off all acceptance criteria checkboxes. This provides visible progress tracking directly on the issue.

```bash
# Fetch current issue body, replace unchecked boxes with checked boxes
# for each AC that was verified, then update the issue
ISSUE_BODY=$(gh issue view <N> --json body --jq '.body')
UPDATED_BODY=$(echo "$ISSUE_BODY" | sed 's/- \[ \]/- [x]/g')
gh issue edit <N> --body "$UPDATED_BODY"
```

**Note:** This checks ALL `- [ ]` boxes in the Acceptance Criteria section. If the issue has other checkbox sections (e.g., a separate "Out of Scope" list), manually review after updating. If only specific ACs were completed (partial implementation), replace only the matching lines instead of using a blanket `sed`.

### Post Milestone Comment 3 to issue:
```bash
gh issue comment <N> --body "$(cat <<'EOF'
## 🤖 PR Created

**PR:** #<PR-number> — <PR-title>
**Branch:** `<branch-name>`

### Summary
- **New tests:** N
- **Files created:** N
- **Files modified:** N
- **All ACs addressed:** ✅

Ready for review and merge per [PR Merge Process](../CLAUDE.md#pr-merge-process--required-for-every-pr).
EOF
)"
```

### Auto-cleanup worktree:

After the PR is created, automatically clean up the worktree and return to the main repo:

```bash
# Store main repo path (captured during pre-flight)
MAIN_REPO=<main-repo-path>

# Return to main repo
cd $MAIN_REPO

# Remove worktree and local branch
git worktree remove .worktrees/<type>-<N>-<kebab-description>
git branch -D <type>/<N>-<kebab-description>

# Verify master is still checked out
git branch --show-current  # → master
```

Show:
```
🧹 Worktree cleaned up:
  - Removed: .worktrees/<name>
  - Deleted local branch: <branch-name>
  - Main repo: on master ✓
  - Remote branch: still exists (tracks PR)
```

**🚏 GATE 7 — STOP and present PR link.**
Show:
```
🚏 Phase 7 Complete: PR Creation

PR #<PR-number> created: <PR-URL>. Issue #<N> updated.
Worktree cleaned up. Main repo on master.

📋 Open Items:
  - ⚠️ <any post-PR actions needed, e.g. manual checkbox review>
  (or "None — all clear.")

🔍 What I verified:
  - npm run test:run — all <total> tests pass (including <new> new)
  - npx tsc --noEmit — no type errors
  - npm run build — successful
  - Scope guard — all changed files map to ACs

🤖 Automated acceptance tests (Phase 5.5):
  <summarize results table from Phase 5.5 — which ACs were tested, tool used, pass/fail>

🧪 Manual testing for you (anything not covered by automated tests):
  1. <step-by-step manual test for AC1>
  2. <step-by-step manual test for AC2>
  3. <step-by-step manual test for AC3>
  (Cover the happy path and any edge cases specific to this feature)

📦 Merge process (from CLAUDE.md):
  1. npm run test:run — all pass
  2. npm run build — no errors
  3. Feature verification per test plan above
  4. gh pr merge <number> --merge
  5. git pull origin master  (already on master — no checkout needed)
  6. Update docs per Documentation Requirements
```

Then use `AskUserQuestion`:
- Question: "Issue #<N> complete! What next?"
- Header: "Done"
- Options:
  1. **All done (Recommended)** — "PR is ready. I'll review and merge when ready."
  2. **Merge now** — "Run the merge process right now (tests + build + merge)."
  3. **Start next issue** — "Pick up another issue from the backlog."

---

