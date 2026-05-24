---
title: Handoff skill + context-awareness hook + phasing-checkpoint extension
date: 2026-05-23
status: design-draft (awaiting founder review before transition to writing-plans)
owners: unifylabs-workflow plugin
related:
  - ~/.claude/skills/phasing/SKILL.md (extended by this design)
  - ~/.claude/plugins/marketplaces/unify-kit/plugins/unifylabs-workflow/hooks/ (new hook lands here)
---

# Handoff skill + context-awareness hook + phasing-checkpoint extension

> Self-contained design specification. A fresh reader who has not seen the originating brainstorm should be able to understand the full design from this document alone.

---

## 1. Executive summary

**Problem:** the founder regularly notices conversational context approaching pressure thresholds (35% awareness, 45–50% reset target) across multiple workflow modes — phasing orchestrator, phasing executor, brainstorming, plan execution, free conversation. Today the response is manual: the founder asks Claude to write a session-handoff doc, then opens a fresh session and pastes context. Output quality suffers because the handoff is often written too late, with no consistent shape, and crucial conversational nuance gets lost.

**Solution:** three coordinated deliverables that collectively make session→session knowledge transfer first-class:

1. **`/handoff` skill** — universal knowledge-transfer machinery with a fixed 7-section core, mode-detected addenda, tiered write modes (FULL / LEAN / EMERGENCY) keyed to current context %, and a strict natural-break gate to protect the current session's deliverable quality.
2. **`context-awareness.sh` hook** in `unifylabs-workflow/hooks/` — fires on `UserPromptSubmit` + `SessionStart`, computes context %, and injects awareness reminders into Claude's next turn when thresholds are crossed. The hook is awareness only — it never forces an `AskUserQuestion`; Claude judges whether to surface based on documented discretion rules.
3. **Phasing-skill extension** — adds a `phase-N-checkpoint.md` artifact for the previously unhandled case of phase-executor mid-flight context pressure, plus orchestrator-side detection (extended polling, new `⏸ CHECKPOINT` status block variant, new 4-option decision menu), plus `/phase-continue <run-id> <N>` for clean continuation in a fresh executor.

**Outcome:** four transition types are covered with consistent shape, predictable lifecycle, and a hook-driven safety net. The founder retains primary control (`/handoff` is user-invoked); Claude has discretion to surface awareness when warranted; running phasing runs upgrade via a defined cutover procedure.

---

## 2. Problem statement and gap matrix

### 2.1 What works today

- **Phasing's `phase-N-handoff.md`** (per `references/handoff-shape.md`): mandatory end-of-phase deliverable. Rigid shape. Consumed by both the orchestrator (status cards, post-phase verification) and subsequent phases (predecessor context load). **Untouched by this design.**
- **Phasing's `/phase-resume`**: rebuilds orchestrator state from `run.json` + master plan + phase artifacts. Sufficient when orchestrator was only polling — insufficient when orchestrator was mid-brainstorm, mid-self-healing, or holding mid-conversation locks not yet baked into specs.
- **Ad-hoc `session-handoff-<date>.md` artifacts** in phasing run-dirs and ad-hoc `HANDOFF.md` in `.superpowers/brainstorm/<id>/` — improvised by the model on demand. Quality is inconsistent because no canonical shape exists.

### 2.2 The gap matrix

| Scenario | Has handoff today? | Triggered by? | Documented in skill? |
|---|---|---|---|
| Phase end → next phase (`phase-N-handoff.md`) | ✅ Mandatory | Phase completion/failure | ✅ Yes |
| Orchestrator mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ Improvised |
| **Phase executor mid-flight context rescue** | ❌ **Nothing** | — | ❌ |
| Brainstorming mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ |
| Plan-execution mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ |
| Free-conversation mid-flight context rescue | ⚠️ Ad-hoc | Manual user intervention | ❌ |

### 2.3 Four transition types this design covers

1. **Generic → fresh generic** — brainstorm, plan-exec, free conversation hits pressure
2. **Orchestrator → fresh orchestrator** — orchestrator hits pressure mid-run (mid-brainstorm, mid-self-healing, holding undocumented locks)
3. **Phase executor → orchestrator** — executor hits pressure mid-execute; informs orchestrator via a checkpoint artifact
4. **Phase executor → fresh phase executor** — orchestrator decides to continue the paused phase in a fresh executor session

---

## 3. Locked decisions (the design forks already settled)

| # | Decision | Choice |
|---|---|---|
| 1 | Detection model | Hybrid: user-primary via `/handoff`; Claude has discretion at 40% / 50% / 60% / 70% thresholds via hook-injected awareness reminders |
| 2 | Document shape | Universal core (7 sections) + auto-detected mode addenda |
| 3 | Storage & lifecycle | Mode-adaptive paths + frontmatter status flag (pending → consumed) + MEMORY.md pointer for resume discovery + docs never auto-deleted |
| 4 | Resume protocol | Auto path: SessionStart hook → MEMORY.md pointer → AskUserQuestion confirmation → freshness check → consume. Explicit escape hatch: `/handoff resume [<path>]` |
| 5 | Write timing & quality | Tiered FULL / LEAN / EMERGENCY by context % at invocation + natural-break gate (default: finish current task before writing) |
| 6 | Scope | Both: universal session-handoff machinery (rows 2/4/5/6 of gap matrix) AND phase-checkpoint primitive + phasing-skill extension (row 3 + continuation) |
| 7 | Rollout | Build skill + hook first; phasing extension second; cut over in-flight orchestrators one at a time at natural breaks per documented procedure |

---

## 4. Architecture

### 4.1 Three deliverables

