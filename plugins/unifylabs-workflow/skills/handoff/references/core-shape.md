# Core shape — the universal 7-section handoff body

**Read when**: actually writing a handoff document, of any tier, in any mode. This reference carries the frontmatter schema, the preamble, the 7-section body templates with per-tier trim rules, and the footer. Mode addenda are layered on top per `references/addendum-*.md` and the stacking precedence in `SKILL.md`.

The 7-section core is **fixed**. Tier (FULL / LEAN / EMERGENCY) controls section *depth*, never section *presence*. §2 (Locked decisions), §4 (World state), §5 (TaskList snapshot), and the decisions half of §6 (Do-not-re-litigate) are **NEVER trimmed at any tier** — they are load-bearing for both freshness checks and successor-session correctness.

---

## 1. Frontmatter (machine-readable)

Every handoff begins with YAML frontmatter delimited by `---` lines. This block is parsed by `freshness-check.sh`, the MEMORY.md pointer-injector, and the SessionStart resume hook — keep keys exactly as named.

```yaml
---
name: <date>-<topic-slug>
description: <one-line summary; used by MEMORY.md pointer + /handoff-list>
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

Notes:

- `metadata.type` is `session-handoff` for everything except a `phase-N-checkpoint.md`, which uses `phase-checkpoint`.
- `metadata.status` flips from `pending` → `consumed` on successful resume. **Never delete the file** — the consume is a metadata edit, not a removal. Future-you may want to forensically inspect a months-old session.
- `metadata.project_root` enforces the no-cross-repo rule (spec §11): a handoff for project A will not auto-load in project B.
- `metadata.context_pct_at_write` is the integer percent at write time. The resume hook uses it for staleness display ("written at 62% context, 17 days ago").

---

## 2. Preamble (≤4 lines, always present)

Single block, identical shape every time. The fresh reader sees this first and knows where they are in 5 seconds.

```markdown
# Session Handoff — <topic> (<YYYY-MM-DD>)

> **Purpose:** Continue <topic> in a fresh Claude session with zero context rot or bleed. This document is **self-contained** — read it once and you have everything the prior session knew.
> **Mode:** <mode>  ·  **Tier:** <tier>  ·  **Context at write:** <pct>%
> **Project:** <project-root>  ·  **Origin session:** <origin-session-name>
```

---

## 3. The 7 sections (with per-tier trim rules)

The summary table:

| § | Title | Purpose | FULL | LEAN | EMERGENCY |
|---|---|---|---|---|---|
| 1 | Trajectory (what happened) | Narrative arc of the session | 3–8 paragraphs prose | ~10-bullet timeline | Skipped |
| 2 | Locked decisions (durable contract) | Decisions that bind future sessions; non-negotiable | Full bullets, with rationale per bullet | Full bullets | Full bullets (**NEVER trimmed**) |
| 3 | Open items not yet locked | Known unresolved questions | Bullets + brief context | Bullets only | Bullets only |
| 4 | World state (git + files + run-state) | Concrete reference state for freshness checks | All three sub-blocks fully populated | All three, prose trimmed | All three (**NEVER trimmed** — freshness-check parses this) |
| 5 | TaskList snapshot | Recreate-via-helper block, fixed format | Full bullets w/ descriptions | Full bullets w/ descriptions | Full bullets w/ descriptions (**NEVER trimmed** — load-bearing) |
| 6 | Do-not-re-litigate (anti-rot guard) | Explicit "don't reopen" framing of §2 + surveyed-and-rejected list | Both halves | Decisions only; surveyed-and-rejected list compressed | Decisions only (**Decisions half NEVER trimmed**) |
| 7 | Resume instructions (numbered, in order) | Playbook for fresh session | Full 5-step list | Same 5 steps, terser | Same 5 steps, terser |

Per-section templates and field discipline follow.

### §1 Trajectory (what happened)

**Purpose:** the narrative arc — what the session set out to do, what shifted, where it landed, what's still pending. The fresh reader uses this to internalize where the prior session was *going*, not just where it ended.

**FULL template (3–8 paragraphs, prose):**

```markdown
## §1 Trajectory

Set the scene in one paragraph: what was the user's original intent at session start, and what was already known/decided coming in.

In subsequent paragraphs, walk through the session's major beats. What was investigated, what was decided, what was attempted, what worked, what didn't. Each paragraph should land at a checkpoint — a decision made, an option discarded, a deliverable produced, a blocker hit. Aim for 3–8 paragraphs total.

Close with one paragraph on the current state: what's done, what's pending, what's blocked, what the session was *about to do* when context pressure forced the handoff.
```

**LEAN template (~10-bullet timeline):**

```markdown
## §1 Trajectory

