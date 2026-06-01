# Resume protocol — fresh session continuation

**Read when**: on the resume side of a handoff. The SessionStart hook has fired, MEMORY.md pointer is in scope, and the user has confirmed Resume now. This reference covers the end-to-end flow, the three script contracts, drift handling, consume cleanup, and the 9 edge cases that have specific handling.

The write side is owned by `SKILL.md` Lifecycle (which references `references/core-shape.md` for body content). This reference is the read side.

---

## 1. End-to-end resume flow (numbered procedure)

```text
1. SessionStart hook scans MEMORY.md for `Pending handoff` lines.
2. If any found, hook injects guidance into Claude's initial context
   ("Pending handoff detected: <path>; ASK the user via AskUserQuestion ...").
3. Claude asks the user via AskUserQuestion (3 options below).
4. On Resume: freshness-check.sh runs against handoff §4 World state.
5. Drift report surfaced if any; user decides how to proceed.
6. recreate-tasklist.sh emits TaskCreate / TaskUpdate payloads; Claude
   executes them in order to rebuild the TaskList spinner state.
7. Frontmatter status: pending → consumed (atomic write — temp file +
   rename).
8. Claude reads §7 Resume instructions and continues. Picks up the
   [in_progress] task from §5; respects every §2 lock and §6 do-not-
   re-open entry.
```

Step 1's hook lives at `plugins/unifylabs-workflow/hooks/context-awareness.sh` (P3 deliverable). The hook is registered on `SessionStart` and `UserPromptSubmit` per `hooks.json`. This reference does not duplicate the hook implementation — see P3's deliverable.

---

## 2. AskUserQuestion shape (the resume prompt)

When the SessionStart hook detects a pending handoff, Claude asks the user:

```text
"Pending handoff detected: <topic-from-description>
 Created: <relative-time, e.g., '2h ago'>
 Mode: <mode>  ·  Tier: <tier>  ·  Written at <pct>% context.
 Resume?"

Options:
  1. Resume now (Recommended) — load handoff, run freshness-check,
     rebuild TaskList, continue.
  2. Not this session, leave pending — pointer stays in MEMORY.md;
     handoff stays pending. Will re-prompt next session.
  3. Mark consumed, don't resume — flip frontmatter to consumed
     and drop pointer from MEMORY.md. Handoff doc stays on disk
     forever (forensics).
```

Default: **option 1 (Recommended)**. If the user picks option 2, the pointer stays — silently re-prompted on the next SessionStart in this project. If option 3, the user can later run `/handoff revive <path>` to flip status back to pending (per the edge-case table below).

---

## 3. `scripts/freshness-check.sh` contract

Implementation lives in P2; this reference describes the contract.

**Input:** path to handoff doc (positional arg).

**Output:** JSON to stdout, single object.

```json
{
  "git_check": {
    "status": "match" | "drift" | "skipped",
    "expected_head": "<sha>",
    "actual_head": "<sha>",
    "expected_branch": "<name>",
    "actual_branch": "<name>",
    "working_tree": "clean" | "dirty:<file-list>"
  },
  "load_bearing_files": [
    { "path": "<path>", "status": "exists" | "missing" | "moved" }
  ],
  "run_json_check": {
    "status": "match" | "drift" | "n/a",
    "expected_phase_array": [...],
    "actual_phase_array": [...]
  },
  "overall": "clean" | "drift_detected" | "fatal"
}
```

Sub-block notes:

- `git_check.status`: `match` = expected vs actual HEAD + branch agree; `drift` = at least one disagrees; `skipped` = the handoff did not record git state (non-git context).
- `git_check.working_tree`: `clean` if no uncommitted changes; otherwise `dirty:<file-list>` with comma-separated paths.
- `load_bearing_files`: array of every file listed in handoff §4.2, with current existence/moved status. A `moved` status means the basename was found elsewhere via `find`.
- `run_json_check.status`: `match` = handoff phase array equals current `run.json` phase array; `drift` = at least one phase status changed; `n/a` = the handoff did not record run state (non-phasing context).
- `overall`: rolled-up verdict (see §4 below).

---

## 4. Drift handling rules

The `overall` field drives the resume behavior:

| Verdict | Behavior |
|---|---|
| `clean` | Silent proceed. Skill executes steps 6–8 of the resume flow without surfacing anything to the user. |
| `drift_detected` | Surface drift summary to user via AskUserQuestion: "Drift detected: <one-line summary>. Continue resume / Investigate first / Mark consumed and start fresh." User decides. |
| `fatal` | **Refuse auto-resume.** Surface what's missing (e.g., "branch `<branch>` no longer exists; HEAD SHA `<sha>` not in current history"); offer Investigate / Open-empty-session / Mark-consumed-and-start-fresh. Do NOT load handoff content into Claude's working context until user explicitly overrides. |

