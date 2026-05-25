---
description: Revive a previously-consumed handoff back to pending. Flips `status: consumed → pending`, clears `consumed_by_session`, and re-adds the MEMORY.md pointer at the top of the index. Use when the user accidentally picked "Mark consumed" at the SessionStart prompt and now wants the handoff back.
---

The user invoked `/handoff-revive` with arguments: `$ARGUMENTS`

Use the `handoff` skill in **revive mode**. Reverses `/handoff-done` — flips frontmatter back to pending and restores the MEMORY.md pointer.

## Steps

1. **Validate `$ARGUMENTS`.** Must be a single path to an existing handoff file. If missing or unreadable, emit:

   ```
   Usage: /handoff-revive <path-to-handoff>
   ```

   and exit.

2. **Read frontmatter.** Extract `metadata.status` via:

   ```bash
   awk '/^---$/{c++; next} c==1 {print} c>=2 {exit}' "$path"
   ```

   If `status: pending` already, print `Already pending: <path>` and exit (idempotent).

3. **Atomic frontmatter flip** — `consumed → pending`, clear `consumed_by_session`:

   ```bash
   awk '
     BEGIN { c=0 }
     /^---$/ { c++ }
     c==1 && /^  status: consumed$/             { sub("consumed","pending") }
     c==1 && /^  consumed_by_session: / && !/null$/ {
       sub(/consumed_by_session: .*/, "consumed_by_session: null")
     }
     { print }
   ' "$path" > "$path.tmp" && mv "$path.tmp" "$path"
   ```

4. **Restore MEMORY.md pointer at the top.** Read the handoff's frontmatter to extract `name` (slug), `metadata.created`, `metadata.mode`, `metadata.tier`, and `description`. Compute the relative path. Build the §8.2 pointer line:

   ```
   - [Pending handoff — <description>](<rel-path>) — created <created>, mode <mode>, tier <tier>. RESUME FIRST in fresh session if continuing <description>.
   ```

   If MEMORY.md exists and does NOT already contain this pointer, prepend it. If MEMORY.md does not exist, create it with the pointer line as the first content line under a single-line header.

5. **Echo confirmation.**

   ```
   Revived: <path>
   Pointer restored to MEMORY.md (top of index).
   ```

## Hard rules

- **Idempotent.** Re-running on a pending handoff is a no-op + message.
- **Atomic write.** Always temp-file-then-mv.
- **Pointer at the top.** Revived handoffs should be the next thing the user sees at SessionStart, matching the newest-first ordering in MEMORY.md.
