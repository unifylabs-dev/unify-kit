#!/usr/bin/env bash
#
# init-project.sh — install unify-kit v2 templates into a consumer project.
#
# License:       MIT
# Source:        https://github.com/unifylabs-dev/unify-kit
# Sourcing mode: net-new (no upstream lift; original expression).
#
# Companion to the unifylabs-workflow plugin install. Where the plugin gives
# Claude Code access to skills/commands/hooks/statusline machine-wide, this
# script scaffolds per-project artifacts: CLAUDE.md, claude-runtime config,
# GitHub scaffolding, optional templates, compliance profiles, and snippet
# references — applied to a target directory with placeholder substitution.
#
# Idempotent. Backups mandatory. Writes
# <target>/.unify-kit-project-manifest.json for safe re-runs.
#
# Requires Bash 4+ (associative arrays), jq, and shasum or sha256sum.
#
# Tier model (templates/<tier>/):
#   core/             — always applied
#   claude-runtime/   — always applied (.mcp.json + .claude/settings.json)
#   optional/         — opt-in via --include=<name>[,<name>]
#   compliance/       — opt-in via --compliance=<profile>[,<profile>]
#   snippets/         — opt-in via --snippets=<stack>[,<stack>]
#
# Compliance composition:
#   healthcare-phipa  extends  baseline-pipeda
#   financial-canada  extends  baseline-pipeda
#   general-soc2      (independent — framework, not law)
#   When an extender is named without baseline, baseline is auto-prepended.
#   Install order: baseline → extender → general-soc2 (later writes win).
#
# /compliance-research skill writes to docs/compliance/research-notes/ on
# demand. This script creates docs/compliance/ when --compliance is set;
# the skill creates research-notes/ subdir itself if absent.

# Early Bash version check (before any `declare -A` which fails opaquely on
# Bash 3.x). On macOS, install Bash 4+ via `brew install bash` and re-run as
# `/opt/homebrew/bin/bash scripts/init-project.sh ...`.
if [ -n "${BASH_VERSION:-}" ]; then
  _ipsh_major="${BASH_VERSION%%.*}"
  case "${_ipsh_major}" in
    ''|*[!0-9]*) ;;
    *)
      if [ "${_ipsh_major}" -lt 4 ]; then
        cat >&2 <<EOF
ERROR: init-project.sh requires Bash 4+ (running on ${BASH_VERSION}).
  macOS users: install Bash 4+ via 'brew install bash' and invoke as
  '/opt/homebrew/bin/bash scripts/init-project.sh ...'.
EOF
        exit 1
      fi
      ;;
  esac
  unset _ipsh_major
fi

set -euo pipefail
IFS=$'\n\t'

# ----- constants -------------------------------------------------------------

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
KIT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly KIT_ROOT

KIT_VERSION="$(git -C "${KIT_ROOT}" describe --tags --dirty 2>/dev/null || echo "dev")"
readonly KIT_VERSION
readonly KIT_SOURCE_URL="https://github.com/unifylabs-dev/unify-kit"

# core/ tier: always applied. Source (relative to KIT_ROOT) → target (relative to TARGET_DIR).
declare -A CORE_TARGET_MAP=(
  ["templates/core/claude.md.template"]="CLAUDE.md"
  ["templates/core/cheatsheet.md.template"]="CHEATSHEET.md"
  ["templates/core/ai-usage-charter.md.template"]="docs/ai-usage-charter.md"
  ["templates/core/mcp-policy.md.template"]="docs/mcp-policy.md"
  ["templates/core/security-checklist.md"]="docs/security-checklist.md"
  ["templates/core/pull-request-template.md.template"]=".github/pull_request_template.md"
  ["templates/core/issue-templates/feature-request.yml.template"]=".github/ISSUE_TEMPLATE/feature_request.yml"
  ["templates/core/issue-templates/bug-report.yml.template"]=".github/ISSUE_TEMPLATE/bug_report.yml"
  ["templates/core/specs/README.md.template"]="docs/specs/README.md"
  ["templates/core/github/CODEOWNERS.template"]=".github/CODEOWNERS"
)

# Stable iteration order.
CORE_ORDER=(
  "templates/core/claude.md.template"
  "templates/core/cheatsheet.md.template"
  "templates/core/ai-usage-charter.md.template"
  "templates/core/mcp-policy.md.template"
  "templates/core/security-checklist.md"
  "templates/core/pull-request-template.md.template"
  "templates/core/issue-templates/feature-request.yml.template"
  "templates/core/issue-templates/bug-report.yml.template"
  "templates/core/specs/README.md.template"
  "templates/core/github/CODEOWNERS.template"
)

# claude-runtime/ tier: always applied. Per-project Claude Code config.
declare -A CLAUDE_RUNTIME_TARGET_MAP=(
  ["templates/claude-runtime/.mcp.json.template"]=".mcp.json"
  ["templates/claude-runtime/.claude-settings.json.template"]=".claude/settings.json"
)
CLAUDE_RUNTIME_ORDER=(
  "templates/claude-runtime/.mcp.json.template"
  "templates/claude-runtime/.claude-settings.json.template"
)

# optional/ tier: opt-in via --include=<name>. Map flag-name → (source, target).
declare -A OPTIONAL_SOURCE_MAP=(
  ["team-onboarding"]="templates/optional/team-onboarding.md.template"
  ["llms-txt"]="templates/optional/llms.txt.template"
)
declare -A OPTIONAL_TARGET_MAP=(
  ["team-onboarding"]="onboarding/team-onboarding.md"
  ["llms-txt"]="llms.txt"
)

# Compliance extends map: profile → parent (empty if none).
declare -A COMPLIANCE_EXTENDS=(
  ["baseline-pipeda"]=""
  ["healthcare-phipa"]="baseline-pipeda"
  ["financial-canada"]="baseline-pipeda"
  ["general-soc2"]=""
)

# Snippet stacks (informational reference; not installed).
SUPPORTED_SNIPPET_STACKS=("nextjs" "testing" "ci" "none")

