---
name: promote-to-marketplace
description: Move a personal skill or hook from ~/.claude/ into the unifylabs-workflow marketplace plugin so the rest of the team gets it. Use when the user says "/promote-to-marketplace <name>" or wants to share a skill/hook they created locally.
---

# promote-to-marketplace

Promotes a personal skill or hook from `~/.claude/` into the `unifylabs-workflow` plugin inside the `unify-kit` marketplace, and creates a symlink back so the user's normal `~/.claude/...` workflow keeps working.

## When to use

- The user has created a skill in `~/.claude/skills/<name>/` that's proven useful and should be shared
- The user has created a hook in `~/.claude/hooks/<name>.sh` that should run for the whole team
- The user types `/promote-to-marketplace <name>` (with or without a `--hook` flag)

## Inputs

- **`<name>`** (required) — the skill directory name or hook filename (without `.sh`) under `~/.claude/`
- **`--hook`** (optional flag) — treat the name as a hook instead of a skill (default: skill)

## Preconditions to check before doing anything

1. The unify-kit clone exists at `~/Projects/unify-kit/`. If not, abort with an instruction to clone it first (`gh repo clone unifylabs-dev/unify-kit ~/Projects/unify-kit`).
2. The named source exists at `~/.claude/skills/<name>/` (or `~/.claude/hooks/<name>.sh`).
3. The source is NOT already a symlink into the marketplace (= already promoted).
4. The name is NOT in `~/.claude/.personal-skills` (= explicitly opted out of sharing).
5. The unify-kit working tree is clean (`git -C ~/Projects/unify-kit status` shows no uncommitted changes) — if not, ask the user to commit/stash first.

## What to do

1. **Move** the source from `~/.claude/...` into `~/Projects/unify-kit/plugins/unifylabs-workflow/{skills,hooks}/<name>/`.
2. **Symlink back**: `ln -s` from the original `~/.claude/...` location to the marketplace path so the user's workflow continues seamlessly.
3. **For hooks**: prompt the user to add the hook to `~/Projects/unify-kit/plugins/unifylabs-workflow/hooks/hooks.json` (which matcher? PreToolUse/PostToolUse/SessionStart?), then update the file.
4. **Bump version**: edit `~/Projects/unify-kit/plugins/unifylabs-workflow/.claude-plugin/plugin.json` — minor bump for new skill/hook. Use `jq` to mutate JSON safely.
5. **Stage** the change: `git -C ~/Projects/unify-kit add .` (or specifically the changed paths).
6. **Show summary**: list the files moved, the symlink created, the version bump.
7. **Ask** whether to commit + push immediately or leave staged for the user to review.

## What NOT to do

- Don't promote anything in `~/.claude/.personal-skills`.
- Don't overwrite an existing skill/hook in the marketplace without asking.
- Don't commit/push without the user's confirmation.
- Don't leave the user's `~/.claude/` in a broken state — if any step fails, restore from the move (or warn them and stop).

## Rollback

If the user changes their mind:

```bash
cd ~/Projects/unify-kit
git reset --hard HEAD              # if not yet committed
# Then move the skill back:
rm ~/.claude/skills/<name>          # the symlink
mv plugins/unifylabs-workflow/skills/<name> ~/.claude/skills/<name>
```
