#!/usr/bin/env bash
#
# check-drift.sh — detect drift across the unify-kit topology.
#
# License:       MIT
# Source:        https://github.com/unifylabs-dev/unify-kit
# Sourcing mode: net-new (no upstream lift).
#
# Background:
#   The kit lives in two on-disk clones that should always be in sync:
#     1. The dev tree:           ~/Projects/unify-kit/
#     2. The marketplace install ~/.claude/plugins/marketplaces/unify-kit/
#   Both clones share the same git remote (unifylabs-dev/unify-kit). Drift
#   happens when one is pushed-to and the other isn't pulled.
#
#   Additionally, user-level symlinks under ~/.claude/skills/, /commands/,
#   and ~/.claude/statusline.sh are expected to point INTO the dev tree
#   (set up by dev-symlink-skills.sh). When a new skill or command is
#   added to the plugin tree but the user-level symlink isn't created,
#   that's drift too.
#
# What this script checks:
#   A. Dev clone and marketplace install clone are on the same commit
#      and the same remote URL.
#   B. Every skill dir under plugins/unifylabs-workflow/skills/ has a
#      corresponding ~/.claude/skills/<name> symlink pointing INTO this
#      kit's tree.
#   C. Every command file under plugins/unifylabs-workflow/commands/ has
#      a corresponding ~/.claude/commands/<name> symlink pointing INTO
#      this kit's tree.
#   D. ~/.claude/statusline.sh is symlinked to this kit's statusline.
#
# What this script does NOT check:
#   - File-level diffs between the two clones. If both clones are on the
#     same commit, all tracked files match by definition. If they differ,
#     check A catches it.
#   - The plugin cache directories (~/.claude/plugins/cache/unify-kit/<v>/).
#     Those are versioned snapshots kept by the plugin loader for rollback
#     and are expected to diverge from main.
#   - The deprecated ~/Projects/claude-marketplace/ repo. If any symlink
#     points into it, check B/C will flag it as "outside this kit".
#
# Exit codes:
#   0 = no drift
#   1 = drift detected (details printed to stderr)
#   2 = environment problem (missing dirs, missing tools, etc.)
#
# Usage:
#   bash scripts/check-drift.sh         # human-readable report
#   bash scripts/check-drift.sh --quiet # exit code only, no output unless drift

set -euo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly KIT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly PLUGIN_ROOT="${KIT_ROOT}/plugins/unifylabs-workflow"
readonly MARKETPLACE_CLONE="${HOME}/.claude/plugins/marketplaces/unify-kit"
readonly CLAUDE_HOME="${HOME}/.claude"

QUIET=false
DRIFT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quiet|-q) QUIET=true ;;
    --help|-h)
      sed -n '1,/^set -e/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf >&2 'unknown flag: %s\n' "$1"
      exit 2
      ;;
  esac
  shift
done

_say()   { [[ "${QUIET}" == "true" ]] || printf '%s\n' "$*"; }
_warn()  { printf >&2 'DRIFT: %s\n' "$*"; DRIFT=1; }
_fatal() { printf >&2 'ERROR: %s\n' "$*"; exit 2; }

[[ -d "${PLUGIN_ROOT}" ]] || _fatal "plugin tree not found at ${PLUGIN_ROOT}"

# ---- Check A: dev clone vs marketplace clone on same commit ----------------

_say "── Check A: dev clone vs marketplace install ──"
if [[ ! -d "${MARKETPLACE_CLONE}/.git" ]]; then
  _say "  marketplace install not present (${MARKETPLACE_CLONE}) — skip"
else
  dev_head=$(git -C "${KIT_ROOT}" rev-parse HEAD 2>/dev/null || echo "?")
  mkt_head=$(git -C "${MARKETPLACE_CLONE}" rev-parse HEAD 2>/dev/null || echo "?")
  # Normalize remote URLs to "host/owner/repo" so SSH and HTTPS compare equal.
  # Examples:
  #   git@github.com:unifylabs-dev/unify-kit.git → github.com/unifylabs-dev/unify-kit
  #   https://github.com/unifylabs-dev/unify-kit.git → github.com/unifylabs-dev/unify-kit
  _normalize_remote() {
    printf '%s' "$1" \
      | sed -E 's|^git@([^:]+):|\1/|; s|^https?://||; s|^[^/]+@||; s|\.git$||'
  }
  dev_remote=$(_normalize_remote "$(git -C "${KIT_ROOT}" remote get-url origin 2>/dev/null)")
  mkt_remote=$(_normalize_remote "$(git -C "${MARKETPLACE_CLONE}" remote get-url origin 2>/dev/null)")

  if [[ "${dev_remote}" != "${mkt_remote}" ]]; then
    _warn "remote URL mismatch: dev=${dev_remote}, marketplace=${mkt_remote}"
  elif [[ "${dev_head}" != "${mkt_head}" ]]; then
    _warn "HEAD mismatch: dev=${dev_head:0:7}, marketplace=${mkt_head:0:7} (one or both clones need pull/push)"
  else
    _say "  ✓ both clones on ${dev_head:0:7} (${dev_remote})"
  fi
