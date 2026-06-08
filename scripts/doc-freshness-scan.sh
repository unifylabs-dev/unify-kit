#!/usr/bin/env bash
#
# doc-freshness-scan.sh — detect ACCUMULATED drift between the unify-kit code/
# structure and its living-doc set. The read-only detection half of the M4
# detect-only `doc-freshness` ROUTINE (plugins/unifylabs-workflow/workflows/
# routines/doc-freshness/). Designed to run unchanged inside a cloud routine.
#
# License:       MIT
# Source:        https://github.com/unifylabs-dev/unify-kit
# Sourcing mode: net-new (no upstream lift).
#
# WHY THIS EXISTS:
#   The per-PR changelog-check.yml is a single-PR tripwire (and is bypassable via
#   [skip-changelog]). It never cross-references code-vs-docs and never catches
#   staleness that accumulates over many PRs. This scan diffs the world against the
#   docs on a cadence — the gap a scheduled routine fills.
#
# DETECT-ONLY + REPO-INTRINSIC CONTRACT (load-bearing):
#   - READ-ONLY. This script performs ONLY grep/test/ls/find/git-log READS and
#     prints a report. It contains NO write, edit, commit, push, or mutation of
#     any kind. (The routine that runs it is responsible for emitting the report
#     as a `gh issue` find-or-update — that GitHub-state write lives in the routine
#     prompt, NOT here.)
#   - $HOME-FREE. Unlike check-drift.sh (which keys off ~/Projects + ~/.claude
#     symlinks and is therefore machine-local), this scan reads ONLY tracked repo
#     files relative to the repo root, so it produces identical signal in a local
#     clone, in CI, or in a cloud routine's own checkout.
#
# EXIT CODES:
#   0  fresh — no drift signals fired
#   1  drift detected — one or more signals fired (the report lists them)
#   2  environment error (not a git repo / required path missing)
#
# Env:
#   REPO_ROOT  override the repo root (default: `git rev-parse --show-toplevel`).
#
# Run:  scripts/doc-freshness-scan.sh
#       REPO_ROOT=/path/to/clone scripts/doc-freshness-scan.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# Setup — resolve the repo root WITHOUT touching $HOME.
# ---------------------------------------------------------------------------

if [[ -n "${REPO_ROOT:-}" ]]; then
  ROOT="$REPO_ROOT"
else
  if ! ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    echo "doc-freshness-scan: not a git repository (and REPO_ROOT unset)" >&2
    exit 2
  fi
fi

if [[ ! -d "$ROOT" ]]; then
  echo "doc-freshness-scan: repo root does not exist: $ROOT" >&2
  exit 2
fi
cd "$ROOT"

PLUGIN="plugins/unifylabs-workflow"
if [[ ! -d "$PLUGIN/skills" ]]; then
  echo "doc-freshness-scan: $PLUGIN/skills missing — is this a unify-kit checkout?" >&2
  exit 2
fi

SIGNALS=()
note() { SIGNALS+=("$1"); }

# ---------------------------------------------------------------------------
# Signal A — COUNT DRIFT. The filesystem reality of skills/commands/hooks vs the
# "N skills / N commands / N hooks" claims in the living docs (the M0 pain class).
# ---------------------------------------------------------------------------

