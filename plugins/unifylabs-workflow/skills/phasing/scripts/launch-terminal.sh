#!/usr/bin/env bash
# launch-terminal.sh — best-effort spawn of `claude /<command-name> <run-id> <N>` in a new terminal.
#
# Usage:
#   launch-terminal.sh <run-id> <phase-N> [<project-dir>] [<phase-name-slug>] [<command-name>]
#
# If <phase-name-slug> is provided, the spawned terminal also sets its title to
# `phase-<N>-<phase-name-slug>` via OSC-2 before launching `claude` — so the Claude Code
# title pill is correct from the moment the session opens. If omitted, the phase session
# itself sets the title from its loaded spec (see SKILL.md "Session naming").
#
# Optional 5th arg <command-name> selects the slash command invoked in the new session.
# Defaults to `phase-execute` (the legacy 4-arg form). Pass `phase-continue` to re-enter
# a paused phase from its phase-N-checkpoint.md (orchestrator §9.5 "Re-spawn from
# checkpoint" menu pick). Empty string also defaults to `phase-execute`.
#
# Every spawn exports CLAUDE_PHASE_SESSION=1 just before invoking `claude` so the handoff
# skill's detect-mode.sh can identify executor sessions reliably (without relying on
# session-name-pattern detection, which is fragile across terminals). The export rides
# inside the per-spawn shell context (osascript `do script`, `bash -c`, tmux/kitty cmd)
# and does NOT leak into the orchestrator's environment.
#
# LAUNCH_TERMINAL_DRY_RUN=1 short-circuits the terminal-detection branches: the script
# echoes the computed COMMAND and the spawn-env marker, then exits 0. Used by
# scripts/test/test-launch-terminal.sh.
#
# Detects the current terminal (iTerm2 / Terminal.app / WezTerm / kitty / tmux / VS Code) and
# spawns a fresh tab/window. Falls back to printing the manual command if no known terminal
# is detected or the spawn fails.
#
# The orchestrator does NOT depend on this script's exit code to know whether the phase actually
# started — it polls for the handoff file (file mode) or the issue close+comment (GitHub mode).
# This script's job is to make spawning ergonomic when possible.
#
# Exit codes:
#   0 — spawned successfully OR fallback printed (user must paste manually)
#   1 — argument error

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <run-id> <phase-N> [<project-dir>] [<phase-name-slug>] [<command-name>]" >&2
    exit 1
fi

RUN_ID="$1"
PHASE_N="$2"
PROJECT_DIR="${3:-$PWD}"
PHASE_NAME_SLUG="${4:-}"
COMMAND_NAME="${5:-phase-execute}"
# Treat empty string as default too (POSIX param-expansion semantics: ${5:-X}
# only kicks in when $5 is unset; explicit "" passes through. Re-coerce here.)
COMMAND_NAME="${COMMAND_NAME:-phase-execute}"

# Resolve to absolute path so the new terminal lands in the right place
# even if the caller passed a relative path.
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

# Assemble the spawn command. The leading `export CLAUDE_PHASE_SESSION=1 && ...`
# lets the handoff skill's detect-mode.sh recognize this as an executor session.
# The export rides inside the per-spawn sub-shell (osascript `do script`, `bash -c`,
# tmux/kitty cmd) — it does NOT leak into the orchestrator's environment, even if
# this script were `source`d (defense in depth per spec §10.1).
if [ -n "$PHASE_NAME_SLUG" ]; then
    # Display form with ⚡ emoji prefix (per SKILL.md data/display rule).
    # The plain slug stays in run.json#phases[N].session_name; the emoji is renderer-only.
    SESSION_TITLE="⚡ phase-$PHASE_N-$PHASE_NAME_SLUG"
    # Prefix with an OSC-2 title-set escape; the launched shell consumes it before exec'ing claude.
    COMMAND="export CLAUDE_PHASE_SESSION=1 && printf '\\033]2;%s\\007' '$SESSION_TITLE' && claude /${COMMAND_NAME} $RUN_ID $PHASE_N"
