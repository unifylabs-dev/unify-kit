---
name: handoff
description: >
  Write a structured session-handoff doc so a fresh Claude session can resume the current work
  cold — same decisions, same task state, same world state, same do-not-re-litigate guardrails.
  The canonical response when conversational context gets full and quality starts degrading. Use
  proactively when the user says or clearly implies any of: explicit slash commands (/handoff,
  /handoff-resume, /handoff-list, /handoff-done, /handoff-revive, /handoff lean, /handoff
  emergency); context-pressure framings ("getting close to context limits", "this convo is
  getting long", "save the session state", "dump what I've got so a fresh session can pick up",
  "context rescue", "session transfer"); mid-mode framings ("im in the middle of orchestrating",
  "about to checkpoint this phase mid-flight", "this brainstorm is getting deep, wanna save it",
  "i need to bail out of this session"); or resume-side language ("yesterday i left off
  mid-something, can you pick up", "what was i working on", "there's a pending handoff
  somewhere", "pick up where i left off"). Auto-detects mode (phasing-orchestrator,
  phasing-executor, brainstorm, plan-exec, work-issue, generic) and stacks the right
  mode-addendum on a 7-section universal core. Tiered FULL <50% / LEAN 50–64% / EMERGENCY ≥65% to
  trade output detail against context %. Handles the resume side too: SessionStart hook flags
  pending handoffs, AskUserQuestion confirms, freshness-check + recreate-tasklist rebuild state.
  Do NOT trigger for: plain summarization ("summarize what we discussed"), file-system saves
  ("save this file"), the phasing checkpoint flow (/phase-continue), semantic delegation
  ("/handoff this task to engineering"), or vague continuation requests when no handoff exists
  ("continue what you were doing").
tags: [handoff, context-rescue, session-transfer, plan-mode, multi-session]
---

# Handoff — universal session-to-session knowledge transfer

This skill makes session→session knowledge transfer a first-class primitive. When context pressure threatens a session's deliverable quality, the user (or Claude with discretion) invokes `/handoff` to write a structured document that a fresh Claude session can pick up cold — same decisions, same task state, same world state, same do-not-re-litigate guardrails.

The skill ships alongside a `context-awareness.sh` hook (registered on `UserPromptSubmit` + `SessionStart`) and an additive extension to the `phasing` skill (a `phase-N-checkpoint.md` flow + `/phase-continue` for the phase-executor mid-flight case). Together they cover the four transition types from the design spec.

---

## Why this skill exists

The founder regularly notices conversational context approaching pressure thresholds (35% awareness, 45–50% reset target) across multiple workflow modes — phasing orchestrator, phasing executor, brainstorming, plan execution, free conversation. Without a canonical handoff machinery, the response is manual and inconsistent: the founder asks Claude to "write a handoff doc", which is often too late, has no consistent shape, and loses crucial conversational nuance (mid-conversation locks, direction changes, surveyed-and-rejected options).

The gap matrix the design spec identified:

| Scenario | Has handoff today? | Triggered by? | Documented in skill? |
|---|---|---|---|
| Phase end → next phase (`phase-N-handoff.md`) | ✅ Mandatory | Phase completion/failure | ✅ Yes (phasing skill) |
| Orchestrator mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ Improvised |
| **Phase executor mid-flight context rescue** | ❌ **Nothing** | — | ❌ |
| Brainstorming mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ |
| Plan-execution mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ |
| Free-conversation mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ |

This skill (plus the hook and the phasing extension) closes every row except the first (which was already covered by phasing).

---

## When to use (two paths)

### Path A — User-invoked via `/handoff` (primary)

The user types `/handoff` (or a tier variant like `/handoff lean`, `/handoff emergency`). The skill takes over: detects mode, computes tier, runs the natural-break gate, writes the handoff at the mode-appropriate path, appends a MEMORY.md pointer, prints a terse confirmation, exits. The user opens a fresh terminal; the SessionStart hook handles resume from there.

This is the primary path. The user retains executive control over when handoffs happen.

### Path B — Claude discretion in response to hook reminders

The `context-awareness.sh` hook (P3 deliverable) fires on every `UserPromptSubmit`. Above 40% context, it injects a `Context-awareness: ~<N>%. Mode: <detected-mode>` reminder into Claude's next-turn context. **The hook is awareness, not instruction.** It does NOT force an `AskUserQuestion`. Claude decides whether to surface based on the discretion rules table (load-bearing — reproduced verbatim below).

Path B is how the skill gets engaged proactively. The discretion table is what governs whether Claude stays silent, surfaces a one-liner, or recommends `/handoff` outright.

---

