#!/usr/bin/env bash
# templates/snippets/ci/ci-test-split-bash.sh
# Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
# Stack-leaning toward Node + Vitest because that's where the source-
# project ran the discipline at scale. The *shape* (always-run subset
# + diff-driven additions + full-suite fallback) is portable; adapt
# the variables below to your runner.
#
# Canonical source for the cost/feedback rationale: docs/methodology.md
# §C "Test scheduling: match cost to feedback urgency."
#
# Authored: 2026-05-07
# License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
#
# ── Override surface ─────────────────────────────────────────────────
# All five variables below have ${VAR:-default} defaults that match the
# source-project shape. Edit the values in place, or set env vars at
# invocation. The script runs out-of-the-box on a Vitest project with
# a src/__tests__ + src/lib/actions layout.

set -euo pipefail

# CHANGE ME: paths whose tests always run (core infrastructure).
ALWAYS_RUN_GLOBS="${ALWAYS_RUN_GLOBS:-src/__tests__/lib/ src/__tests__/utils/ src/__tests__/api/}"

# CHANGE ME: source directory whose changes trigger test-file inclusion.
ACTION_DIR="${ACTION_DIR:-src/lib/actions/}"

# CHANGE ME: corresponding test directory.
TEST_DIR="${TEST_DIR:-src/__tests__/actions/}"

# CHANGE ME: source file extension (used to derive test file names).
SOURCE_EXT="${SOURCE_EXT:-.ts}"

# CHANGE ME: test file suffix appended to the source basename.
# Vitest convention: <name>.test.ts  →  TEST_SUFFIX=.test${SOURCE_EXT}
# Pytest convention: test_<name>.py  →  needs a different derivation
#   (overwrite the loop below to match your runner).
TEST_SUFFIX="${TEST_SUFFIX:-.test${SOURCE_EXT}}"

# CHANGE ME: test runner invocation.
RUNNER_CMD="${RUNNER_CMD:-npx vitest run}"

# CHANGE ME: default branch (main or master).
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

# ── Branch 1: full suite on push to default branch ──────────────────
# So the default branch always has full-suite signal, regardless of
# the merge-base diff.
if [ "${GITHUB_REF:-}" = "refs/heads/${DEFAULT_BRANCH}" ] && [ "${GITHUB_EVENT_NAME:-}" = "push" ]; then
  echo "=== Full suite (push to ${DEFAULT_BRANCH}) ==="
  exec ${RUNNER_CMD}
fi

# ── Branch 2: full-suite fallback when origin/${DEFAULT_BRANCH} ─────
# is unavailable (shallow checkout, detached HEAD, missing remote).
# Without this fallback the script silently runs only ALWAYS_RUN_GLOBS
# on shallow checkouts and hides regressions.
if ! git rev-parse --verify "origin/${DEFAULT_BRANCH}" &>/dev/null; then
  echo "=== Full suite (origin/${DEFAULT_BRANCH} not available — likely shallow checkout) ==="
  exec ${RUNNER_CMD}
fi

# ── Branch 3: always-run subset + diff-driven action tests ──────────
MERGE_BASE=$(git merge-base HEAD "origin/${DEFAULT_BRANCH}" 2>/dev/null || echo "")
if [ -z "${MERGE_BASE}" ]; then
  echo "=== Full suite (merge-base computation failed) ==="
  exec ${RUNNER_CMD}
fi

CHANGED_TESTS=""
for f in $(git diff --name-only "${MERGE_BASE}" -- "${ACTION_DIR}" 2>/dev/null); do
  base=$(basename "${f}" "${SOURCE_EXT}")
  test_file="${TEST_DIR}${base}${TEST_SUFFIX}"
  if [ -f "${test_file}" ]; then
    CHANGED_TESTS="${CHANGED_TESTS} ${test_file}"
  fi
done

echo "=== CI test split ==="
echo "  Always: ${ALWAYS_RUN_GLOBS}"
echo "  Changed action tests: ${CHANGED_TESTS:-none}"
echo ""

# shellcheck disable=SC2086
exec ${RUNNER_CMD} ${ALWAYS_RUN_GLOBS} ${CHANGED_TESTS}
