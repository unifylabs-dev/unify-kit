#!/usr/bin/env bash
#
# dev-symlink-skills.sh — kit-author one-time machine migration to v2.
#
# License:       MIT
# Source:        https://github.com/unifylabs-dev/unify-kit
# Sourcing mode: net-new (no upstream lift; original expression).
#
# What this does (kit author / lead-dev only — NOT a consumer-facing script):
#
#   Back up your `~/.claude/skills/<name>/`, `~/.claude/commands/<name>.md`,
#   `~/.claude/hooks/*.sh`, and `~/.claude/statusline.sh` to
#   `~/.claude/.v2-migration-backup-<UTC-ts>/`, then symlink the user-level
#   paths into this kit's `plugins/unifylabs-workflow/...` tree. Net result:
#   editing `~/.claude/skills/ship/SKILL.md` in your normal workflow lands
#   the change directly in unify-kit's working tree.
#
# Why this script exists:
#   The v2 plugin install (`/plugin install unifylabs-workflow` from a
#   Claude session) gets the team's hooks/skills/commands wired up on a
#   user's machine. But if YOU author the kit, you want one canonical copy
#   that lives in this repo's git history, AND that is the version your
#   Claude sessions actually use. Symlinks from `~/.claude/` into this
#   repo's `plugins/unifylabs-workflow/` give you exactly that.
#
# Safety rails:
#   - Backup ALWAYS happens before any real or symlinked file is replaced.
#   - If backup-dir creation fails, the script aborts before any change.
#   - --dry-run prints every action, touches nothing.
#   - --rollback restores from the most recent backup directory.
#   - Idempotent: re-running after a successful run reports "no changes
#     needed" — symlinks that already point at the expected target are
#     left alone.
#
# Requires Bash 4+ (associative arrays).
#
# Tomer-specific note: this is YOUR migration. Run it once after pulling
# the v2 tag onto your dev box. Run it again only if you ever blow away
# `~/.claude/` and need to re-establish the plugin↔user-level symlinks.

if [ -n "${BASH_VERSION:-}" ]; then
  _ds_major="${BASH_VERSION%%.*}"
  case "${_ds_major}" in
    ''|*[!0-9]*) ;;
    *)
      if [ "${_ds_major}" -lt 4 ]; then
        printf >&2 'ERROR: dev-symlink-skills.sh requires Bash 4+ (running on %s).\n' "${BASH_VERSION}"
        printf >&2 '  macOS: brew install bash; run as /opt/homebrew/bin/bash %s\n' "$0"
        exit 1
      fi
      ;;
  esac
  unset _ds_major
fi

set -euo pipefail
IFS=$'\n\t'

# ----- constants -------------------------------------------------------------

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
KIT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly KIT_ROOT
readonly PLUGIN_ROOT="${KIT_ROOT}/plugins/unifylabs-workflow"
readonly CLAUDE_HOME="${HOME}/.claude"

# 9 skills: name → relative path under PLUGIN_ROOT (dir-typed).
SKILLS=(
  "work-issue"
  "ship"
  "review-prototype"
  "analyze-comms"
  "phasing"
  "promote-to-marketplace"
  "compliance-research"
  "iterative-review"
  "humanizer"
)

# 10 commands: filename (with .md) → file under PLUGIN_ROOT/commands/.
COMMANDS=(
  "phase.md"
  "phase-abort.md"
  "phase-archive.md"
  "phase-execute.md"
  "phase-list.md"
  "phase-next.md"
  "phase-resume.md"
  "phase-retry.md"
  "phase-status.md"
  "iterative-review.md"
)

# ----- runtime state ---------------------------------------------------------

DRY_RUN=false
ROLLBACK=false
BACKUP_DIR=""
TS=""
CHANGED=false

# ----- logging helpers -------------------------------------------------------

_say()  { printf '%s\n' "$*" >&2; }
_dry()  { printf '[dry-run] %s\n' "$*" >&2; }
_warn() { printf 'WARNING: %s\n' "$*" >&2; }
_err()  { printf 'ERROR: %s\n' "$*" >&2; }

_utc_ts() { date -u +%Y%m%dT%H%M%SZ; }

# ----- usage / arg parser ----------------------------------------------------

