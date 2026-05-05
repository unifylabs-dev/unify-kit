#!/usr/bin/env bash
#
# bootstrap-claude-config.sh — install unify-kit hooks + register them in
# ~/.claude/settings.json.
#
# License:       MIT
# Source:        https://github.com/unifylabs-dev/unify-kit
# Sourcing mode: net-new (no upstream lift; original expression).
#
# Idempotent. Backups mandatory. Operates on ~/.claude/settings.json only —
# never touches ~/.claude/settings.local.json.
#
set -euo pipefail

readonly KIT_VERSION="0.1.0-dev"
readonly KIT_SOURCE_URL="https://github.com/unifylabs-dev/unify-kit"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
KIT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly KIT_ROOT
readonly HOOKS_SRC="${KIT_ROOT}/hooks"
readonly SNIPPET_SRC="${KIT_ROOT}/hooks/settings-snippet.json"

# CLAUDE_HOME env override is for CI fake-home isolation only (e.g.
# `HOME=$RUNNER_TEMP/fake-home`). Not promoted as a user-facing feature.
readonly CLAUDE_HOME="${CLAUDE_HOME:-${HOME}/.claude}"
readonly SETTINGS_PATH="${CLAUDE_HOME}/settings.json"
readonly HOOKS_DIR="${CLAUDE_HOME}/hooks"
readonly MANIFEST_PATH="${CLAUDE_HOME}/.unify-kit-manifest.json"

DRY_RUN=false
FORCE=false
CHANGED=false
SHA256_CMD=""
BACKUPS_CREATED=()

# ----- logging helpers -------------------------------------------------------

_say()  { printf '%s\n' "$*"; }
_dry()  { printf '[dry-run] %s\n' "$*"; }
_warn() { printf 'WARNING: %s\n' "$*" >&2; }
_err()  { printf 'ERROR: %s\n' "$*" >&2; }

_sha256() {
  case "${SHA256_CMD}" in
    shasum)    shasum -a 256 -- "$1" | awk '{print $1}' ;;
    sha256sum) sha256sum -- "$1" | awk '{print $1}' ;;
    *)
      _err "no SHA-256 tool available (looked for shasum, sha256sum)"
      exit 1
      ;;
  esac
}

_utc_ts() { date -u +%Y%m%dT%H%M%SZ; }

# ----- usage / arg parser ----------------------------------------------------