# 20 placeholders, in display order.
PLACEHOLDER_ORDER=(
  "PROJECT_NAME"
  "ONE_LINE_DESCRIPTION"
  "REPO_URL"
  "STACK"
  "TEAM_NAME"
  "LANG"
  "LANG_VERSION"
  "FRAMEWORK"
  "DB"
  "KEY_LIBS"
  "ROOT"
  "BUILD_CMD"
  "TEST_CI_CMD"
  "TEST_FULL_CMD"
  "LINT_CMD"
  "TYPECHECK_CMD"
  "DATA_MODEL_PATH"
  "TEST_E2E_DIR"
  "REPO_OWNER"
  "COMPLIANCE_PROFILE"
)

declare -A PLACEHOLDER_DEFAULT=(
  ["PROJECT_NAME"]=""
  ["ONE_LINE_DESCRIPTION"]=""
  ["REPO_URL"]=""
  ["STACK"]="TypeScript + Postgres"
  ["TEAM_NAME"]=""
  ["LANG"]="TypeScript"
  ["LANG_VERSION"]=""
  ["FRAMEWORK"]=""
  ["DB"]=""
  ["KEY_LIBS"]=""
  ["ROOT"]="."
  ["BUILD_CMD"]="npm run build"
  ["TEST_CI_CMD"]="npm test"
  ["TEST_FULL_CMD"]="npm test"
  ["LINT_CMD"]="npm run lint"
  ["TYPECHECK_CMD"]="npm run typecheck"
  ["DATA_MODEL_PATH"]=""
  ["TEST_E2E_DIR"]="tests/e2e/"
  ["REPO_OWNER"]=""
  ["COMPLIANCE_PROFILE"]=""
)

REQUIRED_PLACEHOLDERS=("PROJECT_NAME" "ONE_LINE_DESCRIPTION" "REPO_URL")

# ----- runtime state ---------------------------------------------------------

TARGET_DIR=""
CONFIG_FILE=""
DRY_RUN=false
FORCE=false
SNIPPETS=""             # "" | "none" | "nextjs" | "nextjs,testing" | etc.
COMPLIANCE=""           # "" | "baseline-pipeda" | "baseline-pipeda,general-soc2" | etc.
INCLUDE=""              # "" | "team-onboarding" | "team-onboarding,llms-txt" | etc.
SKIP_LIST=()
SHA256_CMD=""

declare -A PLACEHOLDER_VALUES=()
RESOLVED_COMPLIANCE=()  # ordered, deduped, extends-resolved
RESOLVED_INCLUDES=()    # ordered, deduped
RESOLVED_SNIPPETS=()    # ordered, deduped, "none" filtered

BACKUPS_CREATED=()
INSTALLED_COUNT=0
UP_TO_DATE_COUNT=0
DRYRUN_COUNT=0
SKIPPED_COUNT=0
PRESERVED_COUNT=0
CHANGED=false

# Per-artifact records for manifest assembly.
MANIFEST_SOURCES=()
MANIFEST_TARGETS=()
MANIFEST_SHAS=()
MANIFEST_INSTALLED_AT=()

# Set of target paths already written in THIS run (basename-keyed by absolute
# target path). Used by the extends mechanism: when an extender profile's
# file lands on the same target as a baseline profile's earlier write, we
# treat it as "later writes win" rather than as a manual-edit conflict.
declare -A WRITTEN_THIS_RUN=()

# ----- logging helpers -------------------------------------------------------

_say()  { printf '%s\n' "$*"; }
_dry()  { printf '[dry-run] %s\n' "$*"; }
_warn() { printf 'WARNING: %s\n' "$*" >&2; }
_err()  { printf 'ERROR: %s\n' "$*" >&2; }

# ----- low-level utilities ---------------------------------------------------

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

_utc_ts()  { date -u +%Y%m%dT%H%M%SZ; }
_utc_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Escape a value for safe use as the replacement in `sed s|PAT|REPL|g`.
# We use '|' as the delimiter (so URL slashes don't need escaping). The special
# characters we must escape are '|' (delim), '&' (back-reference), and '\\'.
_sed_replace_escape() {
  printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'
}

# Source has any {{KEY}} token? Returns 0 if yes.
_has_placeholders() {
  grep -qE '\{\{[A-Z][A-Z0-9_]*\}\}' "$1"
}

# ----- usage / arg parser ----------------------------------------------------

usage() {
  cat <<EOF
init-project.sh — install unify-kit v2 templates into a consumer project.

Usage:
  init-project.sh <target-dir> [flags]

Flags:
  --config <yaml>             Load 20-placeholder values from a flat-scalar
                              YAML file (skips interactive prompts).
  --dry-run                   Preview every change. Writes nothing.
  --force                     Overwrite consumer-edited targets. Backups still
                              created.
  --skip <list>               Comma-separated source-relative paths or basenames
                              to exclude. Repeatable.
  --compliance=<list>         Comma-separated compliance profile slugs from
                              templates/compliance/profiles/. Supported:
                              baseline-pipeda, healthcare-phipa,
                              financial-canada, general-soc2.
                              Extenders auto-prepend baseline.
  --include=<list>            Comma-separated optional templates from
                              templates/optional/. Supported: team-onboarding,
                              llms-txt.
  --snippets=<list>           Comma-separated snippet stacks for the CLAUDE.md
                              snippets reference. Supported: nextjs, testing,
                              ci, none. Files stay in templates/snippets/;
                              consumer references them by path.
  --help, -h                  Print this message and exit 0.

Positional:
  <target-dir>                Project directory to install into. Must exist.

What it does:
  1. Pre-flight: checks jq + SHA-256 tool + kit checkout integrity.
  2. Collects 20 placeholder values (interactive prompts OR --config YAML).
  3. Applies core/ (10 templates) and claude-runtime/ (2 templates) — always.
  4. Applies any --include=<name> from optional/.
  5. Applies any --compliance=<profile> from compliance/profiles/ in install
     order (baseline → extender → general-soc2). Each profile's docs land
     under <target>/docs/compliance/; runbooks under <target>/runbooks/;
     claude-md-addendum appended to <target>/CLAUDE.md.
  6. Rewrites cross-profile relative links during compliance install.
  7. Writes <target>/.unify-kit-project-manifest.json with SHA-256 + the
     applied compliance_profiles / includes / snippets lists.

Idempotent: re-running on a clean install reports "no changes needed".

Examples:
  # Greenfield Ontario healthcare project on Next.js:
  init-project.sh ./my-clinic --config my-config.yml \\
    --compliance=healthcare-phipa --snippets=nextjs

  # Canadian fintech doing enterprise sales:
  init-project.sh ./my-fintech --config my-config.yml \\
    --compliance=financial-canada,general-soc2 --snippets=nextjs,testing

  # Existing project, no compliance, just core scaffolding:
  cd ./existing-project && init-project.sh . --config my-config.yml

Source:  ${KIT_SOURCE_URL}
License: MIT
Version: ${KIT_VERSION}
EOF
}

_parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)          DRY_RUN=true ;;
      --force)            FORCE=true ;;
      --help|-h)          usage; exit 0 ;;
      --config)
        [[ $# -ge 2 ]] || { _err "--config requires a path"; exit 2; }
        CONFIG_FILE="$2"
        shift
        ;;
      --config=*)
        CONFIG_FILE="${1#--config=}"
        ;;
      --snippets)
        [[ $# -ge 2 ]] || { _err "--snippets requires a value"; exit 2; }
        SNIPPETS="$2"
        shift
        ;;
      --snippets=*)
        SNIPPETS="${1#--snippets=}"
        ;;
      --compliance)
        [[ $# -ge 2 ]] || { _err "--compliance requires a value"; exit 2; }
        COMPLIANCE="$2"
        shift
        ;;
      --compliance=*)
        COMPLIANCE="${1#--compliance=}"
        ;;
      --include)
        [[ $# -ge 2 ]] || { _err "--include requires a value"; exit 2; }
        INCLUDE="$2"
        shift
        ;;
      --include=*)
        INCLUDE="${1#--include=}"
        ;;
      --skip)
        [[ $# -ge 2 ]] || { _err "--skip requires a value"; exit 2; }
        local val="$2"
        IFS=',' read -r -a parts <<< "$val"
        for p in "${parts[@]}"; do
          [[ -n "$p" ]] && SKIP_LIST+=("$p")
        done
        shift
        ;;
      --skip=*)
        local val="${1#--skip=}"
        IFS=',' read -r -a parts <<< "$val"
        for p in "${parts[@]}"; do
          [[ -n "$p" ]] && SKIP_LIST+=("$p")
        done
        ;;
      --*)
        _err "unknown flag: $1"
        usage >&2
        exit 2
        ;;
      *)
        if [[ -z "${TARGET_DIR}" ]]; then
          TARGET_DIR="$1"
        else
          _err "unexpected positional argument: $1 (target-dir already set to ${TARGET_DIR})"
          exit 2
        fi
        ;;
    esac
    shift
  done

  if [[ -z "${TARGET_DIR}" ]]; then
    _err "missing <target-dir>"
    usage >&2
    exit 2
  fi
}

# Resolve --compliance comma-list to ordered, deduped, extends-resolved array.
# Rules:
#   - Each input token must be a known profile slug.
#   - If any input has extends:<parent>, prepend parent if absent.
#   - Deduplicate preserving first occurrence (so user order is mostly respected,
#     with the exception that extends-baseline always precedes extenders).
_resolve_compliance() {
  RESOLVED_COMPLIANCE=()
  [[ -z "${COMPLIANCE}" ]] && return 0

  local raw=()
  IFS=',' read -r -a raw <<< "${COMPLIANCE}"

  # Validate each token.
  local p
  for p in "${raw[@]}"; do
    [[ -z "$p" ]] && continue
    if [[ -z "${COMPLIANCE_EXTENDS[$p]+x}" ]]; then
      _err "unknown compliance profile: '${p}' (supported: ${!COMPLIANCE_EXTENDS[*]})"
      exit 2
    fi
    if [[ ! -d "${KIT_ROOT}/templates/compliance/profiles/${p}" ]]; then
      _err "compliance profile dir not found: templates/compliance/profiles/${p}"
      exit 2
    fi
  done

  # Build resolution: for each token, ensure parent exists first.
  local out=()
  local seen
  declare -A seen=()
  for p in "${raw[@]}"; do
    [[ -z "$p" ]] && continue
    local parent="${COMPLIANCE_EXTENDS[$p]}"
    if [[ -n "$parent" && -z "${seen[$parent]+x}" ]]; then
      out+=("$parent")
      seen["$parent"]=1
    fi
    if [[ -z "${seen[$p]+x}" ]]; then
      out+=("$p")
      seen["$p"]=1
    fi
  done

  RESOLVED_COMPLIANCE=("${out[@]}")
}

_resolve_includes() {
  RESOLVED_INCLUDES=()
  [[ -z "${INCLUDE}" ]] && return 0

  local raw=()
  IFS=',' read -r -a raw <<< "${INCLUDE}"

  local n
  for n in "${raw[@]}"; do
    [[ -z "$n" ]] && continue
    if [[ -z "${OPTIONAL_SOURCE_MAP[$n]+x}" ]]; then
      _err "unknown --include value: '${n}' (supported: ${!OPTIONAL_SOURCE_MAP[*]})"
      exit 2
    fi
    RESOLVED_INCLUDES+=("$n")
  done
}

_resolve_snippets() {
  RESOLVED_SNIPPETS=()
  [[ -z "${SNIPPETS}" ]] && return 0

  local raw=()
  IFS=',' read -r -a raw <<< "${SNIPPETS}"

  local s
  for s in "${raw[@]}"; do
    [[ -z "$s" ]] && continue
    local supported=0
    local x
    for x in "${SUPPORTED_SNIPPET_STACKS[@]}"; do
      [[ "$x" == "$s" ]] && supported=1 && break
    done
    if [[ "$supported" -eq 0 ]]; then
      _err "unsupported --snippets value: '${s}' (supported: ${SUPPORTED_SNIPPET_STACKS[*]})"
      exit 2
    fi
    # 'none' is a no-op sentinel; skip from resolved list.
    [[ "$s" == "none" ]] && continue
    RESOLVED_SNIPPETS+=("$s")
  done
}

# ----- preflight -------------------------------------------------------------

