---
description: Archive a completed phasing run. Moves local run dir to .claude/phasing/archive/<YYYY>/<run-id>/. In GitHub mode, also adds phasing:archived label to the tracking issue and posts an archive comment. Useful retroactively if the run-end archive prompt was skipped.
---

The user invoked `/phase-archive` with arguments: `$ARGUMENTS`

Parse arguments. Forms:
- `/phase-archive <run-id>` — archive a single run.
- `/phase-archive <run-id> --force` — override status precondition (only for emergencies).
- `/phase-archive --all-completed` — bulk archive all `complete` runs.
- `/phase-archive --before-date YYYY-MM-DD` — bulk archive `complete | failed | aborted` runs older than that date.

Use the `phasing` skill, specifically `references/archive-policy.md`.

## Behavior

1. **Locate run(s)**: scan `<project-root>/.claude/phasing/` for matching run dirs.

2. **Status precondition check** (per `references/archive-policy.md`):
   - `complete` / `failed` / `aborted` → eligible for archive.
   - `in_progress` → refuse unless `--force` (logs warning + sets status to `aborted` with `force_archived: true`).
   - Already archived (destination exists) → refuse.

3. **Run the archive script** for the file-move portion:
   ```bash
   ~/.claude/skills/phasing/scripts/archive-run.sh <run-id> [--force]
   # or for bulk:
   ~/.claude/skills/phasing/scripts/archive-run.sh --all-completed
   ~/.claude/skills/phasing/scripts/archive-run.sh --before-date <YYYY-MM-DD>
   ```
   The script handles the local move only. Cross-reference its exit codes:
   - 0 — at least one run moved
   - 1 — argument error / missing prerequisite (e.g., jq not installed)
   - 2 — no eligible runs / all targets refused

4. **GitHub mode follow-up** (per archived run, if `mode: github` in run.json):
   - Add label: `gh issue edit <tracking-issue> --add-label "phasing:archived"`
   - Add archive comment: `gh issue comment <tracking-issue> --body "Run archived on $(date -u +%Y-%m-%d). Local state moved to archive/<YYYY>/<run-id>/."`
   - Skip silently if `gh` not available or auth missing — the file move is done; the labeling is a nice-to-have.

5. **Report back** to user:
   ```
   Archived: 2026-04-30-rest-api → archive/2026/2026-04-30-rest-api/
   GitHub: tracking issue #42 labeled phasing:archived + archive comment posted.

   3 runs remain active in .claude/phasing/.
   ```

## Selecting active vs archived runs (for the user)

Active (file mode):
```bash
ls .claude/phasing/ | grep -v ^archive$
```

Archived (any year):
```bash
find .claude/phasing/archive -mindepth 2 -maxdepth 2 -type d
```

Active (GitHub mode):
```bash
gh issue list --label phasing --label phasing:tracking --search "no:label:phasing:archived" --state all
```

Archived (GitHub mode):
```bash
gh issue list --label phasing --label phasing:tracking --label phasing:archived --state all
```

## Anti-patterns

- Auto-archiving without confirmation. Always ask via `AskUserQuestion` before bulk operations.
- Deleting GitHub issues. Closed-with-archived-label is sufficient.
- Re-archiving an already-archived run. The script refuses by design.
- Force-archiving a session that's still actively running. Verify nothing is in flight first.