n_skills=$(find "$PLUGIN/skills" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
n_commands=$(find "$PLUGIN/commands" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')
n_hooks=$(find "$PLUGIN/hooks" -maxdepth 1 -name '*.sh' | wc -l | tr -d ' ')

# The files that carry a "N skills" / "N commands" / "N hooks" prose claim.
COUNT_DOCS=("CLAUDE.md" "README.md")

check_count() {
  local label="$1" actual="$2" file="$3"
  [[ -f "$file" ]] || return 0
  # Grep claims of the form "<number> <label>" (e.g. "13 skills"); compare each.
  local claimed
  while IFS= read -r claimed; do
    [[ -z "$claimed" ]] && continue
    if [[ "$claimed" != "$actual" ]]; then
      note "COUNT DRIFT: $file claims '$claimed $label' but the tree has $actual $label."
    fi
  done < <(grep -oiE "[0-9]+ $label\b" "$file" 2>/dev/null | grep -oE '^[0-9]+' | sort -u)
}

for f in "${COUNT_DOCS[@]}"; do
  check_count "skills" "$n_skills" "$f"
  check_count "commands" "$n_commands" "$f"
  check_count "hooks" "$n_hooks" "$f"
done

# ---------------------------------------------------------------------------
# Signal B — ADR-INDEX GAP. Every docs/decisions/NNNN-*.md must have a row in the
# decisions README index (spec 08 mandates the index list every ADR).
# ---------------------------------------------------------------------------

ADR_DIR="docs/decisions"
ADR_INDEX="$ADR_DIR/README.md"
if [[ -d "$ADR_DIR" && -f "$ADR_INDEX" ]]; then
  while IFS= read -r adr; do
    id="$(basename "$adr" | grep -oE '^[0-9]{4}')"
    [[ -z "$id" ]] && continue
    if ! grep -qE "(^|[^0-9])$id([^0-9]|$)" "$ADR_INDEX"; then
      note "ADR-INDEX GAP: $adr (ID $id) has no row in $ADR_INDEX."
    fi
  done < <(find "$ADR_DIR" -maxdepth 1 -name '[0-9]*.md' | sort)
fi

# ---------------------------------------------------------------------------
# Signal C — EMPTY [Unreleased]. CHANGELOG must carry a non-empty [Unreleased]
# section with real entries (catches [skip-changelog]-bypass accumulation).
# ---------------------------------------------------------------------------

if [[ -f "CHANGELOG.md" ]]; then
  # Lines between "## [Unreleased]" and the next "## " header, excluding blanks +
  # HTML comments. If none are real content lines → empty.
  unreleased_body=$(awk '
    /^## \[Unreleased\]/ { grab=1; next }
    grab && /^## / { grab=0 }
    grab { print }
  ' CHANGELOG.md | grep -vE '^\s*$' | grep -vE '^\s*<!--' | grep -vE '^\s*-->' | grep -cE '\S' || true)
  if [[ "${unreleased_body:-0}" -eq 0 ]]; then
    note "EMPTY [Unreleased]: CHANGELOG.md has no real entries under ## [Unreleased]."
  fi
fi

# ---------------------------------------------------------------------------
# Signal D — SKILL WITHOUT A DOC ENTRY. Every skills/<x>/ dir should be named in
# the CLAUDE.md architecture section (the human-facing skill enumeration).
# ---------------------------------------------------------------------------

if [[ -f "CLAUDE.md" ]]; then
  while IFS= read -r skilldir; do
    name="$(basename "$skilldir")"
    if ! grep -qF "$name" "CLAUDE.md"; then
      note "SKILL WITHOUT DOC ENTRY: skills/$name is not mentioned in CLAUDE.md."
    fi
  done < <(find "$PLUGIN/skills" -maxdepth 1 -mindepth 1 -type d | sort)
fi

# ---------------------------------------------------------------------------
# (Dangling-citation detection is INTENTIONALLY NOT a deterministic signal here.)
#   A bash existence check on doc→path references is irreducibly false-positive-
#   prone: plugin-relative shorthand (`skills/x/SKILL.md` actually lives under
#   `plugins/unifylabs-workflow/skills/`), aspirational template paths, and
#   historical/audit-doc references all read as "missing" to a literal `test -e`.
#   Telling real drift from shorthand/aspirational needs JUDGMENT, so that signal
#   lives in the ROUTINE's LLM layer (see routines/doc-freshness/routine-prompt.md),
#   not in this deterministic script. This is exactly the agentic value a cloud
#   routine adds over a plain cron Action.
#
# Signal F — LIVING DOCS LAGGING CHURN. If recent commits touched code dirs
# (plugins/ scripts/ templates/) but NONE of them touched the living-doc set in
# the same window, the docs may be lagging the code shape. (Window = last 20
# commits; tunable. Narrative signal — the one a human/LLM should weigh.)
# ---------------------------------------------------------------------------

if git rev-parse --git-dir >/dev/null 2>&1; then
  window=20
  changed=$(git log -n "$window" --name-only --pretty=format: 2>/dev/null | grep -vE '^\s*$' | sort -u || true)
  if [[ -n "$changed" ]]; then
    touched_code=$(printf '%s\n' "$changed" | grep -cE '^(plugins|scripts|templates)/' || true)
    touched_docs=$(printf '%s\n' "$changed" | grep -cE '^(README\.md|CLAUDE\.md|CHANGELOG\.md|docs/)' || true)
    if [[ "${touched_code:-0}" -gt 0 && "${touched_docs:-0}" -eq 0 ]]; then
      note "LIVING DOCS LAGGING: last $window commits changed code (plugins/scripts/templates) but touched no README/CLAUDE.md/CHANGELOG/docs."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Report (detect-only — print + exit code; NEVER mutate).
# ---------------------------------------------------------------------------

echo "doc-freshness-scan @ $(git rev-parse --short HEAD 2>/dev/null || echo '?')  (skills=$n_skills commands=$n_commands hooks=$n_hooks)"
if [[ ${#SIGNALS[@]} -eq 0 ]]; then
  echo "✓ FRESH — no doc-freshness drift signals fired."
  exit 0
fi

echo "✗ DRIFT — ${#SIGNALS[@]} signal(s) fired:"
for s in "${SIGNALS[@]}"; do
  echo "  • $s"
done
exit 1