## Mental model — the four transition types

Per design spec §2.3, this skill (plus the hook and phasing extension) covers four transitions:

1. **Generic → fresh generic** — brainstorm, plan-exec, free conversation hits pressure. Mode is `generic` or the matched specific mode; resume is via SessionStart hook + AskUserQuestion.
2. **Orchestrator → fresh orchestrator** — phasing orchestrator hits pressure mid-run. The §8.A addendum captures mid-conversation locks and direction changes that `/phase-resume` alone cannot recover.
3. **Phase executor → orchestrator** — phase executor hits pressure mid-execute. Writes `phase-N-checkpoint.md` (the §8.B addendum, full content in `phasing/references/checkpoint-shape.md`); the orchestrator's polling extension detects it and surfaces a 4-option menu.
4. **Phase executor → fresh phase executor** — orchestrator decides to continue the paused phase via `/phase-continue` (P7 deliverable). The fresh executor loads `phase-N-checkpoint.md` instead of re-running completed work.

---

## The 7-section universal core (with per-tier trim rules)

Every handoff body follows a fixed 7-section shape. Mode addenda append as §8+. The tier (FULL / LEAN / EMERGENCY) controls section *depth*, never section *presence*.

| § | Title | Purpose | FULL | LEAN | EMERGENCY |
|---|---|---|---|---|---|
| 1 | Trajectory (what happened) | Narrative arc of the session | 3–8 paragraphs prose | ~10-bullet timeline | Skipped |
| 2 | Locked decisions (durable contract) | Decisions that bind future sessions; non-negotiable | Full bullets, with rationale per bullet | Full bullets | Full bullets (never trimmed) |
| 3 | Open items not yet locked | Known unresolved questions | Bullets + brief context | Bullets only | Bullets only |
| 4 | World state (git + files + run-state) | Concrete reference state for freshness checks | All three sub-blocks fully populated | All three, prose trimmed | All three (never trimmed — freshness-check parses this) |
| 5 | TaskList snapshot | Recreate-via-helper block, fixed format | Full bullets w/ descriptions | Full bullets w/ descriptions | Full bullets w/ descriptions (never trimmed — load-bearing) |
| 6 | Do-not-re-litigate (anti-rot guard) | Explicit "don't reopen" framing of §2 + surveyed-and-rejected list | Both halves | Decisions only; surveyed-and-rejected list compressed | Decisions only |
| 7 | Resume instructions (numbered, in order) | Playbook for fresh session | Full 5-step list | Same 5 steps, terser | Same 5 steps, terser |

Templates, field discipline, and the explicit "NEVER trimmed" markers live in `references/core-shape.md`.

---

## Tier selection

| Tier | Context at invocation | Approximate write cost | Approximate output |
|---|---|---|---|
| FULL | <50% | 3–5% | 200–400 lines |
| LEAN | 50–64% | 1.5–2.5% | 100–150 lines |
| EMERGENCY | ≥65% | 0.5–1% | 40–70 lines |

Override rules:

- `/handoff lean` — force LEAN regardless of context %.
- `/handoff emergency` — force EMERGENCY regardless of context %.
- `/handoff full` — explicit FULL (implicit default if <50%).
- `/handoff` — auto-select per the table.

**75% safety check:** before committing to a tier, the skill estimates output size and warns if the write would push the session past 75% context. The user can downgrade or override. Pre-write size estimate logic and the verbatim warning text live in `references/tier-logic.md`.

---

## Natural-break gate

On `/handoff` invocation, the skill checks for mid-task signals (an `[in_progress]` TaskList task, in-flight `gh` commands, recent edits without verification). If mid-task, it asks via `AskUserQuestion`:

```text
"Currently mid-task: <one-line summary>. How to proceed?"

Options:
  1. Finish current task first, then /handoff (Recommended)
  2. Write handoff now, abandon current task (in-progress captured in §5)
  3. Cancel handoff
```

Default: option 1. Option 2 writes immediately; the in-progress task is captured in §5 TaskList. The resume session picks up from that exact spot via `recreate-tasklist.sh`.

Detail in `references/tier-logic.md` and `references/core-shape.md` §5.

---

## Mode detection summary

`scripts/detect-mode.sh` (built in P2) returns one of six modes plus a JSON paths object. The signals:

| Mode | Signal |
|---|---|
| `phasing-orchestrator` | `.claude/phasing/<run>/run.json` with `overall_status: in_progress` exists in cwd AND current session-name matches `orchestrator-<topic-slug>` |
| `phasing-executor` | Session-name matches `phase-<N>-<slug>` pattern AND `/phase-execute` was the entry point (env-var `CLAUDE_PHASE_SESSION=1` is the reliable signal — see executor-detection limitation in `references/mode-detection.md`) |
| `brainstorm` | `.superpowers/brainstorm/<id>/` exists with recent mtime OR a `docs/superpowers/specs/<recent>-design.md` is being drafted OR `superpowers:brainstorming` was active |
| `plan-exec` | `~/.claude/plans/<plan>.md` was loaded in this session OR `superpowers:executing-plans` is active |
| `work-issue` | Current branch matches `gh issue list` linkage OR `/work-issue` was invoked OR `.claude/work-issue/*` state present |
| `generic` | No other signal matches |

JSON output contract + the env-var limitation note in `references/mode-detection.md`.

`generic` is a healthy result — no addendum gets appended; the 7-section core stands alone.

---

## Mode addendum stacking precedence

When multiple modes match, addenda stack in fixed order:

```text
§8 = phasing-orchestrator OR phasing-executor (highest priority; mutually exclusive)
§9 = brainstorm (if applicable)
§10 = plan-exec (if applicable; usually subsumed by phasing-executor when both fire)
§11 = work-issue (if applicable)
```

The skill respects this precedence; it doesn't try to be clever about overlapping signals.

---

## Lifecycle

### Write phase (8 steps, per design spec §8.1)

1. `detect-mode.sh` returns mode + paths.
2. Skill picks tier based on context % (or user override).
3. Natural-break gate fires if mid-task.
4. Skill picks write path per mode:
   - `generic` → `.claude/handoffs/<YYYY-MM-DD>-<slug>.md` (creates `.claude/handoffs/` if missing)
   - `phasing-orchestrator` → `.claude/phasing/<run-id>/session-handoff-<YYYY-MM-DD>.md`
   - `phasing-executor` → `.claude/phasing/<run-id>/phase-N-checkpoint.md` (per `phasing/references/checkpoint-shape.md` — note the different filename pattern + frontmatter `type: phase-checkpoint`)
   - `brainstorm` → `.superpowers/brainstorm/<id>/HANDOFF.md` (or generic path if no brainstorm dir)
   - `plan-exec` / `work-issue` → generic path (mode addendum captures the specifics)
5. Skill derives slug from conversation topic; asks user to confirm if ambiguous.
6. Single Write call: frontmatter + preamble + 7 core sections + matching addenda + footer.
7. MEMORY.md pointer append at top of index.
8. Confirmation message printed (terse, single block).

### MEMORY.md pointer format (verbatim from design spec §8.2)

```text
- [Pending handoff — <topic>](<relative-path>) — created <ISO>, mode <mode>, tier <tier>. RESUME FIRST in fresh session if continuing <topic>.
```

Multiple pointers stack newest-first if multiple pending exist.

### Resume phase

Owned end-to-end by `references/resume-protocol.md` — the SessionStart hook scans MEMORY.md, surfaces the AskUserQuestion, runs `freshness-check.sh`, runs `recreate-tasklist.sh`, flips the frontmatter to `consumed`. Three script contracts (`detect-mode.sh`, `freshness-check.sh`, `recreate-tasklist.sh`) are implemented in P2; their input/output shapes are specified in the references.

### Consume cleanup (per design spec §8.7)

Idempotent SessionStart-time scan: the hook checks each MEMORY.md `Pending handoff` pointer's linked doc, removes pointer lines for docs whose frontmatter `status: consumed`. Silent — no chat noise.

### Archive (deferred to v2)

Consumed handoffs older than 30 days are eligible for archival to `.claude/handoffs/archive/<YYYY>/`. v1 ships without auto-archive; manual `mv` works. See design spec §11.

---

## Edge cases (lifted verbatim from design spec §8.8)

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

---

## Discretion rules — LOAD-BEARING (do not paraphrase)

When the `context-awareness.sh` hook injects a `Context-awareness: ~<N>%. Mode: <detected-mode>` reminder, Claude consults this table to decide whether to stay silent, surface a one-liner, or recommend `/handoff` outright. **The wording here is calibrated against the hook's reminder text — paraphrasing breaks the calibration.** Lift exactly when responding to the hook.