_preflight() {
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

  if [[ -n "${BASH_VERSION:-}" ]]; then
    local major="${BASH_VERSION%%.*}"
    if [[ "${major}" =~ ^[0-9]+$ ]] && (( major < 4 )); then
      _err "Bash 4+ required (running on ${BASH_VERSION}). Associative arrays are used throughout."
      exit 1
    fi
  fi

  # Verify kit checkout integrity: core/ + claude-runtime/ source files must exist.
  local expected=()
  expected+=("${CORE_ORDER[@]}")
  expected+=("${CLAUDE_RUNTIME_ORDER[@]}")

  local missing=()
  local rel
  for rel in "${expected[@]}"; do
    if [[ ! -f "${KIT_ROOT}/${rel}" ]]; then
      missing+=("${rel}")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    _err "broken kit checkout — missing source files:"
    local m
    for m in "${missing[@]}"; do
      printf '  - %s\n' "${m}" >&2
    done
    exit 1
  fi

  # Resolve target directory. Must exist.
  if [[ ! -d "${TARGET_DIR}" ]]; then
    _err "target directory does not exist: ${TARGET_DIR}"
    exit 1
  fi
  TARGET_DIR="$(cd -- "${TARGET_DIR}" && pwd)"
  readonly TARGET_DIR

  if [[ ! -w "${TARGET_DIR}" ]]; then
    _err "target directory not writable: ${TARGET_DIR}"
    exit 1
  fi

  # Config file (if specified) must exist.
  if [[ -n "${CONFIG_FILE}" && ! -f "${CONFIG_FILE}" ]]; then
    _err "config file not found: ${CONFIG_FILE}"
    exit 1
  fi

  _resolve_compliance
  _resolve_includes
  _resolve_snippets
}

# ----- placeholder collection ------------------------------------------------

