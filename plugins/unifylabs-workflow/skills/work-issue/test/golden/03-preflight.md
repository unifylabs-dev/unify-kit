## Pre-flight Check (runs before Phase 1)

Before starting any work, verify the environment is safe:

```bash
# 1. Detect if we're already inside a worktree
TOPLEVEL=$(git rev-parse --show-toplevel)
COMMON_DIR=$(git rev-parse --git-common-dir)
if [ "$COMMON_DIR" != ".git" ] && [ "$COMMON_DIR" != "$(git rev-parse --git-dir)" ]; then
  echo "⚠️ You are inside a worktree ($TOPLEVEL). Please cd to the main repo first."
  # STOP — ask user to cd to the main repo
fi

# 2. Verify master is checked out in the main repo
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "⚠️ Main repo is on '$CURRENT_BRANCH', not master. Switching back."
  git checkout master
fi

# 3. Pull latest master
git pull origin master
```

If the pre-flight detects a non-master branch, switch back to master automatically and warn the user. If inside a worktree, stop and ask the user to navigate to the main repo.

---