else
    COMMAND="export CLAUDE_PHASE_SESSION=1 && claude /${COMMAND_NAME} $RUN_ID $PHASE_N"
fi
HANDOFF_PATH="$PROJECT_DIR/.claude/phasing/$RUN_ID/phase-$PHASE_N-handoff.md"

# Dry-run short-circuit: echo the computed COMMAND + env-marker and exit before
# terminal detection (which is slow on darwin). Used by the test fixture.
if [ "${LAUNCH_TERMINAL_DRY_RUN:-}" = "1" ]; then
    echo "$COMMAND"
    echo "CLAUDE_PHASE_SESSION=1"
    exit 0
fi

print_fallback() {
    cat <<EOF
======================================================================
Could not auto-spawn a new terminal for phase $PHASE_N of run $RUN_ID.
Open a new terminal and run:

    cd "$PROJECT_DIR"
    $COMMAND

The orchestrator is polling for completion. In file mode, the handoff
will be written to:
    $HANDOFF_PATH
In GitHub mode, the orchestrator polls the phase issue for close + handoff comment.
======================================================================
EOF
}

# tmux — open a new window in the current session.
if [ -n "${TMUX:-}" ]; then
    tmux new-window -c "$PROJECT_DIR" "$COMMAND"
    echo "Spawned phase $PHASE_N in a new tmux window."
    exit 0
fi

# kitty — open a new tab in the current OS window.
if [ -n "${KITTY_WINDOW_ID:-}" ]; then
    if command -v kitten >/dev/null 2>&1; then
        kitten @ launch --type=tab --cwd="$PROJECT_DIR" bash -c "$COMMAND"
        echo "Spawned phase $PHASE_N in a new kitty tab."
        exit 0
    fi
fi

case "${TERM_PROGRAM:-}" in
    "Apple_Terminal")
        # Terminal.app — opens a new window with the command.
        osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "cd '$PROJECT_DIR' && $COMMAND"
end tell
APPLESCRIPT
        echo "Spawned phase $PHASE_N in a new Terminal.app window."
        exit 0
        ;;

    "iTerm.app")
        # iTerm2 — create a new tab in the current window.
        osascript <<APPLESCRIPT
tell application "iTerm"
    activate
    tell current window
        create tab with default profile
        tell current session of current tab
            write text "cd '$PROJECT_DIR' && $COMMAND"
        end tell
    end tell
end tell
APPLESCRIPT
        echo "Spawned phase $PHASE_N in a new iTerm tab."
        exit 0
        ;;

    "WezTerm")
        if command -v wezterm >/dev/null 2>&1; then
            wezterm cli spawn --cwd "$PROJECT_DIR" -- bash -c "$COMMAND"
            echo "Spawned phase $PHASE_N in a new WezTerm tab."
            exit 0
        fi
        ;;

    "vscode")
        # VS Code integrated terminal — opening a new terminal tab via AppleScript or `code` CLI is
        # unreliable. The `code` CLI can open the workspace but doesn't directly spawn a new
        # terminal tab inside the running window. Most reliable approach: print the fallback.
        echo "Detected VS Code integrated terminal. Auto-spawn isn't reliably supported here." >&2
        echo "" >&2
        print_fallback
        exit 0
        ;;

    "Warp")
        # Warp supports `warp-cli` for some operations; check if available.
        if command -v warp-cli >/dev/null 2>&1; then
            warp-cli launch --new-tab --cwd "$PROJECT_DIR" "$COMMAND" 2>/dev/null && {
                echo "Spawned phase $PHASE_N in a new Warp tab."
                exit 0
            }
        fi
        # Fall through to fallback if warp-cli unavailable.
        ;;
esac

# No known terminal — print the fallback instructions.
print_fallback
exit 0
