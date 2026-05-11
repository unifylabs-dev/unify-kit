#!/usr/bin/env bash
#
# init-project.sh — install unify-kit templates into a consumer project.
#
# License:       MIT
# Source:        https://github.com/unifylabs-dev/unify-kit
# Sourcing mode: net-new (no upstream lift; original expression).
#
# Consumer-side companion to bootstrap-claude-config.sh. Where that script
# targets ~/.claude/ (machine-level hooks), this script targets a project
# directory and installs 11 one-shot templates (with placeholder
# substitution), optional Next.js snippets, and optional CI workflow
# templates. Idempotent. Backups mandatory. Writes
# <target>/.unify-kit-project-manifest.json for safe re-runs.
#
# Requires Bash 4+ (associative arrays), jq, and shasum or sha256sum.

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

# Source (relative to KIT_ROOT) → target (relative to TARGET_DIR).
# Hard-coded; rename rules are not regular (underscore vs. dash, .template suffix removal).
declare -A SOURCE_TARGET_MAP=(
  ["templates/cheatsheet.md.template"]="CHEATSHEET.md"
  ["templates/claude.md.template"]="CLAUDE.md"
  ["templates/llms.txt.template"]="llms.txt"
  ["templates/ai-usage-charter.md.template"]="docs/ai-usage-charter.md"
  ["templates/mcp-policy.md.template"]="docs/mcp-policy.md"
  ["templates/security-checklist.md"]="docs/security-checklist.md"
  ["templates/team-onboarding.md.template"]="onboarding/team-onboarding.md"
  ["templates/pull-request-template.md.template"]=".github/pull_request_template.md"
  ["templates/issue-templates/feature-request.yml.template"]=".github/ISSUE_TEMPLATE/feature_request.yml"
  ["templates/issue-templates/bug-report.yml.template"]=".github/ISSUE_TEMPLATE/bug_report.yml"
  ["templates/specs/README.md.template"]="docs/specs/README.md"
)

# Stable iteration order (associative arrays don't preserve insertion order in Bash 4).
ONE_SHOT_ORDER=(
  "templates/cheatsheet.md.template"
  "templates/claude.md.template"
  "templates/llms.txt.template"
  "templates/ai-usage-charter.md.template"
  "templates/mcp-policy.md.template"
  "templates/security-checklist.md"
  "templates/team-onboarding.md.template"
  "templates/pull-request-template.md.template"
  "templates/issue-templates/feature-request.yml.template"
  "templates/issue-templates/bug-report.yml.template"
  "templates/specs/README.md.template"
)

NEXTJS_SNIPPETS=(
  "templates/snippets/server-action-anatomy-nextjs.md"
  "templates/snippets/audit-logging-nextjs.md"
  "templates/snippets/rate-limiting-nextjs.md"
  "templates/snippets/middleware-nextjs.md"
)
readonly STACK_AGNOSTIC_SNIPPET="templates/snippets/bdd-lite-test-naming.md"

declare -A CI_TEMPLATE_TARGET=(
  ["templates/snippets/ci-pr-fast.yml.template"]=".github/workflows/ci.yml"
  ["templates/snippets/ci-nightly.yml.template"]=".github/workflows/nightly.yml"
  ["templates/snippets/ci-test-split-bash.sh"]="scripts/ci-test-split.sh"
)
CI_TEMPLATE_ORDER=(
  "templates/snippets/ci-pr-fast.yml.template"
  "templates/snippets/ci-nightly.yml.template"
  "templates/snippets/ci-test-split-bash.sh"
)

# 18 placeholders, in display order.
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
)

REQUIRED_PLACEHOLDERS=("PROJECT_NAME" "ONE_LINE_DESCRIPTION" "REPO_URL")

# ----- runtime state ---------------------------------------------------------

TARGET_DIR=""
CONFIG_FILE=""
DRY_RUN=false
FORCE=false
WITH_CI_TEMPLATES=false
SNIPPETS=""             # "" | "none" | "nextjs"
SKIP_LIST=()
SHA256_CMD=""