```
┌────────────────────────────────────────────────────────────────────┐
│ DELIVERABLE 1 — Skill: handoff                                      │
│ ~/.claude/skills/handoff/ → promote → unifylabs-workflow/skills/    │
│                                                                     │
│   SKILL.md                  ← top-level guidance + tier rules        │
│   references/                                                        │
│     core-shape.md           ← universal 7 sections                   │
│     addendum-phasing-orch.md                                         │
│     addendum-phase-exec.md      (= phase-checkpoint shape)           │
│     addendum-brainstorm.md                                           │
│     addendum-plan-exec.md                                            │
│     addendum-work-issue.md                                           │
│     resume-protocol.md       ← freshness checks + ask-to-resume      │
│     mode-detection.md        ← file-system signal table              │
│   scripts/                                                           │
│     detect-mode.sh           ← shell helper, returns mode JSON       │
│     freshness-check.sh       ← runs git/file checks, JSON report     │
│     recreate-tasklist.sh     ← parses §5 block, emits payloads       │
│   commands/                                                          │
│     handoff.md               ← /handoff (subcommand parser)          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ DELIVERABLE 2 — Hook (extends existing unifylabs-workflow/hooks/)    │
│                                                                     │
│   context-awareness.sh                                              │
│     - Events: UserPromptSubmit (primary), SessionStart               │
│     - Reads token usage from Claude Code hook input JSON             │
│     - Computes context % from model-specific window size             │
│     - Injects system-reminder additionalContext when:                │
│         * pending handoff exists (SessionStart → ask-to-resume)     │
│         * context crosses 40/50/60/70 thresholds (UserPromptSubmit) │
│     - Auto-detects mode (calls detect-mode.sh) to tailor reminder    │
│                                                                     │
│   hooks.json (extends existing)                                      │
│     - registers context-awareness.sh on both events                 │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ DELIVERABLE 3 — Phasing skill extension                              │
│ Mirror edits to ~/.claude/skills/phasing/ AND                        │
│                  unifylabs-workflow/skills/phasing/                  │
│                                                                     │
│   SKILL.md — new subsections (existing structure unchanged):         │
│     §6.9   Mid-phase checkpoint flow (executor side)                 │
│     §7.5   Checkpoint detection in polling loop                      │
│     §X     New "⏸ CHECKPOINT" status block variant                   │
│     §X     New 4-option AskUserQuestion menu after checkpoint        │
│     State model: new "checkpoint" status + checkpoint_count field    │
│                                                                     │
│   references/                                                        │
│     checkpoint-shape.md       ← cross-refs handoff addendum-phase-exec│
│     phase-spec-shape.md       ← appends optional checkpoint policy   │
│                                                                     │
│   commands/                                                          │
│     phase-continue.md         ← /phase-continue <run-id> <N>         │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Runtime interaction (happy path, phasing-orchestrator mode)

```
1.  User in orchestrator session, context at ~45%.
2.  Hook (UserPromptSubmit) computes context %; injects awareness:
      "Context-awareness: ~45%. Mode: phasing-orchestrator. Apply discretion rules."
3.  Claude applies §6.4 discretion rules; decides next user message will be
    a "dispatch P4" request → surface at next natural pause.
4.  At pause: "Heads up — context ~45%. If P4 is heavy, /handoff first may be worth it."
5.  User: "yeah, /handoff"
6.  Skill loads; detect-mode.sh returns mode=phasing-orchestrator + run.json path
    + master-plan path. Tier selected: FULL (<50%).
7.  Natural-break gate: no in-progress tasks; pass through.
8.  Skill writes:
      .claude/phasing/<run>/session-handoff-<YYYY-MM-DD>.md
    with universal core + phasing-orchestrator addendum.
9.  Skill appends pointer to MEMORY.md.
10. Skill emits confirmation message; current session ends.

11. User opens fresh terminal: `cd <project>` and `claude`.
12. SessionStart hook fires. Sees pending handoff in MEMORY.md. Injects
    instruction telling Claude to ask the user about resume.
13. Fresh Claude reads MEMORY.md (auto-loaded), sees pointer, asks via
    AskUserQuestion: "Resume <topic>? (created 2h ago)" with 3 options.
14. User picks [Resume now].
15. Skill runs freshness-check.sh → JSON report → drift summary (if any)
    surfaced to user.
16. Clean state → skill reads handoff → recreate-tasklist.sh emits payloads
    → Claude executes them to rebuild TaskList.
17. Skill updates frontmatter: status: pending → consumed.
18. Claude reads §7 Resume instructions → picks up at in_progress task →
    respects §2 + §6 constraints. Normal session flow resumes.
19. Next SessionStart in this project: hook removes consumed pointer from
    MEMORY.md (idempotent cleanup).