- <ISO time or "early">: <one-sentence beat>
- <ISO time or "mid">: <one-sentence beat>
- ...
- <ISO time or "late">: <current state — what the session was about to do>
```

**EMERGENCY:** **Skipped.** Frontmatter `description:` + §2 + §5 carry enough trajectory hints. The fresh reader gets the arc from §2 (decisions in order) and §5 (current task position).

### §2 Locked decisions (durable contract)

**Purpose:** the binding contract. Every entry here is a decision the prior session committed to that future sessions MUST respect. Re-opening these is wasted work — that's what §6 enforces.

**NEVER trimmed at any tier.** Lift each decision with full rationale even in EMERGENCY — the cost of forgetting a lock is far higher than the cost of carrying it.

**Field discipline (mirrors the wealth-portal session-handoff masterclass shape):**

```markdown
## §2 Locked decisions

- **<decision>** — <why this and not the alternative> · <where it should land: code path | spec | ADR | run.json | other>
- **<decision>** — <why> · <where it should land>
- **<decision>** — <why> · <where it should land>
```

Each entry is one bullet. Three parts:

1. **The decision** in bold, prefixed by the noun being decided.
2. **The why** — the load-bearing rationale. Future sessions tempted to re-open the decision must see *why* this choice was made.
3. **Where it should land** — the file, spec section, ADR, or other artifact this decision should be reflected in. If "where" is "already in <path>", say so. If "where" is "not yet baked in anywhere", that's a load-bearing observation (it means the decision lives only in this handoff and must be applied before being lost).

LEAN: same shape, can drop the "where it should land" suffix if every entry would otherwise duplicate.

EMERGENCY: same shape; no compression. This section is the contract.

### §3 Open items not yet locked

**Purpose:** known unresolved questions, ambiguities surfaced but not yet decided, choices pending user input. Distinct from §2: these are *not* binding — they're the open agenda.

**FULL template (bullets + brief context):**

```markdown
## §3 Open items

- **<open question>** — <one-paragraph context: what's been considered, what's blocking resolution, who has input pending>
- **<ambiguity>** — <context>
```

**LEAN / EMERGENCY (bullets only):**

```markdown
## §3 Open items

- <open question>
- <ambiguity>
- <pending user input on X>
```

Distinguish ruthlessly from §2: if a decision was made, it goes in §2. Hedge-words like "leaning toward X but not locked" go in §3.

### §4 World state (git + files + run-state)

**Purpose:** concrete reference state. `freshness-check.sh` parses this section to decide whether the resume is safe — drift here is the difference between a clean continuation and a hallucination cascade.

**NEVER trimmed at any tier.** Prose may trim in LEAN/EMERGENCY; sub-blocks may not. All three sub-blocks always present, fully populated, even in EMERGENCY.

**FULL / LEAN / EMERGENCY template (identical structure; prose density only differs):**

```markdown
## §4 World state

### 4.1 Git state

- **Branch:** <branch-name>
- **HEAD SHA:** <40-char SHA>
- **Working tree:** clean | dirty (`<file>` modified, `<file>` untracked, ...)
- **Upstream:** <origin/branch> at <SHA>; <N> ahead, <M> behind
- **Last commit subject:** <subject>

### 4.2 Files load-bearing for resume

- `<abs-path>` — <one-line: what this file is, why the resume depends on its current state>
- `<abs-path>` — <one-line>
- `<abs-path>` — <one-line>

(Include any file the next session must read first to continue safely. Include any file whose content the prior session was actively editing or relied upon for the in-progress task.)

### 4.3 Run state (phasing modes only — omit otherwise)

- **run_id:** <id>
- **run.json path:** <abs-path>
- **Phase array snapshot:**

  | N | Name | Status | Notes |
  |---|---|---|---|
  | 0 | <name> | complete | <handoff URL or "—"> |
  | 1 | <name> | in_progress | <handoff URL or "—"> |
  | 2 | <name> | pending | — |

(If the prior session was not a phasing mode, this sub-block is omitted entirely. The presence/absence of the sub-block is itself a signal — `freshness-check.sh` skips run.json validation when the sub-block is absent.)
```

Field discipline:

- **Git state** drives the `git_check` sub-block of `freshness-check.sh` output. Expected branch, HEAD SHA, and working-tree cleanliness are compared against actual.
- **Files load-bearing** drives the `load_bearing_files` sub-block. Each path is checked for `exists | missing | moved`.
- **Run state** drives the `run_json_check` sub-block. The phase array is compared against the current `run.json`.

EMERGENCY note: this section can feel padded relative to other emergency-tier sections. It is not. Cutting any sub-block leaves freshness-check without ground truth → silent drift → hallucinated resume. Carry it in full.

### §5 TaskList snapshot

**Purpose:** the exact TaskList state at write time, in a format `recreate-tasklist.sh` can parse into `TaskCreate` / `TaskUpdate` shell-quoted commands. The fresh session re-issues those commands and recovers the exact task spinner state.

**NEVER trimmed at any tier.** Load-bearing — the entire resume protocol's "what was I working on?" answer lives here.

**Fixed format (parser-friendly):**

```markdown
## §5 TaskList snapshot

