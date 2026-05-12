# Archive policy

**Read when**: at run-end archive prompt (master plan lifecycle §7), OR when `/phase-archive <run-id>` is invoked.

## When archival happens

Three triggers:

1. **Run-end automatic prompt** (master plan §7): orchestrator asks via `AskUserQuestion`:
   - **Archive** (Recommended)
   - **Keep in active dir**
   - **Delete local state**
2. **Manual `/phase-archive <run-id>`**: founder invokes retroactively for a previously-skipped run.
3. **Programmatic via script flags** (see Bulk archival below).

## What "archive" means per mode

### File mode

Move `.claude/phasing/<run-id>/` → `.claude/phasing/archive/<YYYY>/<run-id>/`, where `<YYYY>` is the year the run started (from `phases[0].started_at`, fallback `created_at`).

That's it. Files remain readable; just relocated out of the active workspace.

### GitHub mode

Three actions:
1. Apply label `phasing:archived` to the tracking issue:
   ```bash
   gh issue edit <tracking-issue> --add-label "phasing:archived"
   ```
2. Add a final tracking-issue comment:
   ```bash
   gh issue comment <tracking-issue> --body "Run archived on $(date -u +%Y-%m-%d). Local state moved to archive."
   ```
3. Move local `run.json` (and any other local files for this run) to the archive dir:
   ```bash
   mkdir -p .claude/phasing/archive/<YYYY>/<run-id>
   mv .claude/phasing/<run-id>/* .claude/phasing/archive/<YYYY>/<run-id>/
   rmdir .claude/phasing/<run-id>
   ```

GitHub issues stay `closed` where they are — closed issues are GitHub-native archived; no need to delete or move them.

## What "keep in active dir" means

Skip the archival actions entirely. The run dir stays at `.claude/phasing/<run-id>/`. Useful when a related follow-up run is expected soon (e.g., "we're done with Phase 0 but Phase 0.5 starts tomorrow and might want to reference Phase 0's run state").

## What "delete local state" means

`rm -rf .claude/phasing/<run-id>/`. Local state gone. **GitHub state is NOT deleted** — issues remain closed and findable; the run is reconstructable from GitHub history alone if needed. Use when:
- Local state has nothing useful (the GitHub issues are the canonical record).
- Disk hygiene matters more than offline accessibility.
- Founder explicitly wants the run gone from local view.

The orchestrator confirms with the founder before destructive deletion (`AskUserQuestion`: "Delete .claude/phasing/<run-id>/ permanently? GitHub issues remain.")

## Status preconditions

Archival refuses to run unless `overall_status` is `complete`, `failed`, or `aborted`. Use `--force` to override for a single run (only for emergencies — sets status to `aborted` with `force_archived: true` flag for traceability).

## Bulk archival

The `scripts/archive-run.sh` script supports:

```bash
# Single run
./scripts/archive-run.sh <run-id>
./scripts/archive-run.sh <run-id> --force      # override status precondition

# All complete runs
./scripts/archive-run.sh --all-completed

# Older than a date (status complete | failed | aborted)
./scripts/archive-run.sh --before-date 2026-01-01
```

The script handles the file-move portion. For GitHub mode, the orchestrator handles the labeling + comment via `gh` after the file move (the script can't authenticate to GitHub without the user's gh session, so we keep the script local-only).

## Selecting active vs archived runs later

### File mode
```bash
# Active runs only
ls .claude/phasing/ | grep -v ^archive$

# Archived runs (any year)
find .claude/phasing/archive -mindepth 2 -maxdepth 2 -type d

# Archived runs from a specific year
ls .claude/phasing/archive/2026/
```

### GitHub mode
```bash
# All phasing tracking issues
gh issue list --label phasing --label phasing:tracking --state all

# Active only (not archived)
gh issue list --label phasing --label phasing:tracking --search "no:label:phasing:archived" --state all

# Archived only
gh issue list --label phasing --label phasing:tracking --label phasing:archived --state all
```

## Why archive at all

Two reasons:
1. **Workspace hygiene**: a year of runs accumulates. Active dir should show what's alive, not history.
2. **Find-ability**: archived runs by year + clear labels = faster lookup later. "What did we ship in 2026 Q1?" is one `ls` command (file) or one `gh issue list` (GitHub).

The archive is **not a graveyard**. Archived runs remain readable; they just don't clutter the active surface. If you reference an archived run in a future master plan's "Required reading", point to the archive path or closed issue — both work.

## Anti-patterns

- Auto-archiving without founder confirmation. Always ask.
- Deleting GitHub issues. Closed-with-archived-label is sufficient — GitHub deletion is irreversible and loses cross-run history.
- Archiving in-progress runs without `--force`. The script refuses by design.
- Re-archiving an already-archived run. The destination check (`if [ -d "$dest/$slug" ]`) refuses overwrites.