```

### 4.3 Artifact naming canon

| Artifact | Name pattern | Owner | Lifecycle |
|---|---|---|---|
| Phase handoff (end-of-phase deliverable) | `phase-N-handoff.md` in phasing run-dir | Phasing skill §6.7 (unchanged) | Permanent |
| Session handoff (context rescue, non-phasing) | `<date>-<slug>.md` in `.claude/handoffs/` | New `/handoff` skill | Pending → consumed (doc kept on disk forever) |
| Session handoff (context rescue, phasing-orchestrator) | `session-handoff-<date>.md` in phasing run-dir | New `/handoff` skill | Same |
| Session handoff (context rescue, brainstorm) | `HANDOFF.md` in `.superpowers/brainstorm/<id>/` | New `/handoff` skill | Same |
| Phase checkpoint (mid-phase pause) | `phase-N-checkpoint.md` in phasing run-dir | New `/handoff` skill + phasing extension | Superseded by phase handoff on continuation; renamed `.bak` for audit |

---

## 5. Universal core: the 7-section shape

Every handoff doc follows this skeleton. Mode addenda append as §8+. Tier (FULL / LEAN / EMERGENCY) controls section depth, never section presence — §2, §3, §4, §5, §6, §7 are always present.

### 5.1 Frontmatter (machine-readable)

```yaml
---
name: <date>-<topic-slug>
description: <one-line summary; used by MEMORY.md pointer + /handoff list>
metadata:
  type: session-handoff | phase-checkpoint
  mode: phasing-orchestrator | phasing-executor | brainstorm | plan-exec | work-issue | generic
  tier: full | lean | emergency
  status: pending | consumed
  created: <ISO-8601>
  consumed_by_session: null | <session-id>
  origin_session: <session-id>
  origin_session_name: <e.g., orchestrator-website-redesign>
  project_root: <abs-path>
  context_pct_at_write: <integer>
  related_artifacts:
    - <path>
  run_id: <run-id>          # optional, only if phasing mode
  phase_n: <N>              # optional, only if phase-executor mode
---
```

### 5.2 Preamble (≤4 lines, always present)

```markdown
# Session Handoff — <topic> (<YYYY-MM-DD>)

> **Purpose:** Continue <topic> in a fresh Claude session with zero context rot or bleed. This document is **self-contained** — read it once and you have everything the prior session knew.
> **Mode:** <mode>  ·  **Tier:** <tier>  ·  **Context at write:** <pct>%
> **Project:** <project-root>  ·  **Origin session:** <origin-session-name>
```

### 5.3 The 7 sections

| § | Title | Purpose | FULL | LEAN | EMERGENCY |
|---|---|---|---|---|---|
| 1 | Trajectory (what happened) | Narrative arc of the session | 3–8 paragraphs prose | ~10-bullet timeline | Skipped |
| 2 | Locked decisions (durable contract) | Decisions that bind future sessions; non-negotiable | Full bullets, with rationale per bullet | Full bullets | Full bullets (never trimmed) |
| 3 | Open items not yet locked | Known unresolved questions | Bullets + brief context | Bullets only | Bullets only |
| 4 | World state (git + files + run-state) | Concrete reference state for freshness checks | All three sub-blocks fully populated | All three, prose trimmed | All three (never trimmed — freshness-check parses this) |
| 5 | TaskList snapshot | Recreate-via-helper block, fixed format | Full bullets w/ descriptions | Full bullets w/ descriptions | Full bullets w/ descriptions (never trimmed — load-bearing) |
| 6 | Do-not-re-litigate (anti-rot guard) | Explicit "don't reopen" framing of §2 + surveyed-and-rejected list | Both halves | Decisions only; surveyed-and-rejected list compressed | Decisions only |
| 7 | Resume instructions (numbered, in order) | Playbook for fresh session | Full 5-step list | Same 5 steps, terser | Same 5 steps, terser |

Detailed templates per section live in `references/core-shape.md` (to be implemented per plan).

### 5.4 Footer (single line, always present)

```markdown
---
**Status:** pending  ·  **Created:** <ISO>  ·  **Mode:** <mode>  ·  **Tier:** <tier>
*Generated by /handoff. Resume via: open fresh terminal in this project, confirm at the resume prompt.*
```

---

## 6. Mode addenda

Addenda append as §8+. Auto-detection signals determine which fire. If multiple match, addenda stack (§8 first-applicable, §9 next-applicable, etc.).

### 6.1 Detection signals (mode-detection.sh logic)

| Mode | Signal |
|---|---|
| `phasing-orchestrator` | `.claude/phasing/<run>/run.json` with `overall_status: in_progress` exists in cwd AND current session-name matches `orchestrator-<topic-slug>` |
| `phasing-executor` | Session-name matches `phase-<N>-<slug>` pattern AND `/phase-execute` was the entry point |
| `brainstorm` | `.superpowers/brainstorm/<id>/` exists with recent mtime OR a `docs/superpowers/specs/<recent>-design.md` is being drafted OR `superpowers:brainstorming` was active |
| `plan-exec` | `~/.claude/plans/<plan>.md` was loaded in this session OR `superpowers:executing-plans` is active |
| `work-issue` | Current branch matches `gh issue list` linkage OR `/work-issue` was invoked OR `.claude/work-issue/*` state present |
| `generic` | No other signal matches |

Detection runs at `/handoff` invocation time. Output is JSON with `mode` + paths to detected resources.

### 6.2 Addendum templates (summarized; full templates in implementation)

#### 6.2.1 §8.A — Phasing-orchestrator addendum

The load-bearing addendum. Captures conversational nuance that `/phase-resume` alone can't recover.

Sub-sections:
- **Run state pointers** — run_id, run.json path, master-plan path, mode (github/file), tracking issue #
- **Phase progress (lifted verbatim from run.json)** — all phases with status
- **Orchestrator state at handoff** — currently doing what (between phases / mid-brainstorm for P<N+1> / in self-healing / polling / other); background poll state; last status block rendered; pending AskUserQuestion if any
- **Mid-conversation locks not yet in any file** — THE LOAD-BEARING SECTION. Decisions made during conversation since the last phase wrapped, not yet baked into specs/master plan. Format: `<decision> — <why> · <where it should land: master plan §X | phase-N+1 spec | new ADR>`
- **Direction changes pending application** — user-said-X-about-phase-N+1 (not yet edited into spec); user-said-Y-about-run-end-verification (not yet edited into master plan)
- **Continuous-improvement queue** — candidates collected during run for run-end surface; lost in `/phase-resume`-only flow
- **Self-healing state (if §9.3 menu is in flight)** — failing step, investigation status, proposed fix surfaced yet?

Tier note: "Mid-conversation locks" and "Direction changes pending" are NEVER trimmed at any tier.

#### 6.2.2 §8.B — Phase-executor addendum (= phase-checkpoint shape)

Doubles as the `phase-N-checkpoint.md` shape. Same fields, different file path + filename.

Sub-sections:
- **Phase identity** — run_id, phase N, spec path, predecessor handoffs loaded
- **Plan-mode state** — plan approved (yes/no), plan file path, approved-at timestamp, self-verification pass count
- **Work-step progress** — mapped against spec's work list with `[✓ DONE] / [⏳ IN-FLIGHT] / [○ PENDING]` markers per step; "what was produced" notes on done steps
- **Verification-step progress** — mapped against spec's verification list with `[✓ PASS] / [○ NOT RUN]` markers
- **World-state delta during this executor session** — files created, files modified (line ranges), tests/commands run, external state changes
- **Reason for checkpoint** — enum: `context-pressure | blocker-out-of-scope | scope-creep-detected | other`, with prose detail
- **Recommended next action** — checkboxes against the 4 orchestrator menu options
- **Open questions for orchestrator** — things executor noticed but couldn't resolve in scope

Tier note: "Work-step progress" and "World-state delta" are NEVER trimmed.

#### 6.2.3 §8.C — Brainstorm addendum

Sub-sections:
- **Brainstorm phase** — clarifying-questions / approaches-proposed / design-presenting / spec-writing
- **Design doc target** — path, status, sections drafted vs. remaining
- **Options surveyed** — with verdict (locked / rejected / parking-lot) + one-line why
- **Visual artifacts** — Figma URLs, mockup paths, visual-companion browser session usage
- **Brainstorming-skill checklist state** — ✓ / ⏳ / ○ per item

Tier note: "Options surveyed" and "checklist state" never trim; visual artifacts compress to URLs only in LEAN/EMERGENCY.

#### 6.2.4 §8.D — Plan-execution addendum

Sub-sections:
- **Plan identity** — plan file path, loaded-at timestamp
- **Step progress** — mapped against plan with `[✓ DONE] / [⏳ IN-FLIGHT] / [○ PENDING]` markers
- **Review checkpoints hit** — after step N, reviewer + verdict
- **Subagent dispatches (if any)** — step → dispatched agent-type at ISO, returned verdict
- **Test/verification state** — tests run so far, build status

#### 6.2.5 §8.E — Work-issue addendum

Sub-sections:
- **Issue identity** — issue # + title + URL, branch + base
- **/work-issue sub-phase progress** — 8 checkboxes per the sub-phase sequence
- **TDD state (if in sub-phase 4)** — current cycle position (red/green/refactor), tests added, tests passing count
- **Acceptance test results (if in sub-phase 6)** — pass/fail summary

