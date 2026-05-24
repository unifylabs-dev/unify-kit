---
description: Manually mark a handoff as consumed without resuming. Flips the frontmatter `status` from `pending` to `consumed`, sets `consumed_by_session`, and removes the matching MEMORY.md pointer. Idempotent — re-running on an already-consumed handoff is a no-op with a confirmation message.
---

The user invoked `/handoff-done` with arguments: `$ARGUMENTS`

Use the `handoff` skill in **done mode**. Flips frontmatter `status` to `consumed` and removes the MEMORY.md pointer.

## Steps

1. **Validate `$ARGUMENTS`.** Must be a single path to an existing handoff file. If missing or unreadable, emit:

   ```
   Usage: /handoff-done <path-to-handoff>
   ```

   and exit.

2. **Read frontmatter.** Extract `metadata.status` via:

   ```bash
   awk '/^---$/{c++; next} c==1 {print} c>=2 {exit}' "$path"
   ```

   If `status: consumed` already, print `Already consumed: <path>` and exit (idempotent).

3. **Atomic frontmatter flip** — `pending → consumed`, populate `consumed_by_session`:

   ```bash
   awk '
     BEGIN { c=0 }
     /^---$/ { c++ }
     c==1 && /^  status: pending$/        { sub("pending","consumed") }
     c==1 && /^  consumed_by_session: null$/ { sub("null","'"${CLAUDE_SESSION_ID:-manual-handoff-done}"'") }
     { print }
   ' "$path" > "$path.tmp" && mv "$path.tmp" "$path"
   ```

   (Replace `${CLAUDE_SESSION_ID:-manual-handoff-done}` with whatever session identifier is available.)

4. **Remove MEMORY.md pointer** matching this handoff's relative path. If `MEMORY.md` exists:

   ```bash
   rel=$(realpath --relative-to=. "$path" 2>/dev/null || python3 -c "import os,sys;print(os.path.relpath(sys.argv[1]))" "$path")
   awk -v rel="$rel" '!index($0, "("rel")")' MEMORY.md > MEMORY.md.tmp && mv MEMORY.md.tmp MEMORY.md
   ```

   If no MEMORY.md exists, skip silently.

5. **Echo confirmation.**

   ```
   Marked consumed: <path>
   Pointer removed from MEMORY.md.
   ```

## Hard rules

- **Idempotent.** Re-running on a consumed handoff is a no-op + message. Never error.
- **Atomic write.** Always temp-file-then-mv. Never `sed -i`.
- **Never delete the handoff file.** Consume is a frontmatter flip, not a removal.
