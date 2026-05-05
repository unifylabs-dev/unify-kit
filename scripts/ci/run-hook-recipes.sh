#!/usr/bin/env bash
#
# scripts/ci/run-hook-recipes.sh
# Sourcing mode: net-new
# Authored: 2026-05-04
# License: MIT
#
# Extracts each fenced bash block under "## Manual-test recipes" in
# hooks/README.md to a numbered tempfile and runs it. Each recipe is
# expected to print "PASS" on success or a "FAIL: ..." line on failure.
# Used by .github/workflows/bootstrap-fixture.yml step 7.
#
# Recipes that require a live Claude session (e.g., "ask Claude to edit
# .env; expect refusal") cannot fully run in CI. The runner detects
# marker comments ("# (manual: ...)" or "# requires live claude session")
# and skips those blocks with a logged note. As of 2026-05-04, none of
# the six recipes in hooks/README.md have such markers — all are
# runnable end-to-end against an isolated $FAKE_HOME.
#
# Usage:
#   scripts/ci/run-hook-recipes.sh [FAKE_HOME]
#
# When FAKE_HOME is provided (CI uses $RUNNER_TEMP/fake-home), it is
# exported as HOME for each recipe. When omitted, the caller's HOME is
# used. The runner exits non-zero if any non-skipped recipe fails or
# omits the PASS marker.

set -euo pipefail

FAKE_HOME="${1:-$HOME}"
README="hooks/README.md"

if [ ! -r "$README" ]; then
    echo "ERROR: cannot read $README (run from repo root)" >&2
    exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Extract fenced bash blocks under "## Manual-test recipes" to numbered
# tempfiles. The awk script tracks the section/block state and writes
# each block's body to its own file.
awk -v dir="$TMP_DIR" '
    /^## Manual-test recipes$/ { in_section = 1; n = 0; next }
    /^## / && in_section       { in_section = 0; next }
    in_section && /^```bash$/  { in_block = 1; n++;
                                  out = sprintf("%s/recipe-%03d.sh", dir, n);
                                  next }
    in_section && /^```$/ && in_block { in_block = 0; next }
    in_block                   { print >> out }
' "$README"

count=0
fail_count=0
skip_count=0

for recipe in "$TMP_DIR"/recipe-*.sh; do
    [ -f "$recipe" ] || continue
    count=$((count + 1))
    name=$(basename "$recipe")

    # Skip recipes that need a live Claude session.
    if grep -qE '^[[:space:]]*#[[:space:]]*\((manual|requires)' "$recipe" \
       || grep -qE '^[[:space:]]*#[[:space:]]*requires live claude' "$recipe"; then
        echo "SKIP $name (requires live claude session)"
        skip_count=$((skip_count + 1))
        continue
    fi

    echo "Running $name in HOME=$FAKE_HOME"
    out=""
    if ! out=$(HOME="$FAKE_HOME" bash "$recipe" 2>&1); then
        echo "$out"
        echo "  -> FAIL ($name exited non-zero)"
        fail_count=$((fail_count + 1))
        continue
    fi
    echo "$out"
    if echo "$out" | grep -qE '^FAIL'; then
        echo "  -> FAIL ($name printed FAIL)"
        fail_count=$((fail_count + 1))
    elif echo "$out" | grep -qE 'PASS'; then
        echo "  -> PASS"
    else
        echo "  -> WARN ($name produced no PASS/FAIL marker)"
        fail_count=$((fail_count + 1))
    fi
done

if [ "$count" -eq 0 ]; then
    echo "ERROR: no recipes extracted from $README" >&2
    exit 1
fi

if [ "$fail_count" -gt 0 ]; then
    echo "ERROR: $fail_count of $count recipes failed (skipped=$skip_count)" >&2
    exit 1
fi

echo "OK: $count recipes ran ($((count - skip_count)) passed, $skip_count skipped)"