Rule of thumb: `clean` means the world looks the way the prior session expected; `drift_detected` means the world has moved but recovery is plausible; `fatal` means the world the prior session knew is unrecoverable from this point.

---

## 5. `scripts/recreate-tasklist.sh` contract

Implementation lives in P2; this reference describes the contract.

**Input:** path to handoff doc (positional arg). Script parses the §5 TaskList snapshot block per `references/core-shape.md` §5 parser rules.

**Output:** shell-quoted command sequence on stdout, one command per line.

```bash
# example output for a handoff with 3 completed, 1 in_progress, 2 pending
TaskCreate "fetch user records" "Query users table by tenant_id"
TaskCreate "validate schema" "Run zod schema against fetched records"
TaskCreate "apply transformation" "Map records into export format"
TaskCreate "stream to S3" "Upload transformed records to bucket"
TaskCreate "verify upload" "Confirm checksum matches"
TaskCreate "log success" "Write completion record to audit log"
TaskUpdate 1 completed
TaskUpdate 2 completed
TaskUpdate 3 completed
TaskUpdate 4 in_progress
```

Claude reads this output, then issues the actual tool calls in order. The script does not call the tools itself — its job is the parse + emit, not the dispatch.

Parser invariants (enforced; mismatch → script exits non-zero with stderr error):

- Exactly one `[in_progress]` task allowed.
- Status enum is `[pending]` / `[in_progress]` / `[completed]` — no other values accepted.
- Task subjects and descriptions are properly shell-quoted (handles embedded quotes, newlines).
- Order in output matches order in source — `TaskCreate` calls emitted first, then `TaskUpdate`s.

---

## 6. Consume cleanup (idempotent)

After a successful resume (step 7 of the flow), the handoff's frontmatter `metadata.status` flips from `pending` to `consumed` via atomic write (temp file + rename). The MEMORY.md pointer to the consumed handoff also needs to be removed — otherwise the next SessionStart hook will re-prompt for a handoff that has already been resumed.

**The cleanup:** at every SessionStart, the hook scans MEMORY.md for `Pending handoff` pointer lines. For each pointer, it reads the linked handoff's frontmatter and checks `metadata.status`. If `consumed`, the hook removes that pointer line from MEMORY.md (atomic rewrite).

**Idempotency:** running this scan when no consumed pointers exist is a silent no-op. Running it after a handoff doc has been deleted manually is also a no-op (the missing-file case is handled by edge case 6 below, which warns the user and removes the orphan pointer).

The cleanup is silent — no chat noise. It runs as part of the hook's SessionStart processing before Claude's first turn.

---

## 7. Edge cases (9 rows, lifted verbatim from design spec §8.8)

| Edge case | Handling |
|---|---|
| User opens fresh session for unrelated work; pending handoff exists | AskUserQuestion fires with "Not this session" option; pointer stays |
| MEMORY.md doesn't exist yet | Skill creates with index header on first handoff write |
| Multiple pending handoffs (≥2) | AskUserQuestion lists each as option (cap 4); ≥3 pending → use `/handoff-list` |
| Pending handoff's project_root != current cwd | Hook detects; reminder says "Pending handoff is for project `<X>`; current is `<Y>`." Pointer NOT loaded into Claude's context unless user explicitly picks it |
| User accidentally picks "Mark consumed" | `/handoff-revive <path>` flips status back to pending, re-adds MEMORY.md pointer |
| Handoff file deleted manually | Hook detects orphan MEMORY.md pointer on next SessionStart; auto-removes pointer + warns user |
| Freshness check `fatal` | Claude refuses auto-resume; surfaces what's missing; offers investigate / open-empty-session / mark-handoff-consumed-and-start-fresh |
| Stale handoff (>30 days, still pending) | SessionStart hook tags option label with "STALE"; user typically picks Mark consumed |
| User runs /handoff twice in same session | Second supersedes first; first's status set to `superseded`; second becomes active pointer. Forensic doc 1 still on disk |

The corresponding slash commands (`/handoff-list`, `/handoff-revive`) are owned by P2.

---

## 8. What this reference does not cover

- **Hook implementation** — `context-awareness.sh` lives in P3's deliverable; its context-% computation (prefers the harness-native `context_window.used_percentage` window-fraction, falling back to transcript-tokens ÷ model window) and threshold-driven injection logic are in `plugins/unifylabs-workflow/hooks/context-awareness.sh` and its README.
- **MEMORY.md pointer format** — owned by `SKILL.md` Lifecycle (lifted verbatim from design spec §8.2). This reference describes the consume cleanup *behavior*, not the pointer format itself.
- **Archive lifecycle** — consumed handoffs older than 30 days are eligible for archive to `.claude/handoffs/archive/<YYYY>/`. v1 ships without auto-archive; manual `mv` works. See design spec §11 (deferred).