declare -A PLACEHOLDER_VALUES=()
BACKUPS_CREATED=()
INSTALLED_COUNT=0
UP_TO_DATE_COUNT=0
DRYRUN_COUNT=0
SKIPPED_COUNT=0
PRESERVED_COUNT=0
CHANGED=false

# Per-artifact records for manifest assembly.
# Parallel arrays: each index N describes one written/up-to-date artifact.
MANIFEST_SOURCES=()
MANIFEST_TARGETS=()
MANIFEST_SHAS=()
MANIFEST_INSTALLED_AT=()

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
init-project.sh — install unify-kit templates into a consumer project.

Usage:
  init-project.sh <target-dir> [flags]

Flags:
  --config <yaml>          Load 18-placeholder values from a flat-scalar YAML
                           file (skips interactive prompts).
  --dry-run                Preview every change. Does not write, copy, or back
                           up anything.
  --force                  Overwrite consumer-edited targets. Backups still
                           created.
  --skip <list>            Comma-separated list of source filenames or basenames
                           to exclude from the one-shot install. Repeatable.
  --snippets=<stack>       Install stack snippets to <target>/docs/snippets/.
                           Supported: nextjs, none. (none is required when
                           --with-ci-templates is passed alone.)
  --with-ci-templates      Install Tier-1 PR-fast + Tier-4 nightly workflow
                           templates into <target>/.github/workflows/ and the
                           CI test-split bash script to <target>/scripts/.
                           Requires --snippets=<stack> or --snippets=none.
  --help, -h               Print this message and exit 0.

Positional:
  <target-dir>             Project directory to install into. Must exist.

What it does:
  1. Pre-flight: checks jq + SHA-256 tool + kit checkout integrity (19 source
     files expected).
  2. Collects 18 placeholder values (interactive prompts OR --config YAML).
  3. Installs 11 one-shot templates with placeholder substitution where
     applicable. Skips files in --skip <list>.
  4. Optionally installs 5 snippets (--snippets=nextjs) and 3 CI templates
     (--with-ci-templates).
  5. Writes <target>/.unify-kit-project-manifest.json recording per-artifact
     SHA-256 (basis for safe re-runs).
  6. Prints follow-up cp recipes for the 3 per-instance templates
     (methodology-retro, module spec, journey spec).

Idempotent: re-running on a clean install reports "no changes needed".

Examples:
  # Greenfield project with full Next.js stack:
  init-project.sh ./my-new-project --config my-config.yml \\
    --with-ci-templates --snippets=nextjs

  # Existing project (one-shot only; no CI/snippets):
  cd ./existing-project && init-project.sh . --config my-config.yml

  # Interactive prompts, no config file:
  init-project.sh ./my-new-project

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
      --with-ci-templates) WITH_CI_TEMPLATES=true ;;
      --config)
        [[ $# -ge 2 ]] || { _err "--config requires a path"; exit 2; }
        CONFIG_FILE="$2"
        shift
        ;;
      --config=*)
        CONFIG_FILE="${1#--config=}"
        ;;
      --snippets)
        [[ $# -ge 2 ]] || { _err "--snippets requires a value (nextjs|none)"; exit 2; }
        SNIPPETS="$2"
        shift
        ;;
      --snippets=*)
        SNIPPETS="${1#--snippets=}"
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

  if [[ "${WITH_CI_TEMPLATES}" == "true" && -z "${SNIPPETS}" ]]; then
    _err "--with-ci-templates requires --snippets=<stack> or --snippets=none (CI workflow templates assume a test command structure)."
    exit 2
  fi

  if [[ -n "${SNIPPETS}" && "${SNIPPETS}" != "nextjs" && "${SNIPPETS}" != "none" ]]; then
    _err "unsupported --snippets value: '${SNIPPETS}'. Supported: nextjs, none."
    exit 2
  fi
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

  # Verify kit checkout integrity: 11 + 5 + 3 = 19 expected source files.
  local expected=()
  expected+=("${ONE_SHOT_ORDER[@]}")
  expected+=("${NEXTJS_SNIPPETS[@]}" "${STACK_AGNOSTIC_SNIPPET}")
  expected+=("${CI_TEMPLATE_ORDER[@]}")

  local missing=()
  for rel in "${expected[@]}"; do
    if [[ ! -f "${KIT_ROOT}/${rel}" ]]; then
      missing+=("${rel}")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    _err "broken kit checkout — missing source files:"
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
}

