## Phase 6: Review Prep

**Goal:** Prepare a review summary before creating the PR.

### Enter Plan Mode

Use `EnterPlanMode` to think holistically about the changes before generating the review. Consider:
- Are there any non-obvious side effects or edge cases the user should watch for?
- Did any design decisions deserve extra scrutiny?
- Are there cross-cutting concerns (performance, security, data integrity) worth flagging?
- Does the scope feel right, or did implementation creep in?

Exit plan mode, then generate the review artifacts below.

### Generate:
1. **Diff summary** — files changed with line counts
2. **AC cross-reference table:**

```
| AC | Status | Test File | Lines |
|----|--------|-----------|-------|
| AC1 | ✅ | actions/foo.test.ts | 45-89 |
| AC2 | ✅ | actions/foo.test.ts | 91-130 |
```

3. **Concerns list** — anything the user should pay attention to during review

### Start Dev Server for Manual Review

After generating the review artifacts, always start a dev server from the worktree so the user can manually verify the changes while reviewing:

```bash
# Ensure .env is available in the worktree
cp <main-repo-path>/.env <worktree-path>/.env 2>/dev/null

# Start dev server (background)
npm run dev &
# Wait for ready
sleep 5
```

Report the URL (note: port may differ from 3000 if it's in use).

Then present a **Manual Review Checklist** — a concrete list of things for the user to visually verify in the browser. Tailor this to the specific issue's ACs. For each item, include:
- The URL to visit (e.g., `/dashboard`, `/customers`)
- What to look for (e.g., "KPI tiles show 4 columns on desktop, 2 on mobile")
- Any interactions to test (e.g., "Click the scoreboard to cycle views")
- Auth requirements (e.g., "Login as admin to see admin-only section")

Format:
```
🖥️ Dev server running at http://localhost:<port>

Manual review checklist:
1. <URL> → <what to verify>
2. <URL> → <what to verify>
...
```

Present the diff summary, AC cross-ref, concerns, dev server URL, and review checklist together.

**🚏 GATE 6 — STOP and wait for user approval.**
Show:
```
🚏 Phase 6 Complete: Review Prep

Diff summary, AC cross-ref, and concerns generated.
Dev server running for manual review.

📋 Open Items:
  - ⚠️ <any concerns flagged above>
  (or "None — all clear.")

⏭️ Next: Phase 7 — PR Creation (commit, push, open PR, update issue)
```

Then use `AskUserQuestion`:
- Question: "Phase 6 complete — how to proceed?"
- Header: "Phase 6"
- Options:
  1. **Create PR (Recommended)** — "Everything looks good. Commit, push, and open the PR."
  2. **I need more time** — "Keep the dev server running. I'll review manually and come back."
  3. **Fix something** — "I spotted an issue during review. Fix it before creating the PR."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