fi

# ---- Check B: every plugin skill has a user-level symlink to this kit -----

_say ""
_say "── Check B: user-level skill symlinks ──"
mkdir -p "${CLAUDE_HOME}/skills" 2>/dev/null || _fatal "cannot create ${CLAUDE_HOME}/skills"

missing=0
wrong=0
for skill_dir in "${PLUGIN_ROOT}"/skills/*/; do
  [[ -d "${skill_dir}" ]] || continue
  name=$(basename "${skill_dir%/}")
  user_link="${CLAUDE_HOME}/skills/${name}"
  expected="${PLUGIN_ROOT}/skills/${name}"

  if [[ ! -L "${user_link}" ]]; then
    if [[ -e "${user_link}" ]]; then
      _warn "skill ${name}: user-level path is a real dir/file, not a symlink"
    else
      _warn "skill ${name}: no user-level symlink (run dev-symlink-skills.sh)"
      missing=$((missing + 1))
    fi
  else
    actual=$(readlink "${user_link}")
    if [[ "${actual}" != "${expected}" ]]; then
      _warn "skill ${name}: symlink points to ${actual}, expected ${expected}"
      wrong=$((wrong + 1))
    fi
  fi
done
[[ "${missing}" == 0 && "${wrong}" == 0 ]] && _say "  ✓ all $(find "${PLUGIN_ROOT}/skills" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ') plugin skills have correct user-level symlinks"

# ---- Check C: every plugin command has a user-level symlink ---------------

_say ""
_say "── Check C: user-level command symlinks ──"
mkdir -p "${CLAUDE_HOME}/commands" 2>/dev/null || _fatal "cannot create ${CLAUDE_HOME}/commands"

missing=0
wrong=0
for cmd_file in "${PLUGIN_ROOT}"/commands/*.md; do
  [[ -f "${cmd_file}" ]] || continue
  name=$(basename "${cmd_file}")
  user_link="${CLAUDE_HOME}/commands/${name}"
  expected="${PLUGIN_ROOT}/commands/${name}"

  if [[ ! -L "${user_link}" ]]; then
    if [[ -e "${user_link}" ]]; then
      _warn "command ${name}: user-level path is a real file, not a symlink"
    else
      _warn "command ${name}: no user-level symlink (run dev-symlink-skills.sh)"
      missing=$((missing + 1))
    fi
  else
    actual=$(readlink "${user_link}")
    if [[ "${actual}" != "${expected}" ]]; then
      _warn "command ${name}: symlink points to ${actual}, expected ${expected}"
      wrong=$((wrong + 1))
    fi
  fi
done
[[ "${missing}" == 0 && "${wrong}" == 0 ]] && _say "  ✓ all $(find "${PLUGIN_ROOT}/commands" -maxdepth 1 -mindepth 1 -name '*.md' | wc -l | tr -d ' ') plugin commands have correct user-level symlinks"

# ---- Check D: statusline ---------------------------------------------------

_say ""
_say "── Check D: statusline ──"
expected_statusline="${PLUGIN_ROOT}/statusline/statusline.sh"
user_statusline="${CLAUDE_HOME}/statusline.sh"
if [[ ! -f "${expected_statusline}" ]]; then
  _say "  plugin has no statusline to compare to (${expected_statusline}) — skip"
elif [[ ! -L "${user_statusline}" ]]; then
  if [[ -e "${user_statusline}" ]]; then
    _warn "statusline.sh: user-level path is a real file, not a symlink"
  else
    _warn "statusline.sh: no user-level symlink"
  fi
else
  actual=$(readlink "${user_statusline}")
  if [[ "${actual}" != "${expected_statusline}" ]]; then
    _warn "statusline.sh: symlink points to ${actual}, expected ${expected_statusline}"
  else
    _say "  ✓ statusline.sh correctly symlinked"
  fi
fi

# ---- Summary --------------------------------------------------------------

_say ""
if [[ "${DRIFT}" == 0 ]]; then
  _say "✓ no drift detected"
  exit 0
else
  _say ""
  _say "Fix suggestions:"
  _say "  - HEAD mismatch: pull/push from the lagging clone"
  _say "  - Missing symlinks: bash scripts/dev-symlink-skills.sh"
  _say "  - Wrong-target symlinks: ln -sfn <expected> <user_link>"
  exit 1
fi