# ----- placeholder collection ------------------------------------------------

_load_config_yaml() {
  local path="$1"
  local lineno=0
  local key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    lineno=$((lineno + 1))
    # Strip trailing CR (Windows-edited YAMLs).
    line="${line%$'\r'}"
    # Skip blank lines and comments.
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    # Match KEY: VALUE (where KEY is uppercase alphanum/underscore).
    if [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*):[[:space:]]*(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      # Strip optional surrounding double quotes.
      if [[ "${value}" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi
      # Strip optional surrounding single quotes.
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
  _say "Collecting 18 placeholder values. Press Enter to accept the default."
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

  # Apply defaults for any keys not set by config/prompts.
  local key
  for key in "${PLACEHOLDER_ORDER[@]}"; do
    if [[ -z "${PLACEHOLDER_VALUES[${key}]+x}" ]]; then
      PLACEHOLDER_VALUES["${key}"]="${PLACEHOLDER_DEFAULT[${key}]}"
    fi
  done

  # Required placeholders must be non-empty.
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

  # Warn if many optional placeholders are empty.
  local empty=0
  for key in "${PLACEHOLDER_ORDER[@]}"; do
    [[ -z "${PLACEHOLDER_VALUES[${key}]}" ]] && empty=$((empty + 1))
  done
  if (( empty > 6 )); then
    _warn "${empty} placeholders are empty. Installed files will reference blank values."
  fi
}

# ----- substitution ----------------------------------------------------------

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

  # Validate: no remaining {{...}} tokens.
  local leftover
  leftover="$(grep -oE '\{\{[A-Z][A-Z0-9_]*\}\}' "${dest}" | sort -u || true)"
  if [[ -n "${leftover}" ]]; then
    _err "${src}: unsubstituted placeholders remain after substitution:"
    printf '%s\n' "${leftover}" | sed 's/^/  /' >&2
    rm -f -- "${dest}"
    exit 1
  fi
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

# Read a per-artifact field from the existing manifest (if any).
# Args: <source-key> <field>  ("sha256" | "installed_at" | "target")
# Echoes the field value (or empty if absent).
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
#
# Args: <source-relative-path> <target-relative-path> [substitute|copy]
# The third arg is optional: "substitute" / "copy". If omitted, auto-detect
# based on presence of {{...}} tokens in source.
#
# Side effects:
#   - Renders to <abs-target>.tmp
#   - Compares against existing target (if any) + manifest's recorded SHA
#   - Either mv to target (with backup) OR rm tmp (preserve / up-to-date)
#   - Appends to MANIFEST_* parallel arrays for the final manifest write
#   - Updates counters + CHANGED flag

_install_artifact() {
  local src_rel="$1" tgt_rel="$2" mode="${3:-auto}"
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

  # Render to tmp.
  if [[ "${mode}" == "substitute" ]]; then
    _substitute_file "${src_abs}" "${tmp}"
  else
    cp -- "${src_abs}" "${tmp}"
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
    return 0
  fi

  # Target exists.
  local tgt_sha; tgt_sha="$(_sha256 "${tgt_abs}")"
  if [[ "${tgt_sha}" == "${kit_sha}" ]]; then
    rm -f -- "${tmp}"
    UP_TO_DATE_COUNT=$((UP_TO_DATE_COUNT + 1))
    _say "up-to-date ${tgt_rel}"
    local prior_at; prior_at="$(_manifest_artifact_field "${src_rel}" "installed_at")"
    [[ -z "${prior_at}" ]] && prior_at="${now}"
    MANIFEST_SOURCES+=("${src_rel}")
    MANIFEST_TARGETS+=("${tgt_rel}")
    MANIFEST_SHAS+=("${kit_sha}")
    MANIFEST_INSTALLED_AT+=("${prior_at}")
    return 0
  fi

  # Target exists with different SHA. Decide based on manifest + FORCE.
  local manifest_sha; manifest_sha="$(_manifest_artifact_field "${src_rel}" "sha256")"
  local can_safely_overwrite=false
  if [[ -n "${manifest_sha}" && "${manifest_sha}" == "${tgt_sha}" ]]; then
    can_safely_overwrite=true
  fi

  if [[ "${can_safely_overwrite}" == "true" || "${FORCE}" == "true" ]]; then
    _backup "${tgt_abs}"
    mv -f -- "${tmp}" "${tgt_abs}"
    chmod 0644 "${tgt_abs}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    CHANGED=true
    _say "overwrote ${tgt_rel}"
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
    # Don't add to manifest — preserve whatever the manifest already records.
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

# ----- install groups --------------------------------------------------------

_install_one_shots() {
  local src
  for src in "${ONE_SHOT_ORDER[@]}"; do
    local tgt="${SOURCE_TARGET_MAP[${src}]}"
    _install_artifact "${src}" "${tgt}"
  done
}

_install_snippets() {
  if [[ -z "${SNIPPETS}" || "${SNIPPETS}" == "none" ]]; then
    return 0
  fi
  if [[ "${SNIPPETS}" != "nextjs" ]]; then
    _err "internal: unexpected SNIPPETS=${SNIPPETS}"
    exit 1
  fi

  local src base tgt
  for src in "${NEXTJS_SNIPPETS[@]}" "${STACK_AGNOSTIC_SNIPPET}"; do
    base="$(basename -- "${src}")"
    tgt="docs/snippets/${base}"
    _install_artifact "${src}" "${tgt}" "copy"
  done
}

_install_ci_templates() {
  if [[ "${WITH_CI_TEMPLATES}" != "true" ]]; then
    return 0
  fi
  local src tgt
  for src in "${CI_TEMPLATE_ORDER[@]}"; do
    tgt="${CI_TEMPLATE_TARGET[${src}]}"
    if [[ "${src}" == *.template ]]; then
      _install_artifact "${src}" "${tgt}" "substitute"
    else
      _install_artifact "${src}" "${tgt}" "copy"
      # ci-test-split.sh needs exec bit.
      if [[ "${DRY_RUN}" != "true" && -f "${TARGET_DIR}/${tgt}" ]]; then
        chmod 0755 "${TARGET_DIR}/${tgt}"
      fi
    fi
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

  # Build artifacts JSON from parallel arrays.
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

  local manifest
  manifest="$(jq -nS \
    --arg version "${KIT_VERSION}" \
    --arg ts      "${top_installed_at}" \
    --arg source  "${KIT_SOURCE_URL}" \
    --argjson arts "${artifacts}" \
    '{kit_version: $version, installed_at: $ts, source: $source, artifacts: $arts}')"

  # Idempotency: skip rewrite if effectively unchanged.
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
  cat <<EOF

Follow-up: per-instance templates (not installed by this script).

  # Methodology retrospective — one file per retro (cadence: every 4–6 features).
  cp ${KIT_ROOT}/templates/methodology-retro.md.template \\
     ${TARGET_DIR}/docs/methodology-retros/$(date -u +%Y-%m-%d)-retro.md

  # Durable module spec — one file per module/domain (Tier-1 picks; aim 200–500 lines).
  cp ${KIT_ROOT}/templates/specs/module.md.template \\
     ${TARGET_DIR}/docs/specs/my-module.md

  # Durable journey spec — one file per cross-cutting user journey (aim 100–300 lines).
  cp ${KIT_ROOT}/templates/specs/journey.md.template \\
     ${TARGET_DIR}/docs/specs/journeys/my-journey.md

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
  _install_one_shots
  _install_snippets
  _install_ci_templates
  _write_manifest
  _print_followup
  _summary
}

main "$@"
