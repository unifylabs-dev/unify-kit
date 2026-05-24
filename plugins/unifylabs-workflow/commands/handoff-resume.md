---
description: Resume a pending handoff in a fresh session. Auto-detects from MEMORY.md unless a path is provided. Runs freshness-check, surfaces drift, rebuilds the TaskList, flips frontmatter to consumed, then continues per the handoff's §7 Resume instructions.
---

The user invoked `/handoff-resume` with arguments: `$ARGUMENTS`

Use the `handoff` skill in **resume mode**. Follow the 6-step protocol from design spec §8.3 and `${CLAUDE_PLUGIN_ROOT}/skills/handoff/references/resume-protocol.md`.

## Steps

1. **Resolve handoff path.**
   - If `$ARGUMENTS` is non-empty and points to an existing file, use it directly.
   - Else scan `MEMORY.md` for pointer lines matching `- [Pending handoff —` whose linked doc has `metadata.status: pending`.
   - If exactly one pending handoff: use it.
   - If 2–4 pending: surface `AskUserQuestion` with one option per handoff (label = `<slug> · <created> · <mode>`).
   - If ≥5 pending: refuse to auto-resume and direct the user to `/handoff-list` first.
   - If zero: report "No pending handoff found." and exit.

2. **Run freshness-check.** Invoke `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/freshness-check.sh <path>` and parse the JSON. Read `.overall`.

3. **Branch on overall verdict** (rules from `references/resume-protocol.md` §4):
   - `clean` → silent proceed to step 4.
   - `drift_detected` → surface a one-line drift summary (e.g., "HEAD drifted from `<expected>` to `<actual>`, 2 files moved") and `AskUserQuestion`:
     - `Continue resume` / `Investigate first` / `Mark consumed and start fresh`.
   - `fatal` → **refuse auto-resume**. Surface what is missing (specific load-bearing paths, branch absence, etc.). `AskUserQuestion`:
     - `Investigate` / `Open an empty session` / `Mark consumed and start fresh`.
     - Do NOT load the handoff content into the working context until the user explicitly overrides.

4. **Rebuild the TaskList.** Invoke `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/recreate-tasklist.sh <path>` and read its stdout line-by-line. For each line:
   - `TaskCreate <subject> <description>` → invoke the `TaskCreate` tool with those arguments.
   - `TaskUpdate <n> completed` → invoke `TaskUpdate` with `taskId=<n>` and `status=completed`.
   - `TaskUpdate <n> in_progress` → invoke `TaskUpdate` with `taskId=<n>` and `status=in_progress`.

5. **Flip frontmatter `status: pending → consumed`.** Atomic write:

   ```bash
   awk 'BEGIN{c=0} /^---$/{c++} c==1 && /^  status: pending$/{sub("pending","consumed")} c==1 && /^  consumed_by_session: null$/{sub("null","<current-session-id>")} 1' "$path" > "$path.tmp" && mv "$path.tmp" "$path"
   ```

   Replace `<current-session-id>` with the actual current session identifier (best-effort: read `${CLAUDE_SESSION_ID:-unknown}` or similar).

6. **Continue per §7 Resume instructions.** Read the handoff's §7 block. Read every file listed in §4.2. Respect every §2 lock and every §6 do-not-re-litigate entry. Pick up the `[in_progress]` task from §5 and continue work.

## Hard rules

- **Never load handoff content into working context before freshness-check passes.** A `fatal` verdict means the world the prior session knew is unrecoverable; loading content risks hallucinated continuation.
- **Atomic frontmatter mutation.** Never `sed -i` directly on the handoff file; always `awk … > tmp && mv tmp <path>`.
- **Do not delete the handoff file.** Consume is a metadata flip, not a removal. Historical inspection has value.