usage() {
  cat <<EOF
bootstrap-claude-config.sh — install unify-kit hooks + register them in
                             ~/.claude/settings.json.

Usage:
  bootstrap-claude-config.sh [--dry-run | --force] [--help]

Flags:
  --dry-run    Preview every change. Do not create, copy, back up, write, or
               chmod anything.
  --force      Overwrite kit-shipped hook files that have been manually edited
               since the last install. Backups are still created.
  --help, -h   Print this message and exit 0.

What it does:
  1. Pre-flight: checks for jq, a SHA-256 tool, and (warn-only) for the
     'claude' CLI.
  2. Installs the six hooks under hooks/*.sh into ~/.claude/hooks/, chmod +x.
  3. Backs up ~/.claude/settings.json (if present) to
     ~/.claude/settings.json.bak.<UTC-timestamp>.
  4. Merges hooks/settings-snippet.json into ~/.claude/settings.json under
     .hooks per the spec-05 settings-merge algorithm. Tilde paths stay literal.
  5. Writes ~/.claude/.unify-kit-manifest.json recording version + per-artifact
     SHA-256 (basis for safe re-runs).
  6. Verifies every hook is on disk + executable and registered in
     settings.json. Exits non-zero if any check fails.

Idempotent: re-running on a clean install reports "no changes needed".

Operates on ~/.claude/settings.json only. Never touches settings.local.json.

Source: ${KIT_SOURCE_URL}
License: MIT
Version: ${KIT_VERSION}

Environment:
  CLAUDE_HOME   Override the install root (defaults to \$HOME/.claude). Used
                by the kit's own CI for fake-home isolation; not part of the
                consumer-facing contract.
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) DRY_RUN=true ;;
      --force)   FORCE=true ;;
      --help|-h) usage; exit 0 ;;
      *)
        _err "unknown flag: $1"
        usage >&2
        exit 2
        ;;
    esac
    shift
  done
}

# ----- preflight -------------------------------------------------------------

preflight() {
  if ! command -v claude >/dev/null 2>&1; then
    _warn "claude not on PATH; install per https://docs.claude.com/en/docs/claude-code/quickstart"
  fi

  if [[ -n "${BASH_VERSION:-}" ]]; then
    local major="${BASH_VERSION%%.*}"
    if [[ "${major}" =~ ^[0-9]+$ ]] && (( major < 4 )); then
      _warn "Bash 4+ recommended; running on ${BASH_VERSION}"
    fi
  fi

  if ! command -v jq >/dev/null 2>&1; then
    _err "jq is required. Install: 'brew install jq' (macOS) or 'apt install jq' (Debian/Ubuntu)."
    exit 1
  fi

  if command -v shasum >/dev/null 2>&1; then
    SHA256_CMD="shasum"
  elif command -v sha256sum >/dev/null 2>&1; then
    SHA256_CMD="sha256sum"
  else
    _err "neither 'shasum' nor 'sha256sum' is available; cannot compute SHA-256."
    exit 1
  fi

  if [[ ! -f "${SNIPPET_SRC}" ]]; then
    _err "kit snippet missing at ${SNIPPET_SRC}; broken kit checkout?"
    exit 1
  fi
  if ! jq -e . "${SNIPPET_SRC}" >/dev/null 2>&1; then
    _err "${SNIPPET_SRC} is not valid JSON; broken kit checkout?"
    exit 1
  fi

  if [[ ! -d "${HOOKS_SRC}" ]]; then
    _err "kit hooks directory missing at ${HOOKS_SRC}; broken kit checkout?"
    exit 1
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    [[ -d "${CLAUDE_HOME}" ]] || _dry "would create ${CLAUDE_HOME}"
    [[ -d "${HOOKS_DIR}"   ]] || _dry "would create ${HOOKS_DIR}"
  else
    mkdir -p -- "${CLAUDE_HOME}" "${HOOKS_DIR}"
  fi
}

# ----- backup helper ---------------------------------------------------------
#
# Usage: backup <path>
# If <path> exists, copy it to <path>.bak.<UTC ts>. In dry-run, just announce.
# Records the backup path in BACKUPS_CREATED for the post-install summary.

backup() {
  local target="$1"
  [[ -e "${target}" ]] || return 0
  local ts
  ts="$(_utc_ts)"
  local dest="${target}.bak.${ts}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would back up ${target} -> ${dest}"
    return 0
  fi
  cp -p -- "${target}" "${dest}"
  BACKUPS_CREATED+=("${dest}")
  _say "backed up ${target} -> ${dest}"
}

# ----- hook install state ----------------------------------------------------

# Parallel arrays (Bash 3.2 compatible — no associative arrays).
HOOK_NAMES=()
HOOK_SRC_PATHS=()
HOOK_SRC_SHAS=()
HOOK_ACTIONS=()  # one of: install / skip / overwrite / preserve

# Read manifest's recorded SHA for one source-relative artifact path.
# Echoes the SHA on stdout (empty string if not recorded). Never fails.
_manifest_sha_for() {
  local key="$1"
  [[ -f "${MANIFEST_PATH}" ]] || { printf '\n'; return 0; }
  jq -r --arg k "${key}" '.artifacts[$k] // ""' "${MANIFEST_PATH}" 2>/dev/null || printf '\n'
}

compute_target_state() {
  local src
  for src in "${HOOKS_SRC}"/*.sh; do
    [[ -f "${src}" ]] || continue  # nullglob-equivalent guard
    local name; name="$(basename -- "${src}")"
    local target="${HOOKS_DIR}/${name}"
    local src_sha; src_sha="$(_sha256 "${src}")"

    HOOK_NAMES+=("${name}")
    HOOK_SRC_PATHS+=("${src}")
    HOOK_SRC_SHAS+=("${src_sha}")

    if [[ ! -e "${target}" ]]; then
      HOOK_ACTIONS+=("install")
      continue
    fi

    local target_sha; target_sha="$(_sha256 "${target}")"
    if [[ "${target_sha}" == "${src_sha}" ]]; then
      HOOK_ACTIONS+=("skip")
      continue
    fi

    local manifest_sha; manifest_sha="$(_manifest_sha_for "hooks/${name}")"
    if [[ -n "${manifest_sha}" && "${manifest_sha}" == "${target_sha}" ]]; then
      # Target matches what the kit installed previously -> safe to overwrite.
      HOOK_ACTIONS+=("overwrite")
    else
      # Consumer has edited the file since install (or no manifest record).
      if [[ "${FORCE}" == "true" ]]; then
        HOOK_ACTIONS+=("overwrite")
      else
        HOOK_ACTIONS+=("preserve")
      fi
    fi
  done
}

install_hooks() {
  local i=0
  while (( i < ${#HOOK_NAMES[@]} )); do
    local name="${HOOK_NAMES[i]}"
    local src="${HOOK_SRC_PATHS[i]}"
    local action="${HOOK_ACTIONS[i]}"
    local target="${HOOKS_DIR}/${name}"

    case "${action}" in
      install)
        if [[ "${DRY_RUN}" == "true" ]]; then
          _dry "would install ${name}"
        else
          cp -- "${src}" "${target}"
          chmod +x "${target}"
          CHANGED=true
          _say "installed ${name}"
        fi
        ;;
      overwrite)
        if [[ "${DRY_RUN}" == "true" ]]; then
          _dry "would back up + overwrite ${name}"
        else
          backup "${target}"
          cp -f -- "${src}" "${target}"
          chmod +x "${target}"
          CHANGED=true
          _say "overwrote ${name}"
        fi
        ;;
      preserve)
        _warn "kit hook ${name} has been manually edited; skipping (use --force to overwrite)"
        ;;
      skip)
        _say "up-to-date ${name}"
        ;;
      *)
        _err "internal: unknown action '${action}' for ${name}"
        exit 1
        ;;
    esac
    i=$((i + 1))
  done
}

# ----- settings merge --------------------------------------------------------

read -r -d '' MERGE_PROGRAM <<'JQ' || true
($existing | if type == "object" then . else {} end) as $base
| ($base | if has("hooks") then . else . + {hooks: {}} end) as $base
| ($snippet.hooks // {}) as $snip_hooks
| reduce ($snip_hooks | to_entries[]) as $event ($base;
    .hooks[$event.key] = (
      (.hooks[$event.key] // []) as $existing_event
      | reduce $event.value[] as $snip_entry ($existing_event;
          . as $acc
          | (map(.matcher) | index($snip_entry.matcher)) as $idx
          | if $idx == null then
              . + [$snip_entry]
            else
              ($acc[$idx].hooks // []) as $existing_cmds
              | ($snip_entry.hooks // []) as $snip_cmds
              | ($existing_cmds | map(.command)) as $existing_cmd_strs
              | ($snip_cmds | map(select(.command as $c | $existing_cmd_strs | index($c) | not))) as $new_cmds
              | .[$idx].hooks = ($existing_cmds + $new_cmds)
            end
        )
    )
  )
JQ

merge_settings() {
  local existing snippet merged existing_canon merged_canon
  if [[ -f "${SETTINGS_PATH}" ]]; then
    if ! existing="$(jq -e . "${SETTINGS_PATH}" 2>/dev/null)"; then
      _err "${SETTINGS_PATH} is not valid JSON; aborting (no changes made)"
      exit 1
    fi
  else
    existing='{}'
  fi
  snippet="$(cat -- "${SNIPPET_SRC}")"

  merged="$(jq -n --argjson existing "${existing}" --argjson snippet "${snippet}" "${MERGE_PROGRAM}")"
  existing_canon="$(printf '%s' "${existing}" | jq -S .)"
  merged_canon="$(printf '%s' "${merged}"  | jq -S .)"

  if [[ "${existing_canon}" == "${merged_canon}" ]]; then
    _say "settings.json: up-to-date"
    return 0
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would update ${SETTINGS_PATH}"
    if [[ -f "${SETTINGS_PATH}" ]]; then
      _dry "would back up ${SETTINGS_PATH} -> ${SETTINGS_PATH}.bak.<UTC-ts>"
    fi
    return 0
  fi

  if [[ -f "${SETTINGS_PATH}" ]]; then
    backup "${SETTINGS_PATH}"
  fi
  printf '%s\n' "${merged_canon}" > "${SETTINGS_PATH}.tmp"
  mv -- "${SETTINGS_PATH}.tmp" "${SETTINGS_PATH}"
  CHANGED=true
  _say "settings.json: updated"
}

# ----- manifest --------------------------------------------------------------

write_manifest() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would write ${MANIFEST_PATH}"
    return 0
  fi

  local installed_at; installed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local artifacts_json="{}"
  local i=0
  while (( i < ${#HOOK_NAMES[@]} )); do
    artifacts_json="$(jq -n \
      --argjson cur "${artifacts_json}" \
      --arg key  "hooks/${HOOK_NAMES[i]}" \
      --arg sha  "${HOOK_SRC_SHAS[i]}" \
      '$cur + { ($key): $sha }')"
    i=$((i + 1))
  done

  local manifest
  manifest="$(jq -n \
    --arg version "${KIT_VERSION}" \
    --arg ts      "${installed_at}" \
    --arg source  "${KIT_SOURCE_URL}" \
    --argjson arts "${artifacts_json}" \
    '{kit_version: $version, installed_at: $ts, source: $source, artifacts: $arts}')"

  if [[ -f "${MANIFEST_PATH}" ]]; then
    local prior_canon current_canon
    prior_canon="$(jq -S 'del(.installed_at)' "${MANIFEST_PATH}" 2>/dev/null || printf '{}')"
    current_canon="$(printf '%s' "${manifest}" | jq -S 'del(.installed_at)')"
    if [[ "${prior_canon}" == "${current_canon}" ]]; then
      # Manifest unchanged (modulo timestamp). Skip rewrite for true idempotency.
      return 0
    fi
  fi

  printf '%s\n' "${manifest}" > "${MANIFEST_PATH}.tmp"
  mv -- "${MANIFEST_PATH}.tmp" "${MANIFEST_PATH}"
  CHANGED=true
}

# ----- post-install verification --------------------------------------------

verify_install() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would verify install (skipped in dry-run)"
    return 0
  fi

  local i=0 missing=0 unregistered=0 registered=0
  while (( i < ${#HOOK_NAMES[@]} )); do
    local name="${HOOK_NAMES[i]}"
    local target="${HOOKS_DIR}/${name}"
    if [[ ! -f "${target}" || ! -x "${target}" ]]; then
      _err "hook missing or not executable: ${target}"
      missing=$((missing + 1))
    fi
    # Tilde stays literal: Claude Code expands at hook-execution time.
    # shellcheck disable=SC2088
    local cmd="~/.claude/hooks/${name}"
    if jq -e --arg c "${cmd}" \
        '[.. | objects | select(has("command")) | .command] | index($c) != null' \
        "${SETTINGS_PATH}" >/dev/null 2>&1; then
      registered=$((registered + 1))
    else
      _err "hook not registered in settings.json: ${cmd}"
      unregistered=$((unregistered + 1))
    fi
    i=$((i + 1))
  done

  if (( missing > 0 || unregistered > 0 )); then
    _err "post-install verification failed (${missing} missing, ${unregistered} unregistered)"
    exit 1
  fi

  local backup_summary="none"
  if (( ${#BACKUPS_CREATED[@]} > 0 )); then
    backup_summary="$(printf '%s ' "${BACKUPS_CREATED[@]}")"
    backup_summary="${backup_summary% }"
  fi
  _say "Installed ${#HOOK_NAMES[@]}/${#HOOK_NAMES[@]} hooks. Registered ${registered} hooks. Backups: ${backup_summary}"
}

# ----- main ------------------------------------------------------------------

main() {
  parse_args "$@"
  preflight
  compute_target_state
  install_hooks
  merge_settings
  write_manifest
  verify_install

  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "no changes applied"
  elif [[ "${CHANGED}" == "false" ]]; then
    _say "no changes needed"
  fi
}

main "$@"
