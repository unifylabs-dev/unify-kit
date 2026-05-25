# Mode detection — signals, contract, limitations

**Read when**: implementing or debugging `scripts/detect-mode.sh`, or reasoning about why a session detected as `generic` when an addendum-bearing mode was expected.

The skill auto-detects which mode the current session is in at `/handoff` invocation time. The detected mode drives addendum selection (per `SKILL.md` stacking precedence) and file-path selection (per `SKILL.md` lifecycle write phase).

---

## 1. Signal table

The six modes and the file-system / environment signals `detect-mode.sh` consults:

| Mode | Signal |
|---|---|
| `phasing-orchestrator` | `.claude/phasing/<run>/run.json` with `overall_status: in_progress` exists in cwd AND current session-name matches `orchestrator-<topic-slug>` |
| `phasing-executor` | Session-name matches `phase-<N>-<slug>` pattern AND `/phase-execute` was the entry point |
| `brainstorm` | `.superpowers/brainstorm/<id>/` exists with recent mtime OR a `docs/superpowers/specs/<recent>-design.md` is being drafted OR `superpowers:brainstorming` was active |
| `plan-exec` | `~/.claude/plans/<plan>.md` was loaded in this session OR `superpowers:executing-plans` is active |
| `work-issue` | Current branch matches `gh issue list` linkage OR `/work-issue` was invoked OR `.claude/work-issue/*` state present |
| `generic` | No other signal matches |

Detection runs at `/handoff` invocation time. The output is JSON written to stdout, capturing the primary mode and any paths the writer needs.

---

## 2. JSON output contract

`scripts/detect-mode.sh` (built in P2 of run `2026-05-24-handoff-skill-build`) is the implementation; this reference describes its contract. The skill consumes this JSON; any change to keys / shape requires a coordinated edit here.

**Input:** cwd, current session metadata (session name, environment variables).

**Output:** JSON to stdout, single object.

```json
{
  "mode": "phasing-orchestrator" | "phasing-executor" | "brainstorm" | "plan-exec" | "work-issue" | "generic",
  "secondary_modes": [],
  "paths": {
    "run_json": "<abs-path-or-null>",
    "master_plan": "<abs-path-or-null>",
    "phase_spec": "<abs-path-or-null>",
    "design_doc_target": "<abs-path-or-null>",
    "plan_file": "<abs-path-or-null>",
    "gh_issue_number": <int-or-null>,
    "brainstorm_dir": "<abs-path-or-null>"
  }
}
```

Field notes:

- `mode` is the *primary* detected mode. Exactly one of the six values.
- `secondary_modes` is an array (possibly empty) of additional modes that fire. The writer uses this to know which addenda to stack (per `SKILL.md` precedence ordering).
- `paths` is a flat object. Every key is always present; absent paths are `null`. The writer keys off non-null values to pick the write path and to populate addendum sub-sections.
- `gh_issue_number` is an integer or null — used by the work-issue addendum for the issue-identity sub-section.

---

## 3. Stacking precedence (cross-reference)

When more than one mode fires (e.g., phasing-orchestrator that is currently mid-brainstorming for a new phase), the addenda stack in fixed order — owned by `SKILL.md`:

```text
§8 = phasing-orchestrator OR phasing-executor (highest priority; mutually exclusive)
§9 = brainstorm (if applicable)
§10 = plan-exec (if applicable; usually subsumed by phasing-executor when both fire)
§11 = work-issue (if applicable)
```

Detection runtime emits the primary mode (which becomes §8) and any others go into `secondary_modes` in this priority order.

---

## 4. Generic mode

If no signal matches, mode is `generic` and **no addendum is appended**. The 7-section core is sufficient. Frontmatter `metadata.mode` carries `generic`; the writer skips §8+ entirely.

This is the common case for ad-hoc free-conversation sessions. Don't overthink it — generic is a healthy result, not a fallback failure.

---

## 5. Phasing-executor detection: env-var limitation (IMPORTANT)

`phasing-executor` detection is harder than the other five modes because Claude Code session-name detection from inside a running session is unreliable. The implementation relies on an environment variable set by the spawning script:

- `CLAUDE_PHASE_SESSION=1` is exported by `plugins/unifylabs-workflow/skills/phasing/scripts/launch-terminal.sh` before exec-ing `claude` (this export is added by P7 of run `2026-05-24-handoff-skill-build`).
- `detect-mode.sh` checks `$CLAUDE_PHASE_SESSION` and, if set to `1`, marks mode as `phasing-executor` (combined with the session-name pattern check for the slug component).

**The limitation:** `launch-terminal.sh` versions deployed before P7 do not export `CLAUDE_PHASE_SESSION`. If a phasing run was started under an older `launch-terminal.sh` (active in-flight runs at the time of the P7 ship), executor sessions in that run will not have the env var set. `detect-mode.sh` will fall back to `generic` for those sessions.

**Consequence:** `/handoff` in such a session writes a `generic` handoff (no phasing-executor addendum, no `phase-N-checkpoint.md`-style path). The user can manually override by passing `--mode=phasing-executor` to `/handoff` (subcommand surface owned by P2), but the auto-detection will not fire.

**This is a documented limitation, not a bug.** Cutting over in-flight runs to the new `launch-terminal.sh` is the documented P10 cutover procedure of run `2026-05-24-handoff-skill-build`.

---

## 6. Detection trace (debugging)

When `--debug` is passed to `detect-mode.sh` (subcommand surface owned by P2), the script also emits a trace block to stderr explaining why each signal fired or didn't fire:

```text
[detect-mode] checking phasing-orchestrator: run.json found at .claude/phasing/2026-04-30-foo/run.json with overall_status=in_progress; session_name=orchestrator-foo MATCHES pattern → fires
[detect-mode] checking phasing-executor: CLAUDE_PHASE_SESSION env var=UNSET → does not fire
[detect-mode] checking brainstorm: .superpowers/brainstorm/ does not exist → does not fire
[detect-mode] checking plan-exec: no plan file in $loaded_files → does not fire
[detect-mode] checking work-issue: branch=main has no linked gh issue → does not fire
[detect-mode] result: primary=phasing-orchestrator, secondary=[]
```

This is the troubleshooting surface when a session detects as `generic` and the user expected otherwise.
