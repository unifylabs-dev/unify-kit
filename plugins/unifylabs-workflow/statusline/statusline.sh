#!/usr/bin/env bash

input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0')

# Current working directory (shorten $HOME to ~)
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')
[ -z "$cwd" ] && cwd="$(pwd)"
cwd_display="${cwd/#$HOME/~}"
# Detect worktree vs main repo
# 1. Prefer the JSON worktree field (set when Claude is started with --worktree)
worktree_branch=$(echo "$input" | jq -r '.worktree.branch // empty')
worktree_name=$(echo "$input" | jq -r '.worktree.name // empty')

# 2. Fallback: if .git is a *file* (not a dir) the cwd is a git worktree
git_entry="$(git -C "$(pwd)" --no-optional-locks rev-parse --git-dir 2>/dev/null)"
is_worktree=false
if [ -n "$worktree_branch" ]; then
  is_worktree=true
elif [ -f "$git_entry" ] 2>/dev/null; then
  # .git is a file → we are inside a linked worktree
  is_worktree=true
fi

# Get current branch
branch=$(git -C "$(pwd)" --no-optional-locks branch --show-current 2>/dev/null)
if [ -z "$branch" ]; then
  branch_display=""
else
  # Truncate long branch names at 30 chars
  if [ ${#branch} -gt 30 ]; then
    branch="${branch:0:30}..."
  fi
  if $is_worktree; then
    # Worktree indicator: branch name with a distinct prefix
    branch_display=" [WORKTREE: ${branch}]"
  else
    branch_display=" \xf0\x9f\x8c\xbf ${branch}"
  fi
fi

# Build 10-segment progress bar
used_int=$(printf "%.0f" "$used_pct")
filled=$(( used_int * 10 / 100 ))
empty=$(( 10 - filled ))

bar=""
for ((i=0; i<filled; i++)); do bar="${bar}▓"; done
for ((i=0; i<empty; i++)); do bar="${bar}░"; done

# Color coding based on percentage
if [ "$used_int" -ge 90 ]; then
  color="\033[31m"   # Red
elif [ "$used_int" -ge 70 ]; then
  color="\033[33m"   # Yellow
else
  color="\033[32m"   # Green
fi
reset="\033[0m"

# Get lines changed (added + deleted) from git diff
lines_changed=$(git -C "$(pwd)" --no-optional-locks diff --shortstat 2>/dev/null | awk '{s=0; for(i=1;i<=NF;i++){if($(i+1)~/insertion/||$(i+1)~/deletion/)s+=$i}; print s}')
[ -z "$lines_changed" ] && lines_changed=0

printf "[%s]%b  %b%s%b %d%%  %b%dΔ%b  \033[35m%s\033[0m\n" \
  "$model" \
  "$branch_display" \
  "$color" \
  "$bar" \
  "$reset" \
  "$used_int" \
  "\033[36m" \
  "$lines_changed" \
  "$reset" \
  "$cwd_display"