_load_config_yaml() {
  local path="$1"
  local lineno=0
  local key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    lineno=$((lineno + 1))
    line="${line%$'\r'}"
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    if [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*):[[:space:]]*(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      if [[ "${value}" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi
      if [[ "${value}" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi
      PLACEHOLDER_VALUES["${key}"]="${value}"
    else
      _err "${path}:${lineno}: malformed line (expected 'KEY: value'): ${line}"
      exit 1
    fi
  done < "${path}"
}

_prompt_placeholders() {
  if [[ ! -t 0 ]]; then
    _err "no --config given and stdin is not a TTY; cannot prompt for placeholders interactively."
    _err "pass --config <yaml> or run from a terminal."
    exit 1
  fi
  _say "Collecting ${#PLACEHOLDER_ORDER[@]} placeholder values. Press Enter to accept the default."
  _say ""
  local key default value
  for key in "${PLACEHOLDER_ORDER[@]}"; do
    default="${PLACEHOLDER_DEFAULT[${key}]}"
    local required="no"
    for req in "${REQUIRED_PLACEHOLDERS[@]}"; do
      [[ "$req" == "$key" ]] && required="yes"
    done
    while :; do
      if [[ -n "${default}" ]]; then
        read -r -p "  ${key} [${default}]: " value
      elif [[ "${required}" == "yes" ]]; then
        read -r -p "  ${key} (required): " value
      else
        read -r -p "  ${key}: " value
      fi
      [[ -z "${value}" ]] && value="${default}"
      if [[ "${required}" == "yes" && -z "${value}" ]]; then
        _warn "${key} is required"
        continue
      fi
      PLACEHOLDER_VALUES["${key}"]="${value}"
      break
    done
  done
  _say ""
}

_collect_placeholders() {
  if [[ -n "${CONFIG_FILE}" ]]; then
    _load_config_yaml "${CONFIG_FILE}"
  else
    _prompt_placeholders
  fi

  local key
  for key in "${PLACEHOLDER_ORDER[@]}"; do
    if [[ -z "${PLACEHOLDER_VALUES[${key}]+x}" ]]; then
      PLACEHOLDER_VALUES["${key}"]="${PLACEHOLDER_DEFAULT[${key}]}"
    fi
  done

  # Auto-fill COMPLIANCE_PROFILE from resolved profiles if user didn't override.
  if [[ -z "${PLACEHOLDER_VALUES[COMPLIANCE_PROFILE]}" && ${#RESOLVED_COMPLIANCE[@]} -gt 0 ]]; then
    local joined
    joined="$(IFS=','; echo "${RESOLVED_COMPLIANCE[*]}")"
    PLACEHOLDER_VALUES["COMPLIANCE_PROFILE"]="${joined}"
  fi

  local missing=()
  for key in "${REQUIRED_PLACEHOLDERS[@]}"; do
    if [[ -z "${PLACEHOLDER_VALUES[${key}]}" ]]; then
      missing+=("${key}")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    _err "required placeholders are empty: ${missing[*]}"
    exit 1
  fi
}

# ----- substitution + link rewrite ------------------------------------------

_substitute_file() {
  local src="$1" dest="$2"
  local sed_args=()
  local key value escaped
  for key in "${PLACEHOLDER_ORDER[@]}"; do
    value="${PLACEHOLDER_VALUES[${key}]}"
    escaped="$(_sed_replace_escape "${value}")"
    sed_args+=(-e "s|{{${key}}}|${escaped}|g")
  done
  sed "${sed_args[@]}" "${src}" > "${dest}"

  local leftover
  leftover="$(grep -oE '\{\{[A-Z][A-Z0-9_]*\}\}' "${dest}" | sort -u || true)"
  if [[ -n "${leftover}" ]]; then
    _err "${src}: unsubstituted placeholders remain after substitution:"
    printf '%s\n' "${leftover}" | sed 's/^/  /' >&2
    rm -f -- "${dest}"
    exit 1
  fi
}

# Rewrite cross-profile relative links during compliance install. Source-tree
# uses `../../<profile>/<dir>/<file>` to point at sibling profile content; in
# the consumer's installed tree those dirs flatten into `docs/compliance/` and
# `runbooks/`. Only rewrites when applied to a destination that already
# exists (avoids mangling unrelated content).
_rewrite_compliance_links() {
  local dest="$1"
  [[ -f "${dest}" ]] || return 0
  # Cross-profile (any sibling profile slug) → flat consumer paths.
  sed -i.linkrw.bak \
    -e 's|\.\./\.\./[a-z0-9][a-z0-9-]*/runbooks/|runbooks/|g' \
    -e 's|\.\./\.\./[a-z0-9][a-z0-9-]*/docs/compliance/|docs/compliance/|g' \
    -e 's|\.\./\.\./runbooks/|runbooks/|g' \
    -e 's|\.\./\.\./docs/compliance/|docs/compliance/|g' \
    "${dest}"
  rm -f -- "${dest}.linkrw.bak"
}

# ----- backup ----------------------------------------------------------------

_backup() {
  local target="$1"
  [[ -e "${target}" ]] || return 0
  local ts dest
  ts="$(_utc_ts)"
  dest="${target}.bak.${ts}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would back up ${target} -> ${dest}"
    return 0
  fi
  cp -p -- "${target}" "${dest}"
  BACKUPS_CREATED+=("${dest}")
  _say "backed up ${target} -> ${dest}"
}

# ----- manifest helpers (read prior state) -----------------------------------

readonly MANIFEST_REL=".unify-kit-project-manifest.json"

_manifest_path() {
  printf '%s/%s' "${TARGET_DIR}" "${MANIFEST_REL}"
}

_manifest_artifact_field() {
  local key="$1" field="$2"
  local path; path="$(_manifest_path)"
  [[ -f "${path}" ]] || { printf ''; return 0; }
  jq -r --arg k "${key}" --arg f "${field}" '
    .artifacts[$k] // {} | .[$f] // ""
  ' "${path}" 2>/dev/null || printf ''
}

_manifest_top_installed_at() {
  local path; path="$(_manifest_path)"
  [[ -f "${path}" ]] || { printf ''; return 0; }
  jq -r '.installed_at // ""' "${path}" 2>/dev/null || printf ''
}

# Returns 0 if ANY manifest artifact entry has the given target path with the
# given SHA. Used to detect kit-installed files that arrived via a different
# source path (e.g., baseline + extender composition writing the same target).
_manifest_has_target_with_sha() {
  local target="$1" sha="$2"
  local path; path="$(_manifest_path)"
  [[ -f "${path}" ]] || return 1
  jq -e --arg t "${target}" --arg s "${sha}" '
    .artifacts | to_entries
    | any(.value.target == $t and .value.sha256 == $s)
  ' "${path}" >/dev/null 2>&1
}

# Returns 0 if the file contains a compliance-addendum marker for the named
# profile. Lets the install loop detect that CLAUDE.md was kit-mutated post-
# install (and therefore is still kit-owned, not user-edited).
_has_addendum_marker() {
  local file="$1" profile="$2"
  [[ -f "${file}" ]] || return 1
  grep -qF "<!-- compliance-addendum:${profile} -->" "${file}"
}

# ----- skip-list check -------------------------------------------------------

_is_skipped() {
  local src="$1"
  local base; base="$(basename -- "${src}")"
  local item
  for item in "${SKIP_LIST[@]:-}"; do
    [[ -z "$item" ]] && continue
    if [[ "${item}" == "${src}" || "${item}" == "${base}" ]]; then
      return 0
    fi
  done
  return 1
}

# ----- install one artifact --------------------------------------------------

# Args: <source-relative-path> <target-relative-path> [substitute|copy] [rewrite|no-rewrite]
_install_artifact() {
  local src_rel="$1" tgt_rel="$2" mode="${3:-auto}" rewrite="${4:-no-rewrite}"
  local src_abs="${KIT_ROOT}/${src_rel}"
  local tgt_abs="${TARGET_DIR}/${tgt_rel}"
  local tgt_dir; tgt_dir="$(dirname -- "${tgt_abs}")"
  local tmp="${tgt_abs}.tmp.$$"

  if _is_skipped "${src_rel}"; then
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    _say "skipped ${tgt_rel} (--skip)"
    return 0
  fi

  if [[ "${mode}" == "auto" ]]; then
    if _has_placeholders "${src_abs}"; then
      mode="substitute"
    else
      mode="copy"
    fi
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    if [[ -e "${tgt_abs}" ]]; then
      _dry "would back up + overwrite ${tgt_rel}"
    else
      _dry "would install ${tgt_rel}"
    fi
    DRYRUN_COUNT=$((DRYRUN_COUNT + 1))
    return 0
  fi

  mkdir -p -- "${tgt_dir}"

  if [[ "${mode}" == "substitute" ]]; then
    _substitute_file "${src_abs}" "${tmp}"
  else
    cp -- "${src_abs}" "${tmp}"
  fi

  if [[ "${rewrite}" == "rewrite" ]]; then
    _rewrite_compliance_links "${tmp}"
  fi

  local kit_sha; kit_sha="$(_sha256 "${tmp}")"
  local now; now="$(_utc_iso)"

  if [[ ! -e "${tgt_abs}" ]]; then
    mv -- "${tmp}" "${tgt_abs}"
    chmod 0644 "${tgt_abs}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    CHANGED=true
    _say "installed ${tgt_rel}"
    MANIFEST_SOURCES+=("${src_rel}")
    MANIFEST_TARGETS+=("${tgt_rel}")
    MANIFEST_SHAS+=("${kit_sha}")
    MANIFEST_INSTALLED_AT+=("${now}")
    WRITTEN_THIS_RUN["${tgt_abs}"]=1
    return 0
  fi

  local tgt_sha; tgt_sha="$(_sha256 "${tgt_abs}")"
  if [[ "${tgt_sha}" == "${kit_sha}" ]]; then
    rm -f -- "${tmp}"
    UP_TO_DATE_COUNT=$((UP_TO_DATE_COUNT + 1))
    WRITTEN_THIS_RUN["${tgt_abs}"]=1
    _say "up-to-date ${tgt_rel}"
    local prior_at; prior_at="$(_manifest_artifact_field "${src_rel}" "installed_at")"
    [[ -z "${prior_at}" ]] && prior_at="${now}"
    MANIFEST_SOURCES+=("${src_rel}")
    MANIFEST_TARGETS+=("${tgt_rel}")
    MANIFEST_SHAS+=("${kit_sha}")
    MANIFEST_INSTALLED_AT+=("${prior_at}")
    return 0
  fi

  local manifest_sha; manifest_sha="$(_manifest_artifact_field "${src_rel}" "sha256")"
  local can_safely_overwrite=false
  if [[ -n "${manifest_sha}" && "${manifest_sha}" == "${tgt_sha}" ]]; then
    can_safely_overwrite=true
  fi
  # Cross-source check: target may have been written by a sibling source path
  # earlier (compliance composition writes the same target from multiple
  # profiles). If any manifest entry records this target with the current
  # target sha, the kit owns the file — safe to overwrite without --force.
  if [[ "${can_safely_overwrite}" != "true" ]] \
    && _manifest_has_target_with_sha "${tgt_rel}" "${tgt_sha}"; then
    can_safely_overwrite=true
  fi
  # Compose / extends: if we already wrote this target earlier in this run
  # (e.g., baseline-pipeda installing first, then healthcare-phipa
  # overwriting with the extender's version), let the later write win.
  local within_run=false
  if [[ -n "${WRITTEN_THIS_RUN[${tgt_abs}]+x}" ]]; then
    within_run=true
  fi

  if [[ "${can_safely_overwrite}" == "true" || "${FORCE}" == "true" || "${within_run}" == "true" ]]; then
    # Only back up when --force is overriding a real user edit. Within-run
    # overwrites (extends mechanism) and kit-owned content (manifest sha
    # matches target sha via same or sibling source) are kit-managed and
    # don't represent user work worth preserving.
    if [[ "${FORCE}" == "true" && "${can_safely_overwrite}" != "true" && "${within_run}" != "true" ]]; then
      _backup "${tgt_abs}"
    fi
    mv -f -- "${tmp}" "${tgt_abs}"
    chmod 0644 "${tgt_abs}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    CHANGED=true
    WRITTEN_THIS_RUN["${tgt_abs}"]=1
    if [[ "${within_run}" == "true" ]]; then
      _say "composed ${tgt_rel} (extends overwrite)"
    elif [[ "${can_safely_overwrite}" == "true" ]]; then
      _say "refreshed ${tgt_rel}"
    else
      _say "overwrote ${tgt_rel}"
    fi
    local prior_at; prior_at="$(_manifest_artifact_field "${src_rel}" "installed_at")"
    [[ -z "${prior_at}" ]] && prior_at="${now}"
    MANIFEST_SOURCES+=("${src_rel}")
    MANIFEST_TARGETS+=("${tgt_rel}")
    MANIFEST_SHAS+=("${kit_sha}")
    MANIFEST_INSTALLED_AT+=("${prior_at}")
  else
    rm -f -- "${tmp}"
    PRESERVED_COUNT=$((PRESERVED_COUNT + 1))
    _warn "${tgt_rel} has been manually edited; preserved (use --force to overwrite)"
    local prior_target prior_sha prior_at
    prior_target="$(_manifest_artifact_field "${src_rel}" "target")"
    prior_sha="$(_manifest_artifact_field "${src_rel}" "sha256")"
    prior_at="$(_manifest_artifact_field "${src_rel}" "installed_at")"
    if [[ -n "${prior_sha}" ]]; then
      MANIFEST_SOURCES+=("${src_rel}")
      MANIFEST_TARGETS+=("${prior_target:-${tgt_rel}}")
      MANIFEST_SHAS+=("${prior_sha}")
      MANIFEST_INSTALLED_AT+=("${prior_at}")
    fi
  fi
}

# Map a profile-source-file path to its consumer-side target path.
# Examples:
#   templates/compliance/profiles/baseline-pipeda/docs/compliance/breach-response.md.template
#     → docs/compliance/breach-response.md
#   templates/compliance/profiles/baseline-pipeda/runbooks/access-revocation.md.template
#     → runbooks/access-revocation.md
_compliance_target_for() {
  local src_rel="$1"
  local base; base="$(basename -- "${src_rel}")"
  base="${base%.template}"
  case "${src_rel}" in
    */docs/compliance/*) printf 'docs/compliance/%s' "${base}" ;;
    */runbooks/*)        printf 'runbooks/%s' "${base}" ;;
    *)
      _err "internal: unexpected compliance file path: ${src_rel}"
      exit 1
      ;;
  esac
}

# Emit the combined CLAUDE.md content (substituted core template + all active
# compliance profiles' addenda, in install order) to stdout. Used by the
# CLAUDE.md installer so the SHA accounts for the addenda upfront — making
# idempotent re-runs detect "no change" correctly.
_emit_claude_md_with_addenda() {
  local core_src="${KIT_ROOT}/templates/core/claude.md.template"
  local sed_args=()
  local key value escaped
  for key in "${PLACEHOLDER_ORDER[@]}"; do
    value="${PLACEHOLDER_VALUES[${key}]}"
    escaped="$(_sed_replace_escape "${value}")"
    sed_args+=(-e "s|{{${key}}}|${escaped}|g")
  done

  # Bare CLAUDE.md from core.
  sed "${sed_args[@]}" "${core_src}"

  # Each active compliance profile's addendum, separated by a horizontal rule
  # and tagged with a stable marker.
  local profile addendum_src
  for profile in "${RESOLVED_COMPLIANCE[@]:-}"; do
    [[ -z "${profile}" ]] && continue
    addendum_src="${KIT_ROOT}/templates/compliance/profiles/${profile}/claude-md-addendum.md"
    [[ -f "${addendum_src}" ]] || continue
    printf '\n\n---\n\n<!-- compliance-addendum:%s -->\n\n' "${profile}"
    sed "${sed_args[@]}" "${addendum_src}"
  done
}

# Specialized installer for CLAUDE.md: composes core template + active
# compliance addenda into a single file before SHA compare. This keeps the
# manifest's sha accurate across re-runs (vs. mutating CLAUDE.md post-install,
# which would make the manifest sha drift from the on-disk content).
_install_claude_md() {
  local src_rel="templates/core/claude.md.template"
  local tgt_rel="CLAUDE.md"
  local tgt_abs="${TARGET_DIR}/${tgt_rel}"
  local tmp="${tgt_abs}.tmp.$$"

  if _is_skipped "${src_rel}"; then
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    _say "skipped CLAUDE.md (--skip)"
    return 0
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    if [[ -e "${tgt_abs}" ]]; then
      _dry "would back up + overwrite CLAUDE.md (incl. compliance addenda)"
    else
      _dry "would install CLAUDE.md (incl. compliance addenda)"
    fi
    DRYRUN_COUNT=$((DRYRUN_COUNT + 1))
    return 0
  fi

  _emit_claude_md_with_addenda > "${tmp}"

  # Verify substitution complete.
  local leftover
  leftover="$(grep -oE '\{\{[A-Z][A-Z0-9_]*\}\}' "${tmp}" | sort -u || true)"
  if [[ -n "${leftover}" ]]; then
    _err "CLAUDE.md: unsubstituted placeholders remain:"
    printf '%s\n' "${leftover}" | sed 's/^/  /' >&2
    rm -f -- "${tmp}"
    exit 1
  fi

  local kit_sha; kit_sha="$(_sha256 "${tmp}")"
  local now; now="$(_utc_iso)"

  if [[ ! -e "${tgt_abs}" ]]; then
    mv -- "${tmp}" "${tgt_abs}"
    chmod 0644 "${tgt_abs}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    CHANGED=true
    _say "installed CLAUDE.md (incl. ${#RESOLVED_COMPLIANCE[@]} compliance addendum/a)"
    MANIFEST_SOURCES+=("${src_rel}")
    MANIFEST_TARGETS+=("${tgt_rel}")
    MANIFEST_SHAS+=("${kit_sha}")
    MANIFEST_INSTALLED_AT+=("${now}")
    WRITTEN_THIS_RUN["${tgt_abs}"]=1
    return 0
  fi

  local tgt_sha; tgt_sha="$(_sha256 "${tgt_abs}")"
  if [[ "${tgt_sha}" == "${kit_sha}" ]]; then
    rm -f -- "${tmp}"
    UP_TO_DATE_COUNT=$((UP_TO_DATE_COUNT + 1))
    WRITTEN_THIS_RUN["${tgt_abs}"]=1
    _say "up-to-date CLAUDE.md"
    local prior_at; prior_at="$(_manifest_artifact_field "${src_rel}" "installed_at")"
    [[ -z "${prior_at}" ]] && prior_at="${now}"
    MANIFEST_SOURCES+=("${src_rel}")
    MANIFEST_TARGETS+=("${tgt_rel}")
    MANIFEST_SHAS+=("${kit_sha}")
    MANIFEST_INSTALLED_AT+=("${prior_at}")
    return 0
  fi

  local manifest_sha; manifest_sha="$(_manifest_artifact_field "${src_rel}" "sha256")"
  local can_safely_overwrite=false
  if [[ -n "${manifest_sha}" && "${manifest_sha}" == "${tgt_sha}" ]]; then
    can_safely_overwrite=true
  fi

  if [[ "${can_safely_overwrite}" == "true" || "${FORCE}" == "true" ]]; then
    if [[ "${FORCE}" == "true" && "${can_safely_overwrite}" != "true" ]]; then
      _backup "${tgt_abs}"
    fi
    mv -f -- "${tmp}" "${tgt_abs}"
    chmod 0644 "${tgt_abs}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    CHANGED=true
    WRITTEN_THIS_RUN["${tgt_abs}"]=1
    if [[ "${can_safely_overwrite}" == "true" ]]; then
      _say "refreshed CLAUDE.md"
    else
      _say "overwrote CLAUDE.md"
    fi
    MANIFEST_SOURCES+=("${src_rel}")
    MANIFEST_TARGETS+=("${tgt_rel}")
    MANIFEST_SHAS+=("${kit_sha}")
    MANIFEST_INSTALLED_AT+=("${now}")
  else
    rm -f -- "${tmp}"
    PRESERVED_COUNT=$((PRESERVED_COUNT + 1))
    _warn "CLAUDE.md has been manually edited; preserved (use --force to overwrite)"
    local prior_sha prior_at
    prior_sha="$(_manifest_artifact_field "${src_rel}" "sha256")"
    prior_at="$(_manifest_artifact_field "${src_rel}" "installed_at")"
    if [[ -n "${prior_sha}" ]]; then
      MANIFEST_SOURCES+=("${src_rel}")
      MANIFEST_TARGETS+=("${tgt_rel}")
      MANIFEST_SHAS+=("${prior_sha}")
      MANIFEST_INSTALLED_AT+=("${prior_at}")
    fi
  fi
}

# ----- install groups --------------------------------------------------------

_install_core() {
  # CLAUDE.md handled separately (composes with compliance addenda upfront).
  local src
  for src in "${CORE_ORDER[@]}"; do
    [[ "${src}" == "templates/core/claude.md.template" ]] && continue
    local tgt="${CORE_TARGET_MAP[${src}]}"
    _install_artifact "${src}" "${tgt}"
  done
}

_install_claude_runtime() {
  local src
  for src in "${CLAUDE_RUNTIME_ORDER[@]}"; do
    local tgt="${CLAUDE_RUNTIME_TARGET_MAP[${src}]}"
    _install_artifact "${src}" "${tgt}"
  done
}

_install_includes() {
  (( ${#RESOLVED_INCLUDES[@]} == 0 )) && return 0
  local n src tgt
  for n in "${RESOLVED_INCLUDES[@]}"; do
    src="${OPTIONAL_SOURCE_MAP[$n]}"
    tgt="${OPTIONAL_TARGET_MAP[$n]}"
    _install_artifact "${src}" "${tgt}"
  done
}

_install_compliance() {
  (( ${#RESOLVED_COMPLIANCE[@]} == 0 )) && return 0
  local profile profile_dir f tgt
  for profile in "${RESOLVED_COMPLIANCE[@]}"; do
    profile_dir="templates/compliance/profiles/${profile}"
    # Iterate every .md / .md.template under docs/compliance/ + runbooks/.
    local found_any=false
    local _find_dirs=()
    [[ -d "${KIT_ROOT}/${profile_dir}/docs/compliance" ]] && _find_dirs+=("${KIT_ROOT}/${profile_dir}/docs/compliance")
    [[ -d "${KIT_ROOT}/${profile_dir}/runbooks" ]] && _find_dirs+=("${KIT_ROOT}/${profile_dir}/runbooks")
    if (( ${#_find_dirs[@]} == 0 )); then
      _warn "compliance profile ${profile}: no docs/compliance or runbooks subdir under ${profile_dir}; nothing to install"
      continue
    fi

    local _list_tmp
    _list_tmp="$(mktemp)"
    if ! find "${_find_dirs[@]}" -type f \( -name '*.md' -o -name '*.md.template' \) > "${_list_tmp}"; then
      _err "find failed enumerating ${profile_dir} content"
      rm -f -- "${_list_tmp}"
      exit 1
    fi

    while IFS= read -r f; do
      [[ -z "${f}" ]] && continue
      tgt="$(_compliance_target_for "${f}")"
      _install_artifact "${f}" "${tgt}" "auto" "rewrite"
      found_any=true
    done < <(sed -e "s|^${KIT_ROOT}/||" "${_list_tmp}" | sort)
    rm -f -- "${_list_tmp}"
    if [[ "${found_any}" == "false" ]]; then
      _warn "compliance profile ${profile}: no docs/compliance or runbooks content"
    fi
    # claude-md addendum is baked into CLAUDE.md by _install_claude_md (called
    # earlier in main); no separate post-install append needed.
  done
}

# ----- manifest write --------------------------------------------------------

_write_manifest() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    _dry "would write ${MANIFEST_REL}"
    return 0
  fi

  local manifest_abs; manifest_abs="$(_manifest_path)"
  local top_installed_at; top_installed_at="$(_manifest_top_installed_at)"
  [[ -z "${top_installed_at}" ]] && top_installed_at="$(_utc_iso)"

  local artifacts="{}"
  local i=0
  while (( i < ${#MANIFEST_SOURCES[@]} )); do
    artifacts="$(jq -n \
      --argjson cur "${artifacts}" \
      --arg key  "${MANIFEST_SOURCES[i]}" \
      --arg tgt  "${MANIFEST_TARGETS[i]}" \
      --arg sha  "${MANIFEST_SHAS[i]}" \
      --arg at   "${MANIFEST_INSTALLED_AT[i]}" \
      '$cur + { ($key): { target: $tgt, sha256: $sha, installed_at: $at } }')"
    i=$((i + 1))
  done

  local compliance_json includes_json snippets_json
  compliance_json="$(printf '%s\n' "${RESOLVED_COMPLIANCE[@]:-}" | jq -R . | jq -s 'map(select(length > 0))')"
  includes_json="$(printf '%s\n' "${RESOLVED_INCLUDES[@]:-}" | jq -R . | jq -s 'map(select(length > 0))')"
  snippets_json="$(printf '%s\n' "${RESOLVED_SNIPPETS[@]:-}" | jq -R . | jq -s 'map(select(length > 0))')"

  local manifest
  manifest="$(jq -nS \
    --arg version "${KIT_VERSION}" \
    --arg ts      "${top_installed_at}" \
    --arg source  "${KIT_SOURCE_URL}" \
    --argjson comp "${compliance_json}" \
    --argjson inc  "${includes_json}" \
    --argjson sni  "${snippets_json}" \
    --argjson arts "${artifacts}" \
    '{kit_version: $version, installed_at: $ts, source: $source,
      compliance_profiles: $comp, includes: $inc, snippets: $sni,
      artifacts: $arts}')"

  if [[ -f "${manifest_abs}" ]]; then
    local prior_canon current_canon
    prior_canon="$(jq -S 'del(.installed_at) | .artifacts |= (with_entries(.value |= del(.installed_at)))' "${manifest_abs}" 2>/dev/null || printf '{}')"
    current_canon="$(printf '%s' "${manifest}" | jq -S 'del(.installed_at) | .artifacts |= (with_entries(.value |= del(.installed_at)))')"
    if [[ "${prior_canon}" == "${current_canon}" ]]; then
      return 0
    fi
  fi

  printf '%s\n' "${manifest}" > "${manifest_abs}.tmp"
  mv -- "${manifest_abs}.tmp" "${manifest_abs}"
  CHANGED=true
}

# ----- follow-up + summary ---------------------------------------------------

_print_followup() {
  local snippets_note=""
  if (( ${#RESOLVED_SNIPPETS[@]} > 0 )); then
    snippets_note="$(printf '\n  Snippet stacks referenced: %s\n  Snippet sources live at: %s/templates/snippets/<stack>/' \
      "$(IFS=', '; echo "${RESOLVED_SNIPPETS[*]}")" \
      "${KIT_ROOT}")"
  fi

  cat <<EOF

Follow-up: per-instance templates (not installed by this script).

  # Methodology retrospective — one file per retro (cadence: every 4–6 features).
  cp ${KIT_ROOT}/templates/optional/methodology-retro.md.template \\
     ${TARGET_DIR}/docs/methodology-retros/$(date -u +%Y-%m-%d)-retro.md

  # Durable module spec — one file per module/domain (Tier-1 picks; aim 200–500 lines).
  cp ${KIT_ROOT}/templates/core/specs/module.md.template \\
     ${TARGET_DIR}/docs/specs/my-module.md

  # Durable journey spec — one file per cross-cutting user journey (aim 100–300 lines).
  cp ${KIT_ROOT}/templates/core/specs/journey.md.template \\
     ${TARGET_DIR}/docs/specs/journeys/my-journey.md
${snippets_note}

See ${KIT_SOURCE_URL}/blob/main/templates/README.md for the full template catalog.
EOF
}

_summary() {
  local backups
  if (( ${#BACKUPS_CREATED[@]} == 0 )); then
    backups="none"
  else
    backups="$(printf '%s ' "${BACKUPS_CREATED[@]}")"
    backups="${backups% }"
  fi

  _say ""
  if [[ "${DRY_RUN}" == "true" ]]; then
    _say "Summary (dry-run): Would install: ${DRYRUN_COUNT} / Skipped: ${SKIPPED_COUNT}"
    _say "[dry-run] no changes applied"
    return 0
  fi

  _say "Summary: Installed: ${INSTALLED_COUNT} / Up-to-date: ${UP_TO_DATE_COUNT} / Preserved: ${PRESERVED_COUNT} / Skipped: ${SKIPPED_COUNT} / Backups: ${backups}"
  if [[ "${CHANGED}" == "false" ]]; then
    _say "no changes needed"
  fi
}

# ----- main ------------------------------------------------------------------

main() {
  _parse_args "$@"
  _preflight
  _collect_placeholders
  _install_claude_md     # composes core CLAUDE.md + compliance addenda upfront
  _install_core          # all other core/ templates (skips CLAUDE.md)
  _install_claude_runtime
  _install_includes
  _install_compliance    # docs/compliance/* + runbooks/* (per profile)
  _write_manifest
  _print_followup
  _summary
}

main "$@"