| Signal | Action |
|---|---|
| Context 40–49%, mid-tool-loop, no large task ahead | Stay silent. Continue working. |
| Context 40–49%, mid-tool-loop, large task ahead | Surface at next natural pause as one-liner: *"Heads up — context ~\<N>%. If the next ask is substantial, /handoff first may be worth it."* |
| Context 40–49%, wrapping up (≤2 small tasks left) | Stay silent. Finish. |
| Context 50–59%, mid-tool-loop | Surface at next natural pause: *"At ~\<N>%. Quality risk moderate. Recommend /handoff before dispatching anything substantial."* |
| Context 50–59%, wrapping up | Surface as final remark: *"Wrapping up at ~\<N>%. Next session — consider /handoff before continuing."* |
| Context 60–69%, any state | Surface immediately: *"At ~\<N>% — quality risk significant. Strongly recommend /handoff now."* |
| Context ≥70%, any state | Surface immediately + recommend EMERGENCY tier. |
| User said "auto mode" / "just do it" | Suppress to ≤1 mention per session below 60%. Above 60%, override the suppression. |
| User just invoked /handoff | No mention. User is already handling it. |
| Multiple thresholds crossed in same session | No re-surfacing within 5 turns of last mention unless threshold escalates. |

This is the executive contract: Claude is the actor, the hook is the awareness source, this table is the rule book.

---

## Hard rules / anti-patterns

- **Never auto-write a handoff without user invocation.** The hook does not write handoffs; only the user does (via `/handoff` or by Claude surfacing the recommendation and the user accepting).
- **Never bypass the natural-break gate without explicit user opt-in.** If the user types `/handoff` while mid-task, the gate fires; the user picks. The skill doesn't decide "well, this looks fine" on the user's behalf.
- **Never load handoff content into Claude's working context before `freshness-check.sh` passes.** The freshness check is the gate against silent drift; reading the handoff body first would defeat the gate's purpose by injecting stale facts into context.
- **Never delete handoff docs automatically.** Consume = frontmatter `status: pending → consumed`, not file deletion. The doc stays on disk forever (forensics).
- **Never paraphrase the §7.4 discretion table.** The hook's reminder wording is calibrated against the verbatim text. Lift exactly when responding.
- **Never teach the hook how to compute context % in this SKILL.md.** That's `context-awareness.sh`'s job (P3 deliverable). The skill only consumes the hook's output (the `Context-awareness: ~<N>%` reminder text).
- **Never skip emoji-display-prefix rules.** Orchestrator session names display as `🎯 orchestrator-<slug>`; phase session names display as `⚡ phase-<N>-<slug>`. Emoji is added at the display layer (cards, OSC-2 titles, handoff `Origin session:` lines) only — the stored values in `metadata.origin_session_name` and `run.json` are plain text.

---

## References

Each reference file is scoped to a single concern. Read on demand.

- `references/core-shape.md` — read when actually writing the 7 sections; carries the frontmatter schema, preamble, section templates, "NEVER trimmed" markers, and the footer.
- `references/mode-detection.md` — read when implementing/debugging `detect-mode.sh` or reasoning about why a session detected as `generic` instead of the expected mode. Carries the executor-env-var limitation note.
- `references/resume-protocol.md` — read when on the resume side (SessionStart hook fired, MEMORY.md pointer detected, user picked Resume now). Carries the 3 script contracts, drift handling rules, consume cleanup, and the 9 edge cases verbatim.
- `references/tier-logic.md` — read when computing tier at invocation, surfacing the 75% pre-write warning, or implementing the natural-break gate.
- `references/addendum-phasing-orch.md` — read when mode-detection returns `phasing-orchestrator`. Defines §8.A's 6 sub-sections including the **LOAD-BEARING** Mid-conversation locks (§8.A.4) and Direction changes pending (§8.A.5) — both NEVER trimmed.
- `references/addendum-phase-exec.md` — read when mode-detection returns `phasing-executor`. Carries the path-mapping table, race-tiebreaker rule, MEMORY.md skip behavior, and `/handoff` user-prompt fork. The canonical section layout for the `phase-N-checkpoint.md` artifact lives in the phasing skill's [`phasing/references/checkpoint-shape.md`](../phasing/references/checkpoint-shape.md) (shared source of truth; read both when in phasing-executor mode).
- `references/addendum-brainstorm.md` — read when mode-detection returns `brainstorm`. Defines §8.C's 5 sub-sections.
- `references/addendum-plan-exec.md` — read when mode-detection returns `plan-exec`. Defines §8.D's 5 sub-sections.
- `references/addendum-work-issue.md` — read when mode-detection returns `work-issue`. Defines §8.E's 4 sub-sections; cross-references the `work-issue` skill at `plugins/unifylabs-workflow/skills/work-issue/`.
- `references/founder-card-checkpoint.md` — read when the orchestrator surfaces the 4-option phase-checkpoint menu. **Stub** (P6 of run `2026-05-24-handoff-skill-build` fills).

Slash commands and helper scripts ship in P2 of run `2026-05-24-handoff-skill-build`; the `context-awareness.sh` hook ships in P3.
