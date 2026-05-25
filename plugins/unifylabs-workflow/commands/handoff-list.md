---
description: List handoffs in this project (pending + consumed by default). Pass `--archived` to also include archived handoffs. Renders a markdown table with slug, created, mode, tier, status, and path so the user can pick one to resume or revive.
---

The user invoked `/handoff-list` with arguments: `$ARGUMENTS`

Use the `handoff` skill in **list mode**. Scans known handoff locations, parses each doc's frontmatter, and renders a single markdown table.

## Steps

1. **Parse `$ARGUMENTS`.** If it contains `--archived`, set `include_archived=true`; else false.

2. **Discover handoffs.** Search the following sources (skip silently if a directory does not exist):
   - `.claude/handoffs/*.md` — generic / plan-exec / work-issue / orchestrator handoffs.
   - `.claude/phasing/*/session-handoff-*.md` — phasing-orchestrator handoffs written mid-run.
   - `.claude/phasing/*/phase-*-checkpoint.md` — phase-executor checkpoints (mid-phase pauses).
   - `.superpowers/brainstorm/*/HANDOFF.md` — brainstorm session handoffs.
   - If `include_archived`: also `.claude/handoffs/archive/<YYYY>/*.md`.

3. **For each discovered file**, parse the YAML frontmatter via:

   ```bash
   awk '/^---$/{c++; next} c==1 {print} c>=2 {exit}' "$file"
   ```

   Extract: `name` (slug), `metadata.created`, `metadata.mode`, `metadata.tier`, `metadata.status`.

4. **Filter.** By default, include only handoffs with `status in (pending, consumed)`. With `--archived`, include all statuses.

5. **Render a markdown table** to chat:

   ```
   | Slug                              | Created              | Mode                  | Tier      | Status   | Path                                              |
   |-----------------------------------|----------------------|-----------------------|-----------|----------|---------------------------------------------------|
   | 2026-05-23-icon-portal-discovery  | 2026-05-23T14:02:11Z | phasing-orchestrator  | full      | pending  | .claude/handoffs/2026-05-23-icon-portal.md        |
   ```

   Sort rows newest-first by `created`. If no handoffs match, print: `No handoffs found.` (terse).

## Hard rules

- **Read-only.** This command never mutates a handoff or MEMORY.md.
- **Silent skip on parse failure.** If a file's frontmatter is malformed, emit a row with `status: ?` and `slug: <filename>` rather than crashing the whole listing.
