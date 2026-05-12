---
name: ship
description: Commits staged and unstaged changes, pushes to origin, and creates a pull request in one command. Use when the user says "ship", "ship it", "commit and PR", "push and PR", or wants to complete the git workflow quickly.
allowed-tools:
  - Bash
  - Read
---

# Ship - Complete Git Workflow

Automate the full git workflow: commit all changes, push to remote, and create a pull request.

## Quick Start

Just invoke with `/ship` and this skill will:
1. Stage all modified and new files
2. Create a commit with a well-formatted message
3. Push to origin (creating remote branch if needed)
4. Create a pull request with a detailed description

## Instructions

When invoked, follow these steps **in a single message with multiple tool calls**:

### Step 1: Check Git Status

```bash
git status
git diff --cached
git diff
```

Identify all modified and untracked files that need to be committed.

### Step 2: Stage Files

```bash
git add [files...]
```

Stage all relevant files. Exclude:
- `.claude/` directory
- `node_modules/`
- Build artifacts (`.next/`, `dist/`, `build/`)
- Temporary files (`.temp/`, `*.tmp`)
- OS files (`.DS_Store`)

### Step 3: Create Commit

```bash
git commit -m "$(cat <<'EOF'
[type]: [concise description]

[Detailed explanation of changes]

Changes:
- Change 1
- Change 2
- Change 3

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**Commit message format:**
- **Type**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- **First line**: Under 72 characters, present tense
- **Body**: What changed and why
- **Changes list**: Bullet points of key changes

### Step 4: Push to Remote

```bash
git push -u origin [branch-name]
```

If branch doesn't exist remotely, create it with `-u`.

### Step 5: Create Pull Request

```bash
gh pr create --title "[Title]" --body "$(cat <<'EOF'
## Summary
- Bullet point summary of changes
- What problem this solves
- Key features added

## Implementation
- Component/file changes
- Architecture decisions
- Technical details

## Test plan
- [ ] Test case 1
- [ ] Test case 2
- [ ] Test case 3

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**PR title**: Clear, under 70 characters
**PR body**: Structured with Summary, Implementation, and Test plan sections

## Examples

**Example 1: Feature completion**

User: "ship it"

Actions:
1. Stage: `src/components/Button.tsx`, `src/styles/button.css`, `tests/button.test.ts`
2. Commit: `feat: add customizable button component with variants`
3. Push: `git push -u origin feature/button-variants`
4. PR: Creates PR #42 with title "Add customizable button component"

**Example 2: Bug fix**

User: "ship"

Actions:
1. Stage: `src/utils/validation.ts`, `tests/validation.test.ts`
2. Commit: `fix: prevent null pointer in email validation`
3. Push: Updates existing remote branch
4. PR: Creates PR with detailed reproduction steps and fix explanation

## Guidelines

### Do
- ✅ Execute all steps in **one message** (multiple tool calls)
- ✅ Write clear, descriptive commit messages
- ✅ Include test plan in PR description
- ✅ Use present tense in commit messages
- ✅ Group related changes in commit

### Don't
- ❌ Commit secrets or `.env` files
- ❌ Include `node_modules/` or build artifacts
- ❌ Create empty commits
- ❌ Use vague commit messages like "updates" or "changes"
- ❌ Skip the PR description

### Special Cases

**Already on main branch:**
```bash
# Create feature branch first
git checkout -b feature/[description]
# Then proceed with commit/push/PR
```

**Merge conflicts:**
Stop and inform user - don't auto-resolve conflicts.

**No changes to commit:**
Inform user and exit gracefully.

**PR already exists:**
Skip PR creation, inform user of existing PR URL.

## Integration with Existing Commands

This skill combines:
- `/commit` - Just commits changes
- `/commit-push-pr` - Same as `/ship` (this skill)

Use `/ship` when you want the complete workflow.
Use `/commit` when you only want to commit without pushing/PR.

## Success Criteria

After running `/ship`, the user should have:
1. ✅ A clean working directory (all changes committed)
2. ✅ Changes pushed to remote branch
3. ✅ Pull request created with URL provided
4. ✅ Ready to share PR link with team
