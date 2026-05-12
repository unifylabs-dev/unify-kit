#!/usr/bin/env bash
# marketplace-drift-check.sh
#
# SessionStart hook. Walks ~/.claude/skills/* and warns about any skill that
# exists locally but is NOT a symlink (= not managed by a marketplace plugin)
# AND NOT in ~/.claude/.personal-skills (= not explicitly opted out of
# promotion). One warning line per drifted skill.
#
# Advisory only — exit 0 always; never blocks the session.

set -uo pipefail

ALLOWLIST="$HOME/.claude/.personal-skills"
SKILLS_DIR="$HOME/.claude/skills"

[ -f "$ALLOWLIST" ] || touch "$ALLOWLIST"
[ -d "$SKILLS_DIR" ] || exit 0

for skill_path in "$SKILLS_DIR"/*; do
  [ -e "$skill_path" ] || continue
  name="$(basename "$skill_path")"

  # Symlinked skill dir = managed by a marketplace plugin
  [ -L "$skill_path" ] && continue

  # Only consider directories that actually contain a SKILL.md
  [ -d "$skill_path" ] || continue
  [ -f "$skill_path/SKILL.md" ] || continue

  # Allowlisted = explicit opt-out
  if grep -qxF "$name" "$ALLOWLIST" 2>/dev/null; then
    continue
  fi

  printf '⚠ Skill ~/.claude/skills/%s exists locally but not in marketplace plugin. Run /promote-to-marketplace or add to ~/.claude/.personal-skills.\n' "$name" >&2
done

exit 0