- [completed] <subject> — <description>
- [completed] <subject> — <description>
- [in_progress] <subject> — <description>
- [pending] <subject> — <description>
- [pending] <subject> — <description>
```

Parser rules `recreate-tasklist.sh` enforces:

- One bullet per task. Status marker in square brackets at the start. Subject before the em-dash. Description after.
- Status enum: `[pending]` / `[in_progress]` / `[completed]`. Any other value → parse error.
- At most ONE `[in_progress]` task (matches Claude Code's TaskList semantics).
- Order matters: completed tasks come first, then in_progress, then pending. Parser emits `TaskCreate` in order, then `TaskUpdate` to bump statuses.

If the prior session had no TaskList active (e.g., a brainstorm session that never started TaskCreate), this section can be:

```markdown
## §5 TaskList snapshot

_No TaskList was active in the prior session._
```

But never omit the section header — its presence is a freshness-check signal.

### §6 Do-not-re-litigate (anti-rot guard)

**Purpose:** explicit "don't re-open this" framing of §2 + a surveyed-and-rejected list. Defends against the fresh session looking at §2 and thinking "but what if we re-considered X?" — wasted cycles on settled questions.

**Decisions half NEVER trimmed.** Surveyed-and-rejected list compresses in LEAN, drops in EMERGENCY.

**FULL template:**

```markdown
## §6 Do-not-re-litigate

### 6.1 Decisions already locked — do not re-open

- **<decision from §2>** — locked at <when in session>. Do not re-open without explicit user request. (Why locked: <one-line>.)
- **<decision from §2>** — locked. Do not re-open.

### 6.2 Surveyed and rejected

- **<approach A>** — considered, rejected because <why>. Do not re-propose unless <new-evidence-trigger>.
- **<approach B>** — considered, rejected because <why>. Do not re-propose.
- **<library / tool X>** — evaluated, rejected because <why>.
```

**LEAN template:**

```markdown
## §6 Do-not-re-litigate

### 6.1 Decisions already locked — do not re-open

- <decision from §2> — locked.
- <decision from §2> — locked.

### 6.2 Surveyed and rejected (compressed)

- <approach A> · <approach B> · <approach C> — all rejected; see prior session if you need rationale.
```

**EMERGENCY template:**

```markdown
## §6 Do-not-re-litigate

### 6.1 Decisions already locked — do not re-open

- <decision from §2> — locked.
- <decision from §2> — locked.
```

(Section 6.2 fully dropped in EMERGENCY. Decisions half remains.)

### §7 Resume instructions (numbered, in order)

**Purpose:** the playbook. Five numbered steps the fresh session executes in order to resume safely. Same 5 steps at every tier; only prose density differs.

**Template (FULL/LEAN/EMERGENCY — same 5 steps):**

```markdown
## §7 Resume instructions

1. **Read this handoff in full** before any other action. The §4 World state and §6 Do-not-re-litigate are load-bearing — skipping them is the single biggest source of resume failure.
2. **Run `freshness-check.sh <this-handoff-path>`**. If `overall: clean`, proceed silently. If `drift_detected`, surface the drift summary to the user and pause for direction. If `fatal`, refuse auto-resume; surface what's missing and offer Investigate / Open-empty-session / Mark-consumed.
3. **Run `recreate-tasklist.sh <this-handoff-path>`** and execute the emitted `TaskCreate` / `TaskUpdate` calls in order. The spinner state will match the prior session.
4. **Read the files listed in §4.2** (load-bearing for resume) so their current content is in your context before doing any new work.
5. **Pick up the [in_progress] task from §5** and continue. Respect every §2 lock and every §6 "do not re-open" entry. If a §3 open item is the natural next thing to resolve, surface it to the user.
```

In FULL, each step can carry an extra line of prose context. In LEAN and EMERGENCY, the bullets stand alone.

---

## 4. Footer (single line, always present)

```markdown
---
**Status:** pending  ·  **Created:** <ISO>  ·  **Mode:** <mode>  ·  **Tier:** <tier>
*Generated by /handoff. Resume via: open fresh terminal in this project, confirm at the resume prompt.*
```

The footer doubles as a visual end-marker so a parser knows it has read the whole document.

---

## 5. Putting it all together

Every handoff is composed in this order:

1. Frontmatter (`---` block)
2. Preamble (4-line intro)
3. §1 Trajectory (per tier rules)
4. §2 Locked decisions (NEVER trimmed)
5. §3 Open items
6. §4 World state (NEVER trimmed)
7. §5 TaskList snapshot (NEVER trimmed)
8. §6 Do-not-re-litigate (decisions half NEVER trimmed)
9. §7 Resume instructions
10. **Mode addenda** appended as §8+ per `SKILL.md` stacking precedence
11. Footer

The mode addenda are the *only* thing that varies across handoffs. Everything from §1–§7 is universal. The mode addenda live in:

- `references/addendum-phasing-orch.md` → §8.A
- `references/addendum-phase-exec.md` → §8.B (stub; full content in `phasing/references/checkpoint-shape.md`)
- `references/addendum-brainstorm.md` → §8.C
- `references/addendum-plan-exec.md` → §8.D
- `references/addendum-work-issue.md` → §8.E
- §8.F (generic mode) — no addendum appended

Stacking precedence is owned by `SKILL.md`, not this file.
