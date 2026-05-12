#!/usr/bin/env bash
# archive-run.sh — move completed phasing runs to .claude/phasing/archive/<YYYY>/.
#
# Usage:
#   archive-run.sh <run-id> [--force]
#   archive-run.sh --all-completed
#   archive-run.sh --before-date YYYY-MM-DD
#
# Run from a project root containing .claude/phasing/. Moves only happen when
# the run's overall_status is `complete`, `failed`, or `aborted` (use --force
# to override for a single run-id).
#
# This script handles the FILE MOVE portion. For GitHub mode, the orchestrator handles the
# `gh label` and `gh comment` actions afterward (this script can't reliably authenticate to
# GitHub without the user's gh session and we keep it local-only by design).
#
# Exit codes:
#   0 — at least one run moved successfully
#   1 — argument error / missing prerequisite
#   2 — no eligible runs / all targets refused

set -euo pipefail

PHASING_DIR=".claude/phasing"
ARCHIVE_DIR="$PHASING_DIR/archive"

if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required (install via 'brew install jq')." >&2
    exit 1
fi

if [ ! -d "$PHASING_DIR" ]; then
    echo "Error: $PHASING_DIR not found. Run from a project root with .claude/phasing/ initialized." >&2
    exit 1
fi

# Read overall_status from a run's run.json. Echoes "missing" if file absent.
get_status() {
    local run_id="$1"
    local rj="$PHASING_DIR/$run_id/run.json"
    [ -f "$rj" ] || { echo "missing"; return; }
    jq -r '.overall_status // "unknown"' "$rj"
}

# Year derived from phases[0].started_at (fallback: created_at).
get_year() {
    local run_id="$1"
    local rj="$PHASING_DIR/$run_id/run.json"
    jq -r '(.phases[0].started_at // .created_at // "1970-01-01T00:00:00Z")' "$rj" | cut -c1-4
}

# Move a single run. Returns 0 on success, non-zero on refusal.
archive_one() {
    local run_id="$1"
    local force_flag="$2"
    local status
    status=$(get_status "$run_id")

    if [ "$status" = "missing" ]; then
        echo "  refused: $run_id — no run.json"
        return 1
    fi

    if [ "$status" = "in_progress" ] && [ "$force_flag" != "--force" ]; then
        echo "  refused: $run_id — overall_status=$status (pass --force to override)"
        return 1
    fi

    local year dest
    year=$(get_year "$run_id")
    dest="$ARCHIVE_DIR/$year"

    if [ -d "$dest/$run_id" ]; then
        echo "  refused: $run_id — destination already exists at $dest/$run_id"
        return 1
    fi

    if [ "$force_flag" = "--force" ] && [ "$status" = "in_progress" ]; then
        echo "  WARNING: force-archiving in_progress run $run_id. Verify nothing is still running."
        local rj="$PHASING_DIR/$run_id/run.json"
        local now
        now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        # Mark as aborted so the archived state is honest.
        local tmp="$rj.tmp"
        jq --arg now "$now" \
           '.overall_status = "aborted" | .completed_at = $now | .force_archived = true' \
           "$rj" > "$tmp"
        mv "$tmp" "$rj"
    fi

    # Stamp archived_at on the run.json for traceability.
    local rj="$PHASING_DIR/$run_id/run.json"
    local now_archived
    now_archived=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local tmp="$rj.tmp"
    jq --arg now "$now_archived" '.archived_at = $now' "$rj" > "$tmp"
    mv "$tmp" "$rj"

    mkdir -p "$dest"
    mv "$PHASING_DIR/$run_id" "$dest/"
    echo "  moved: $run_id -> archive/$year/"
    return 0
}

# Iterate active runs (top-level dirs under .claude/phasing/, excluding archive/).
iterate_active() {
    local filter_fn="$1"
    local moved=0 refused=0
    for d in "$PHASING_DIR"/*/; do
        [ -d "$d" ] || continue
        local run_id
        run_id=$(basename "$d")
        [ "$run_id" = "archive" ] && continue

        if "$filter_fn" "$run_id"; then
            if archive_one "$run_id" ""; then
                moved=$((moved + 1))
            else
                refused=$((refused + 1))
            fi
        fi
    done
    echo
    echo "Moved $moved. Refused $refused."
    [ "$moved" -gt 0 ]
}

# Filter: status is complete | failed | aborted, AND completed_at < BEFORE_DATE.
filter_before_date() {
    local run_id="$1"
    local rj="$PHASING_DIR/$run_id/run.json"
    [ -f "$rj" ] || return 1
    local os ca
    os=$(jq -r '.overall_status // ""' "$rj")
    ca=$(jq -r '.completed_at // ""' "$rj")
    case "$os" in
        complete|failed|aborted) ;;
        *) return 1 ;;
    esac
    [ -n "$ca" ] && [ "$ca" \< "${BEFORE_DATE}T00:00:00Z" ]
}

# Filter: status is complete (only).
filter_all_completed() {
    local run_id="$1"
    [ "$(get_status "$run_id")" = "complete" ]
}

# Main argument dispatch.
case "${1:-}" in
    "")
        echo "Usage: $0 <run-id> [--force] | --before-date YYYY-MM-DD | --all-completed" >&2
        exit 1
        ;;

    --before-date)
        BEFORE_DATE="${2:-}"
        if [ -z "$BEFORE_DATE" ]; then
            echo "Error: --before-date requires YYYY-MM-DD" >&2
            exit 1
        fi
        echo "Archiving runs completed before $BEFORE_DATE..."
        if iterate_active filter_before_date; then exit 0; else exit 2; fi
        ;;

    --all-completed)
        echo "Archiving all complete runs..."
        if iterate_active filter_all_completed; then exit 0; else exit 2; fi
        ;;

    *)
        # Single-run-id archive.
        RUN_ID="$1"
        FORCE="${2:-}"
        echo "Archiving $RUN_ID..."
        if archive_one "$RUN_ID" "$FORCE"; then
            exit 0
        else
            exit 2
        fi
        ;;
esac