#### 6.2.6 §8.F — Generic (no addendum)

No addendum appended. Frontmatter has `mode: generic`. Core 7 sections sufficient.

### 6.3 Addendum stacking precedence

If multiple signals fire (e.g., phasing-orchestrator that's currently mid-brainstorming for a new phase), addenda stack:

```
§8 = phasing-orchestrator OR phasing-executor (highest priority; mutually exclusive)
§9 = brainstorm (if applicable)
§10 = plan-exec (if applicable; usually subsumed by phasing-executor when both fire)
§11 = work-issue (if applicable)
```

Skill respects this fixed precedence; doesn't try to be clever about overlapping signals.

---

## 7. Detection mechanics

### 7.1 Context % computation

Hook input JSON provides `total_input_tokens`, `total_output_tokens`, `transcript_path`. Hook computes:

```
context_pct = round((input_tokens + output_tokens) / model_context_window * 100)
```

Model context window is detected from session model ID:
- `claude-opus-4-7` (1M variant) → 1,000,000
- `claude-sonnet-4-6` → 200,000
- `claude-haiku-4-5-20251001` → 200,000
- Fallback for unknown models → 200,000 (conservative)

The 1M-window case materially changes math — 40% of 1M is 400K tokens, four times the absolute size of 40% of 200K. The skill surfaces the effective window in its tier-decision logic so the user sees both percent and absolute counts.

### 7.2 Threshold-driven hook injection

Hook fires on `UserPromptSubmit` (primary — timing is between turns). Falls back to `Stop` if `UserPromptSubmit` not available.

| Context % | Injected reminder text |
|---|---|
| <40% | Nothing injected. Hook silent. |
| 40–49% | `"Context-awareness: ~<N>%. Mode: <detected-mode>. Apply discretion rules from handoff skill — surface to user only if situation warrants per rules table."` |
| 50–59% | `"Context-awareness: ~<N>%. Mode: <detected-mode>. Quality risk moderate. Default to surfacing at next natural pause unless work is clearly wrapping up."` |
| 60–69% | `"Context-awareness: ~<N>%. Mode: <detected-mode>. Quality risk significant. Strongly recommend surfacing /handoff option at next natural pause. EMERGENCY tier will apply if invoked."` |
| ≥70% | `"Context-awareness: ~<N>%. Mode: <detected-mode>. Quality risk HIGH. Surface /handoff immediately unless user explicitly said 'just finish this'. EMERGENCY tier mandatory."` |

**Pending-handoff signal (on SessionStart):**

```
"Pending handoff detected: <path>
 Topic: <description>
 Created: <relative-time>
 ASK the user via AskUserQuestion whether this session resumes <topic>
 before doing other work. Apply freshness check BEFORE loading handoff
 content. Do not load handoff content until user confirms resume."
```

### 7.3 The hook is awareness, not instruction

Hook NEVER forces an `AskUserQuestion`. It hands Claude a fact + recommendation. The skill defines discretion rules; Claude is the executive.

### 7.4 Discretion rules (taught by SKILL.md)

| Signal | Action |
|---|---|
| Context 40–49%, mid-tool-loop, no large task ahead | Stay silent. Continue working. |
| Context 40–49%, mid-tool-loop, large task ahead | Surface at next natural pause as one-liner: *"Heads up — context ~<N>%. If the next ask is substantial, /handoff first may be worth it."* |
| Context 40–49%, wrapping up (≤2 small tasks left) | Stay silent. Finish. |
| Context 50–59%, mid-tool-loop | Surface at next natural pause: *"At ~<N>%. Quality risk moderate. Recommend /handoff before dispatching anything substantial."* |
| Context 50–59%, wrapping up | Surface as final remark: *"Wrapping up at ~<N>%. Next session — consider /handoff before continuing."* |
| Context 60–69%, any state | Surface immediately: *"At ~<N>% — quality risk significant. Strongly recommend /handoff now."* |
| Context ≥70%, any state | Surface immediately + recommend EMERGENCY tier. |
| User said "auto mode" / "just do it" | Suppress to ≤1 mention per session below 60%. Above 60%, override the suppression. |
| User just invoked /handoff | No mention. User is already handling it. |
| Multiple thresholds crossed in same session | No re-surfacing within 5 turns of last mention unless threshold escalates. |

### 7.5 Tier selection on /handoff invocation

| Tier | Context at invocation | Approximate write cost | Approximate output |
|---|---|---|---|
| FULL | <50% | 3–5% | 200–400 lines |
| LEAN | 50–64% | 1.5–2.5% | 100–150 lines |
| EMERGENCY | ≥65% | 0.5–1% | 40–70 lines |

Pre-write check: skill estimates output size and warns if it would push session past 75%. User can override tier via `/handoff lean` or `/handoff emergency`.

### 7.6 Natural-break gate

On `/handoff` invocation, skill checks for mid-task signals. If mid-task, asks:

```
"Currently mid-task: <one-line summary>. How to proceed?"
  1. Finish current task first, then /handoff (Recommended)
  2. Write handoff now, abandon current task (in-progress captured in §5)
  3. Cancel handoff
```

Default: option 1. Option 2 writes immediately with the current task's partial state captured in §5 TaskList as in_progress.

---

## 8. Lifecycle

### 8.1 Write phase

1. mode-detection.sh returns mode + paths
2. Skill picks tier based on context % (or user override)
3. Natural-break gate fires if mid-task
4. Skill picks write path per mode (see 4.3)
5. Skill derives slug; asks user to confirm if ambiguous
6. Single Write call: frontmatter + preamble + 7 core sections + matching addenda + footer
7. MEMORY.md pointer append (at top of index)
8. Confirmation message printed (terse, single block)

### 8.2 MEMORY.md pointer format

```
- [Pending handoff — <topic>](<relative-path>) — created <ISO>, mode <mode>, tier <tier>. RESUME FIRST in fresh session if continuing <topic>.
```

Multiple pointers stack newest-first if multiple pending exist.

### 8.3 Resume phase

1. SessionStart hook scans MEMORY.md for `Pending handoff` lines
2. If any found, injects guidance into Claude's initial context
3. Claude asks user via AskUserQuestion (Resume now / Not this session / Mark consumed)
4. On Resume: freshness-check.sh runs against handoff §4 World state
5. Drift report surfaced if any; user decides how to proceed
6. recreate-tasklist.sh emits TaskCreate payloads; Claude executes them
7. Frontmatter status: pending → consumed (atomic write)
8. Claude reads §7 Resume instructions and continues

### 8.4 freshness-check.sh contract

Input: path to handoff doc
Output: JSON to stdout

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

- `clean` → silent proceed
- `drift_detected` → Claude surfaces drift, user picks continue/investigate
- `fatal` → refuse auto-resume; surface what's missing; ask user how to proceed

### 8.5 detect-mode.sh contract

Input: cwd, current session metadata
Output: JSON to stdout

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

### 8.6 recreate-tasklist.sh contract

Input: path to handoff doc (parses §5 block)
Output: shell-quoted TaskCreate / TaskUpdate command sequence to stdout

```bash
# example output
TaskCreate "subject1" "description1"
TaskCreate "subject2" "description2"
TaskCreate "subject3" "description3"
TaskUpdate 3 in_progress  # the in-progress task gets bumped
```

Claude reads the output and issues the tool calls.

### 8.7 Consume cleanup

Idempotent SessionStart-time scan: hook checks each MEMORY.md pointer's linked doc, removes pointer lines for docs with `status: consumed`. Silent (no chat noise).

### 8.8 Edge cases

| Edge case | Handling |
|---|---|
| User opens fresh session for unrelated work; pending handoff exists | AskUserQuestion fires with "Not this session" option; pointer stays |
| MEMORY.md doesn't exist yet | Skill creates with index header on first handoff write |
| Multiple pending handoffs (≥2) | AskUserQuestion lists each as option (cap 4); ≥3 pending → use `/handoff list` |
| Pending handoff's project_root != current cwd | Hook detects; reminder says "Pending handoff is for project <X>; current is <Y>." Pointer NOT loaded into Claude's context unless user explicitly picks it |
| User accidentally picks "Mark consumed" | `/handoff revive <path>` flips status back to pending, re-adds MEMORY.md pointer |
| Handoff file deleted manually | Hook detects orphan MEMORY.md pointer on next SessionStart; auto-removes pointer + warns user |
| Freshness check `fatal` | Claude refuses auto-resume; surfaces what's missing; offers investigate / open-empty-session / mark-handoff-consumed-and-start-fresh |
| Stale handoff (>30 days, still pending) | SessionStart hook tags option label with "STALE"; user typically picks Mark consumed |
| User runs /handoff twice in same session | Second supersedes first; first's status set to superseded; second becomes active pointer. Forensic doc 1 still on disk |

### 8.9 Archive (v2 — not in v1)

After 30 days, consumed handoffs in `.claude/handoffs/` eligible for archival to `.claude/handoffs/archive/<YYYY>/`. `/handoff list --archived` for forensics. v1 ships without; manual `mv` works.

---

## 9. Phase-checkpoint extension to phasing skill

### 9.1 Executor decision: checkpoint vs handoff

A phase executor writes ONE of two artifacts at exit:

| Artifact | When | Path |
|---|---|---|
| `phase-N-handoff.md` (canonical, phasing §6.7) | Work complete (all spec work-steps done, all verification PASS or FAIL) | `.claude/phasing/<run>/phase-N-handoff.md` |
| `phase-N-checkpoint.md` (NEW, via /handoff in phasing-executor mode) | Context pressure, work partial | `.claude/phasing/<run>/phase-N-checkpoint.md` |

When `/handoff` invoked in phasing-executor mode, skill asks via AskUserQuestion which case applies; on "pausing mid-phase" proceeds with phase-executor addendum write; on "finishing normally" prints canonical handoff template path and exits without writing.

### 9.2 Orchestrator-side: extended polling

§7.3 polling loop becomes:

```
until [ -f <run-dir>/phase-N-handoff.md ] OR [ -f <run-dir>/phase-N-checkpoint.md ]:
  sleep 5
  emit mid-phase beat every ~5 min
```

If both materialize same tick, handoff wins; checkpoint moves to `.bak`.

### 9.3 New "⏸ CHECKPOINT" status block variant

Renders inside code fence as first chat output at the gate (same rule as existing variants). Lifts verbatim from checkpoint file:
- 📦 Work done so far (from §Work-step progress, DONE entries)
- ⏳ Work still pending (pending entries)
- 📋 Verification status (PASS / NOT RUN per step)
- 🔧 World-state delta (files modified/created, tests run)
- 💬 Reason (verbatim from §Reason for checkpoint)
- ❔ Open questions for you (verbatim)
- ▶ Phase status (full queue, paused phase shown 🟡 + `⏸ paused at checkpoint` suffix)

Badge is `⏸ CHECKPOINT` (sixth variant alongside ✅/🚀/⏳/🏁/🛑).

### 9.4 New 4-option AskUserQuestion menu

```
"Phase <N> paused at checkpoint. Reason: <reason-summary>. How to proceed?"

1. Re-spawn from checkpoint  (Recommended if reason=context-pressure)
2. Split phase  (Recommended if reason=scope-creep)
3. View checkpoint detail  (Recommended if reason=other / no reason)
4. Abort phase  (Recommended if reason=blocker-out-of-scope)
```

Recommended tag attaches dynamically based on `Reason` field value.

### 9.5 /phase-continue <run-id> <N>

Continuation executor lifecycle:

1. Resolve run-id (auto-detect rule from phasing skill)
2. Validate `phases[N].status == "checkpoint"`
3. Load: master plan, phase N spec, all predecessor handoffs, **phase-N-checkpoint.md**
4. Skill helper recreates TaskList from checkpoint; Claude reads §World-state delta + §Verification-step progress
5. EnterPlanMode (mandatory per phasing §6.3) — plan must NOT redo completed work
6. Self-verify plan (per phasing §6.3a)
7. ExitPlanMode → user approval
8. Execute pending work-steps
9. Run pending verification steps; optionally re-run subset of previously-PASSed for sanity
10. Write canonical `phase-N-handoff.md` per phasing §6.7; verification section lists ALL steps including carried-from-checkpoint annotations
11. Rename `phase-N-checkpoint.md` → `phase-N-checkpoint.superseded-<ts>.md.bak`
12. Exit (orchestrator's poll picks up the new handoff)

### 9.6 run.json schema additions

```diff
  phases[N] {
    n: <int>,
    name: <string>,
-   status: "pending" | "in_progress" | "complete" | "failed",
+   status: "pending" | "in_progress" | "complete" | "failed" | "checkpoint",
    ...
+   checkpoint_count: <int>  // optional, default 0; incremented per checkpoint write
  }
```

Status transitions:

```
pending → in_progress (on spawn)
in_progress → complete (on phase-N-handoff.md, status:complete)
in_progress → failed (on phase-N-handoff.md, status:failed)
in_progress → checkpoint (on phase-N-checkpoint.md write)         NEW
checkpoint → in_progress (on /phase-continue spawn)               NEW
checkpoint → failed (on Abort phase menu pick)                    NEW
checkpoint → complete (on Split phase menu pick — partial)        NEW
```

### 9.7 checkpoint_count thresholds

- `=1` → normal menu rendering; default Re-spawn
- `=2` → WARNING surfaced: "Phase has hit checkpoint twice — may be over-scoped. Recommend Split."
- `≥3` → Re-spawn REMOVED from menu; only Split / Abort allowed. Three checkpoints = scope genuinely wrong.

### 9.8 Optional phase-spec section

`references/phase-spec-shape.md` gains optional template:

```markdown
## Checkpoint policy (optional)

Triggers for writing a checkpoint mid-execute:
- Context pressure: <yes/no, default yes>
- Scope creep: <yes/no, default yes>
- Blocker out of scope: <yes/no, default yes>

Natural break points (good times to checkpoint if pressure detected):
- After Step <N>
- After verification batch <N>

Re-spawn vs split bias: <prefer-respawn | prefer-split | no-preference>
Maximum checkpoints before forced split: <integer, default 2>
```

Most phases won't use this. Defaults are sufficient.

### 9.9 What this extension does NOT do

- Does NOT touch `phase-N-handoff.md` shape, location, or lifecycle (still phasing §6.7)
- Does NOT modify the 5 existing status card variants (run-start, post-phase, resume, run-end, aborted) — ⏸ CHECKPOINT is a 6th, additive
- Does NOT modify existing slash commands `/phase`, `/phase-execute`, `/phase-resume`, `/phase-next`, `/phase-retry`, `/phase-abort`, `/phase-archive`, `/phase-list`, `/phase-status`
- Does NOT introduce subagents (continuation executor is a fresh first-class Claude session)

---

## 10. Rollout & cutover

### 10.1 Backward compatibility

| Concern | Requirement |
|---|---|
| Old run.json (no checkpoint_count field) | Reader treats missing as 0 |
| Old phase artifacts (no checkpoint file ever existed) | Polling extension is additive — `OR [ -f checkpoint.md ]` never triggers if absent |
| Old MEMORY.md (no pending-handoff pointers) | Hook scans for pattern; finds none; silent |
| Hook fires in old orchestrator that doesn't know about it | Hook injects awareness; Claude falls back to general judgment; not harmful, not full feature until restart |
| User invokes /handoff in old orchestrator session | Skills load fresh from disk on invocation; /handoff works in old sessions immediately |

Net effect: build + deploy is SAFE for all in-flight runs. /handoff works immediately in any session. Phase-checkpoint flow requires restarted orchestrator to fully react.

### 10.2 Cutover procedure (per in-flight orchestrator)

```
1. Confirm no executor mid-phase (no phases[N].status == "in_progress")
2. Run /handoff in orchestrator session — captures mid-conversation locks etc.
3. Kill orchestrator terminal
4. Open fresh terminal: cd <project-root> && claude
5. SessionStart hook detects MEMORY.md pointer; AskUserQuestion fires
6. Pick [Resume now]; freshness check passes; TaskList recreated; handoff consumed
7. New orchestrator has new phasing SKILL.md + new /handoff + new hook
8. Run /phase-resume <run-id> to re-render resume card + re-establish polling
9. Continue run with full new functionality
```

### 10.3 In-flight executor handling

1. Let any currently-executing phase finish normally under old skill (old flow still works)
2. Do NOT spawn new phases under the old orchestrator; cut it over first
3. Cut-over orchestrator dispatches next phase with new functionality

### 10.4 Deployment order

```
1. Build /handoff skill at ~/.claude/skills/handoff/
2. Build hook at unifylabs-workflow/hooks/context-awareness.sh
3. Test universal flow end-to-end in non-phasing context
4. Extend phasing skill with checkpoint flow (mirror to both copies)
5. Promote to unifylabs-workflow via /promote-to-marketplace
6. Cut over each in-flight orchestrator (10.2) one at a time
7. Announce feature live
```

### 10.5 Safety net

If cutover fails: `git checkout HEAD~1 -- ~/.claude/skills/phasing/SKILL.md` restores prior behavior; run continues under old skill. Session-handoff written in step 2 above remains on disk; nothing destructive.

---

## 11. Out of scope (deferred)

- **Statusline visualization of context threshold** (color-code by threshold tier in the unifylabs-workflow statusline). Nice-to-have; out of v1.
- **Auto-archive of consumed handoffs** after 30 days. v1 ships without; manual `mv` to `.claude/handoffs/archive/<year>/` works.
- **Pre-staging / incremental handoff accumulation** (skill tracks decisions/locks/tasks throughout session, accumulating draft handoff). One-shot write at invocation is the simpler v1.
- **Subagent-dispatched handoff writing** (off-context). Dead end because subagents have separate context windows; would need the whole transcript fed in.
- **Cross-repo handoffs** (handoff for project A read in project B). v1 keeps `project_root` enforcement; cross-repo deferred.
- **Telemetry on handoff usage / quality** (analytics on how often invoked, at what %, write costs realized). Future improvement.
- **Auto-suggested slug from conversation topic** beyond the simple heuristic. Smarter slug derivation deferred.

---

## 12. Open items

- **Slash command surface** — choice between `/handoff` + subcommands (Recommended; mirrors `/phase` family) vs. flat commands (`/handoff`, `/handoff-resume`). To be confirmed during implementation plan.
- **Skill name canonicalization** — `handoff` (recommended) vs. `session-handoff` vs. `context-handoff`. Affects file paths + plugin manifest. Resolve before implementation.
- **Hook fallback to `Stop` event** — assumed `UserPromptSubmit` exists in Claude Code; verify before plan; if not, `Stop` is the fallback with slightly different timing semantics.
- **Test harness for skill** — how to integration-test the skill end-to-end without manually running through it each iteration. Likely an `evals/` dir mirroring phasing skill's evals.
- **Documentation of new menu options for founder** — single-page reference card for the 4 checkpoint options + their consequences. Builds as part of phasing-skill extension docs.

---

## 12-RESOLVED

The 6 open items from §12 were resolved during P0 of run `2026-05-24-handoff-skill-build` (orchestrator session `orchestrator-handoff-skill-build`, phase session `phase-0-foundations-open-item-resolution`).

| # | Item | Resolution |
|---|---|---|
| 1 | Slash command surface | **Flat** — `/handoff`, `/handoff-resume`, `/handoff-list`, `/handoff-done`, `/handoff-revive`. Mirrors existing `/phase-execute`, `/phase-resume`. |
| 2 | Skill name canonicalization | **`handoff`** (single word, lowercase). Matches `phasing` / `ship` convention. |
| 3 | Skill location | **Marketplace-direct** at `plugins/unifylabs-workflow/skills/handoff/`, with a P9 symlink to `~/.claude/skills/handoff/`. Skip `/promote-to-marketplace`. *(Locked collaterally in the master plan's "Decisions baked in" rather than originally listed in §12.)* |
| 4 | Hook fallback to `Stop` event | **Not needed.** `UserPromptSubmit` empirically confirmed in P0 — see observations below. |
| 5 | Test harness | **3-tier**: `evals/handoff-evals.json` (model-judged scenarios mirroring `phasing/evals/orchestrator-evals.json`), bash fixture tests in `scripts/test/` and `hooks/test/` (TDD-developed in P2 + P3), manual E2E checklists in P4 + P8 + P10. |
| 6 | Founder-reference card for checkpoint menu | `references/founder-card-checkpoint.md`. Stub in P1; full content in P6. |

**P0 environmental observations (empirical — captured via /tmp probe registered at user-scope `~/.claude/settings.json`, then removed; net-zero diff).**

*`SessionStart` event* — fires reliably; input JSON keys observed (Claude Code v2.1.150, model `claude-opus-4-7[1m]`, 2026-05-24):
- `hook_event_name` = `"SessionStart"`
- `session_id` (UUID)
- `transcript_path` (absolute path to a JSONL file)
- `cwd` (absolute path)
- `model` (e.g. `"claude-opus-4-7[1m]"` — note the `[1m]` window-variant suffix appears here)
- `source` (observed value: `"startup"`)

*`UserPromptSubmit` event* — fires reliably between turns; input JSON keys observed:
- `hook_event_name` = `"UserPromptSubmit"`
- `session_id` (UUID — same as the session's `SessionStart`)
- `transcript_path` (same JSONL file as SessionStart for the same session)
- `cwd`
- `permission_mode` (observed value: `"auto"`)
- `prompt` (the literal user-submitted prompt text)
- **`model` is NOT present on this event** — implication for P3 below.

*Spec §7.1 expectation vs. reality.* Spec §7.1 said hook input would carry `total_input_tokens` + `total_output_tokens` for direct context-% computation. **Neither field is present on either event.** The data is available, but in the JSONL transcript at `transcript_path`, not on the hook input itself.

*`transcript_path` JSONL is the real source of token + model state.* The file is a one-record-per-line JSON stream. Each `assistant` record carries a `.message.usage` block with the fields P3 needs:
- `input_tokens`, `output_tokens`
- `cache_creation_input_tokens`, `cache_read_input_tokens`
- `ephemeral_5m_input_tokens`, `ephemeral_1h_input_tokens`
Each `assistant` record also carries `.message.model` (observed: `"claude-opus-4-7"` — **without** the `[1m]` suffix; P3 must normalize the two forms when window-mapping).

*Implications for P3 (the `context-awareness.sh` hook):*
1. **Effective context size** is best computed as `input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens` from the **last `assistant` record** of `transcript_path` — not from the hook input. Spec §7.1's formula is the right shape but its inputs come from a different place than §7.1 assumed.
2. **Model detection on `UserPromptSubmit`** must read either (a) the cached model captured on `SessionStart` (e.g. a `/tmp/<session_id>.model` side-file the hook writes on `SessionStart`), or (b) `.message.model` from the most recent `assistant` record in `transcript_path`. Option (b) is simpler — no side-state — and matches the canonical model ID used elsewhere.
3. **Window-variant normalization:** `SessionStart` reports `claude-opus-4-7[1m]`; transcript reports `claude-opus-4-7`. Per spec §7.1 both map to the 1M-token window. P3's model→window table must accept both forms.
4. **No `Stop`-event fallback needed.** `UserPromptSubmit` works — Resolution #4 stands.

*Branch context.* The spec lived as an untracked file at run start; this commit lands it on `docs/onboarding-intro` (the branch active at P0 dispatch time). Founder gate confirmed acceptance of branch placement at signoff. `~/Projects/unify-kit/.worktrees/` remains untracked and outside this run's scope.

---

## 13. Self-verification

**Pass count:** 1 pass (this draft is the first complete consolidation; brainstorm forks were each individually validated by the founder during discussion).

**Pass 1 review checklist:**
- ✓ Placeholders / TBDs: none present. Every section has concrete content.
- ✓ Internal consistency: artifact naming canon (§4.3) matches lifecycle sections (§8) and phase-checkpoint extension (§9). Same artifact names throughout. Run.json schema additions (§9.6) consistent with state transitions and orchestrator polling extension (§9.2).
- ✓ Scope: focused on three coordinated deliverables — universal handoff skill, hook, phasing extension. Does not bleed into related-but-out-of-scope work (statusline, archive automation, telemetry — explicitly deferred in §11).
- ✓ Ambiguity: tier behavior at boundary cases is explicit per section (§5.3 table, §7.5 table). Checkpoint flow has explicit transitions (§9.6) and edge cases (§9.7, §9.9). Cutover has explicit procedure (§10.2).
- ✓ Mode addenda templates summarized at design level (§6.2); detailed templates deferred to implementation per writing-plans skill.

**Final state: clean.**

---

## End of design