_usage() {
  cat <<EOF
dev-symlink-skills.sh — symlink ~/.claude/ user-level skill/command/hook/
statusline paths into this kit's plugins/unifylabs-workflow/ tree.

Usage:
  dev-symlink-skills.sh [--dry-run|--rollback|--help]

Flags:
  --dry-run    Preview every action. Writes nothing.
  --rollback   Restore the most recent ~/.claude/.v2-migration-backup-<ts>/
               back over current state (removes symlinks, replaces with
               originals).
  --help, -h   Print this message and exit 0.

Default (no flags): perform the migration, creating a backup directory
named ~/.claude/.v2-migration-backup-<UTC-timestamp>/.

Scope:
  Skills    (9): ${SKILLS[*]}
  Commands (10): ${COMMANDS[*]}
  Hooks         : every ~/.claude/hooks/*.sh (backed up; user-level entries
                  removed from ~/.claude/settings.json hooks block — plugin
                  provides hooks via \${CLAUDE_PLUGIN_ROOT})
  Statusline    : ~/.claude/statusline.sh re-pointed to plugin's statusline.

This is kit-author tooling. Consumers install the plugin via
'/plugin install unifylabs-workflow' from a Claude session.

Source:  https://github.com/unifylabs-dev/unify-kit
License: MIT
EOF
}

_parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)  DRY_RUN=true ;;
      --rollback) ROLLBACK=true ;;
      --help|-h)  _usage; exit 0 ;;
      *)
        _err "unknown flag: $1"
        _usage >&2
        exit 2
        ;;
    esac
    shift
  done
  if [[ "${DRY_RUN}" == "true" && "${ROLLBACK}" == "true" ]]; then
    _err "--dry-run and --rollback are mutually exclusive"
    exit 2
  fi
}

# ----- preflight -------------------------------------------------------------

_preflight() {
  if [[ ! -d "${PLUGIN_ROOT}" ]]; then
    _err "plugin tree not found at ${PLUGIN_ROOT}"
    _err "  did you forget to pull the v2 commits into this checkout?"
    exit 1
  fi
  local skill_dir
  for s in "${SKILLS[@]}"; do
    skill_dir="${PLUGIN_ROOT}/skills/${s}"
    if [[ ! -d "${skill_dir}" ]]; then
      _err "expected plugin skill not found: ${skill_dir}"
      exit 1
    fi
  done
  local cmd_file
  for c in "${COMMANDS[@]}"; do
    cmd_file="${PLUGIN_ROOT}/commands/${c}"
    if [[ ! -f "${cmd_file}" ]]; then
      _err "expected plugin command not found: ${cmd_file}"
      exit 1
    fi
  done
  if [[ ! -f "${PLUGIN_ROOT}/statusline/statusline.sh" ]]; then
    _err "expected statusline not found: ${PLUGIN_ROOT}/statusline/statusline.sh"
    exit 1
  fi
  if [[ ! -d "${CLAUDE_HOME}" ]]; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      _warn "${CLAUDE_HOME} does not exist (would be created on real run)"
    else
      _say "creating ${CLAUDE_HOME}"
      mkdir -p "${CLAUDE_HOME}/skills" "${CLAUDE_HOME}/commands" "${CLAUDE_HOME}/hooks"
    fi
  fi
  if ! command -v jq >/dev/null 2>&1; then
    _err "jq is required (used for surgical edits to settings.json)"
    exit 1
  fi
}

# ----- backup-dir initialization --------------------------------------------

_init_backup_dir() {
  TS="$(_utc_ts)"
  BACKUP_DIR="${CLAUDE_HOME}/.v2-migration-backup-${TS}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would create backup dir: ${BACKUP_DIR}"
    return 0
  fi
  if ! mkdir -p "${BACKUP_DIR}/skills" "${BACKUP_DIR}/commands" "${BACKUP_DIR}/hooks" 2>/dev/null; then
    _err "failed to create backup dir ${BACKUP_DIR}; aborting before any change"
    exit 1
  fi
  _say "backup dir: ${BACKUP_DIR}"
}

# ----- forward migration (per-class handlers) -------------------------------

# Back up a user-level path (file, dir, or symlink) into the backup dir.
# Preserves symlink targets (cp -P) and dir trees (cp -aR).
_backup_path() {
  local src="$1" dest_subdir="$2"
  local base; base="$(basename -- "${src}")"
  local dest="${BACKUP_DIR}/${dest_subdir}/${base}"

  if [[ -L "${src}" ]]; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      _dry "would back up symlink ${src} -> ${dest} (target: $(readlink "${src}"))"
      return 0
    fi
    cp -P -- "${src}" "${dest}"
  elif [[ -d "${src}" ]]; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      _dry "would back up dir ${src} -> ${dest}"
      return 0
    fi
    cp -aR -- "${src}" "${dest}"
  elif [[ -f "${src}" ]]; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      _dry "would back up file ${src} -> ${dest}"
      return 0
    fi
    cp -p -- "${src}" "${dest}"
  else
    _warn "nothing to back up at ${src}"
    return 0
  fi
}

# Symlink user-level path to plugin path. Returns 0 if changed, 1 if no-op.
_symlink() {
  local user_path="$1" plugin_path="$2"
  if [[ -L "${user_path}" ]]; then
    local current_target
    current_target="$(readlink "${user_path}")"
    if [[ "${current_target}" == "${plugin_path}" ]]; then
      return 1  # already correct
    fi
  fi
  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would symlink ${user_path} -> ${plugin_path}"
    return 0
  fi
  rm -rf -- "${user_path}"
  ln -s "${plugin_path}" "${user_path}"
  return 0
}

_migrate_skills() {
  mkdir -p "${CLAUDE_HOME}/skills" 2>/dev/null || true
  local name user_path plugin_path
  for name in "${SKILLS[@]}"; do
    user_path="${CLAUDE_HOME}/skills/${name}"
    plugin_path="${PLUGIN_ROOT}/skills/${name}"

    if [[ -e "${user_path}" || -L "${user_path}" ]]; then
      _backup_path "${user_path}" "skills"
    fi

    if _symlink "${user_path}" "${plugin_path}"; then
      _say "symlinked skills/${name} -> plugin"
      CHANGED=true
    else
      _say "skills/${name}: already pointing at plugin"
    fi
  done
}

_migrate_commands() {
  mkdir -p "${CLAUDE_HOME}/commands" 2>/dev/null || true
  local name user_path plugin_path
  for name in "${COMMANDS[@]}"; do
    user_path="${CLAUDE_HOME}/commands/${name}"
    plugin_path="${PLUGIN_ROOT}/commands/${name}"

    if [[ -e "${user_path}" || -L "${user_path}" ]]; then
      _backup_path "${user_path}" "commands"
    fi

    if _symlink "${user_path}" "${plugin_path}"; then
      _say "symlinked commands/${name} -> plugin"
      CHANGED=true
    else
      _say "commands/${name}: already pointing at plugin"
    fi
  done
}

# Hooks: back up every ~/.claude/hooks/*.sh; the plugin provides hooks via
# ${CLAUDE_PLUGIN_ROOT}/hooks/ + hooks.json — Claude Code resolves these
# through the plugin loader, so user-level entries in settings.json hooks
# block become redundant. We do NOT symlink hooks (the plugin loader
# wires them up itself); we just back up and remove the user-level files,
# then surgically remove user-level command entries from settings.json
# that reference ~/.claude/hooks/*.
_migrate_hooks() {
  local hooks_dir="${CLAUDE_HOME}/hooks"
  if [[ -d "${hooks_dir}" ]]; then
    local f
    while IFS= read -r -d '' f; do
      _backup_path "${f}" "hooks"
      if [[ "${DRY_RUN}" != "true" ]]; then
        rm -f -- "${f}"
        CHANGED=true
      else
        _dry "would remove ${f} (plugin owns hook execution)"
      fi
    done < <(find "${hooks_dir}" -maxdepth 1 -name '*.sh' -print0 2>/dev/null)
  fi

  # Surgically strip user-level hook entries from ~/.claude/settings.json.
  local settings="${CLAUDE_HOME}/settings.json"
  [[ -f "${settings}" ]] || return 0
  local home_safe="${HOME//\//\\/}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    if jq -e --arg home "${HOME}" '
      (.hooks // {}) | to_entries
      | map(.value[]?.hooks[]?.command)
      | flatten | map(select(. != null))
      | any(. as $c | $c | startswith($home + "/.claude/hooks/"))
    ' "${settings}" >/dev/null 2>&1; then
      _dry "would strip user-level hook command entries from ${settings}"
    fi
    return 0
  fi

  # Back up settings.json BEFORE editing.
  local settings_bak="${BACKUP_DIR}/settings.json"
  cp -p -- "${settings}" "${settings_bak}"

  # Filter out hooks[].hooks[] entries whose command starts with ~/.claude/hooks/.
  local tmp; tmp="$(mktemp)"
  if jq --arg home "${HOME}" '
    .hooks //= {}
    | .hooks |= with_entries(
        .value |= map(
          .hooks |= map(select((.command // "" | startswith($home + "/.claude/hooks/")) | not))
        )
        # Drop event-entries whose inner hooks array is now empty.
        | .value |= map(select((.hooks // []) | length > 0))
      )
    # Drop event keys whose value array became empty.
    | .hooks |= with_entries(select((.value // []) | length > 0))
  ' "${settings}" > "${tmp}" 2>/dev/null; then
    if ! cmp -s -- "${settings}" "${tmp}"; then
      mv -- "${tmp}" "${settings}"
      _say "stripped user-level hook entries from ${settings}"
      CHANGED=true
    else
      rm -f -- "${tmp}"
    fi
  else
    rm -f -- "${tmp}"
    _warn "could not edit ${settings}; left untouched (manual cleanup may be needed)"
  fi
  : "${home_safe:=}"  # silence shellcheck unused
}

_migrate_statusline() {
  local user_path="${CLAUDE_HOME}/statusline.sh"
  local plugin_path="${PLUGIN_ROOT}/statusline/statusline.sh"

  if [[ -e "${user_path}" || -L "${user_path}" ]]; then
    _backup_path "${user_path}" ""
    # Note: _backup_path for top-level files writes to BACKUP_DIR/<base>.
    # The "" subdir makes it land at BACKUP_DIR//statusline.sh — clean up
    # path by writing manually:
    if [[ "${DRY_RUN}" != "true" ]]; then
      mv -f -- "${BACKUP_DIR}//statusline.sh" "${BACKUP_DIR}/statusline.sh" 2>/dev/null || true
    fi
  fi

  if _symlink "${user_path}" "${plugin_path}"; then
    _say "symlinked statusline.sh -> plugin"
    CHANGED=true
  else
    _say "statusline.sh: already pointing at plugin"
  fi
}

# ----- rollback --------------------------------------------------------------

_rollback() {
  local newest_bak
  newest_bak="$(find "${CLAUDE_HOME}" -maxdepth 1 -type d -name '.v2-migration-backup-*' 2>/dev/null | sort | tail -1)"
  if [[ -z "${newest_bak}" ]]; then
    _err "no backup dir found at ${CLAUDE_HOME}/.v2-migration-backup-*"
    exit 1
  fi
  _say "rolling back from ${newest_bak}"

  # Skills: restore from BACKUP_DIR/skills/.
  local name
  for name in "${SKILLS[@]}"; do
    local user_path="${CLAUDE_HOME}/skills/${name}"
    local bak_path="${newest_bak}/skills/${name}"
    if [[ -e "${user_path}" || -L "${user_path}" ]]; then
      rm -rf -- "${user_path}"
    fi
    if [[ -e "${bak_path}" || -L "${bak_path}" ]]; then
      cp -aR -- "${bak_path}" "${user_path}"
      _say "restored skills/${name}"
    fi
  done

  for name in "${COMMANDS[@]}"; do
    local user_path="${CLAUDE_HOME}/commands/${name}"
    local bak_path="${newest_bak}/commands/${name}"
    if [[ -e "${user_path}" || -L "${user_path}" ]]; then
      rm -f -- "${user_path}"
    fi
    if [[ -e "${bak_path}" || -L "${bak_path}" ]]; then
      cp -aR -- "${bak_path}" "${user_path}"
      _say "restored commands/${name}"
    fi
  done

  if [[ -d "${newest_bak}/hooks" ]]; then
    mkdir -p "${CLAUDE_HOME}/hooks"
    local f
    while IFS= read -r -d '' f; do
      local base; base="$(basename -- "${f}")"
      cp -p -- "${f}" "${CLAUDE_HOME}/hooks/${base}"
      _say "restored hooks/${base}"
    done < <(find "${newest_bak}/hooks" -maxdepth 1 -type f -print0 2>/dev/null)
  fi

  if [[ -f "${newest_bak}/settings.json" ]]; then
    cp -p -- "${newest_bak}/settings.json" "${CLAUDE_HOME}/settings.json"
    _say "restored settings.json"
  fi

  if [[ -e "${newest_bak}/statusline.sh" || -L "${newest_bak}/statusline.sh" ]]; then
    rm -f -- "${CLAUDE_HOME}/statusline.sh"
    cp -aR -- "${newest_bak}/statusline.sh" "${CLAUDE_HOME}/statusline.sh"
    _say "restored statusline.sh"
  fi

  _say ""
  _say "rollback complete. Backup dir left in place: ${newest_bak}"
  _say "(delete it manually if you don't need it: rm -rf '${newest_bak}')"
}

# ----- summary ---------------------------------------------------------------

_summary() {
  _say ""
  if [[ "${DRY_RUN}" == "true" ]]; then
    _say "[dry-run] no changes applied"
    return 0
  fi
  if [[ "${CHANGED}" == "false" ]]; then
    _say "no changes needed"
  else
    _say "done. Backup at: ${BACKUP_DIR}"
    _say "  to undo: bash $0 --rollback"
  fi
}

# ----- main ------------------------------------------------------------------

main() {
  _parse_args "$@"
  _preflight
  if [[ "${ROLLBACK}" == "true" ]]; then
    _rollback
    exit 0
  fi
  _init_backup_dir
  _migrate_skills
  _migrate_commands
  _migrate_hooks
  _migrate_statusline
  _summary
}

main "$@"
