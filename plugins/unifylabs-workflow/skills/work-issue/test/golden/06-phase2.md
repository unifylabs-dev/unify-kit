## Phase 2: Branch & Worktree Creation

**Goal:** Create a development branch in an isolated git worktree so multiple terminals can work on different issues simultaneously.

### Branch naming convention:
```
<type>/<issue-number>-<kebab-description>
```
- `type`: feature, fix, chore, refactor (from Phase 1)
- `description`: 3-5 words from issue title, kebab-case

### Why worktrees:
Each Claude Code terminal in VS Code shares the same filesystem. Using `git checkout` in one terminal changes the branch for ALL terminals. Worktrees create isolated directories — each terminal works independently.

### Check for existing branch:
```bash
git branch --list "*/<N>-*"
git worktree list
```

If branch exists as a worktree already, present options:
1. Use it: `cd <existing-worktree-path>` (resume work)
2. Remove and recreate: `git worktree remove <path> && git branch -D <branch> && ...`
3. Abort

If branch exists but has no worktree, present options:
1. Create a worktree for it: `git worktree add .worktrees/<branch-name> <branch-name>`
2. Delete and recreate: `git branch -D <branch> && ...`
3. Abort

### Ensure .worktrees is gitignored:
```bash
git check-ignore -q .worktrees 2>/dev/null
```
If NOT ignored, add it before proceeding:
```bash
echo ".worktrees" >> .gitignore
git add .gitignore
git commit -m "chore: add .worktrees to gitignore

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Create worktree:
```bash
# Master is already checked out and up-to-date (verified by pre-flight check)
# Create branch + worktree in one step — NEVER checkout a branch in the main repo
git worktree add .worktrees/<type>-<N>-<kebab-description> -b <type>/<N>-<kebab-description>
```

### Set working directory:
**CRITICAL:** After creating the worktree, `cd` into it. ALL subsequent commands for this issue must run from inside the worktree directory.
```bash
cd .worktrees/<type>-<N>-<kebab-description>
```

### Install dependencies:
```bash
npm install
```

### Verify clean baseline:
```bash
npm run test:run
```
If tests fail, report failures and ask user before proceeding.

**🚏 GATE 2 — STOP and confirm worktree created.**
Show:
```
🚏 Phase 2 Complete: Branch & Worktree

Branch created at <absolute-worktree-path>. Baseline: <N> tests passed.

All subsequent work for issue #<N> happens in this directory.
Other terminals remain unaffected on their own branches.

📋 Open Items:
  - ⚠️ <any baseline test warnings or dependency issues>
  (or "None — all clear.")

⏭️ Next: Phase 3 — Planning (explore codebase, map ACs to files)
```

Then use `AskUserQuestion`:
- Question: "Phase 2 complete — how to proceed?"
- Header: "Phase 2"
- Options:
  1. **Continue to Phase 3 (Recommended)** — "Start exploring the codebase and creating the implementation plan."
  2. **Verify baseline** — "Show me the test output or dependency details before proceeding."
  3. **Rename branch** — "I want a different branch name before we start planning."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

