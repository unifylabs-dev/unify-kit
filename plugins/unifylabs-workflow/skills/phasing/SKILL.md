---
name: phasing
description: >
  Orchestrate multi-phase work across fresh Claude sessions with mandatory plan-mode gating
  and self-verification. Use this skill whenever a user has a plan or task that touches multiple
  subsystems, has natural break points, would benefit from re-grounding mid-execution, or when
  the user wants to stay in the loop on every decision instead of dispatching subagents. Trigger
  this when a presented plan looks too big for one execution, when the user invokes /phase, or
  when a user mentions phasing, breaking work into chunks, multi-step implementation, or wanting
  fresh context between work units. Even if the user doesn't explicitly say "phase it," consider
  this skill whenever a plan spans backend + frontend + DB, has 8+ task items across different
  domains, or where context rot in a single session is likely.
tags: [orchestration, plan-mode, multi-session, github, verification]
---

# Phasing — Multi-phase orchestration with fresh sessions

This skill orchestrates large work across multiple fresh `claude` sessions, with plan mode gating every session and self-verification gating every plan-mode exit. The user stays in the loop at every decision; no subagents do the work.

The framework's whole value is harnessing **plan mode in a fresh session**. Each phase opens its own session with clean context, brainstorms/asks/researches, drafts a plan, self-verifies the plan, gets user approval, then executes. The orchestrator session (where `/phase` was invoked) tracks state, polls for completion, and gates progression.

## §4. When to use (three trigger paths)

### §4.1 Auto-offer after a plan is presented

When you draft a plan for the user, evaluate "too big for one execution" against four criteria. Two-of-four = include `Phase it?` in the approval menu.

- Criterion A: Touches >1 distinct subsystem (e.g., DB + API + frontend; or auth + email + billing)
- Criterion B: Has natural break points where re-grounding on completed predecessor work would help
- Criterion C: Single execution likely runs into context pressure
- Criterion D: Downstream steps would benefit from grounding on verified prior output

**Auto-offer menu shape** (use this exact shape via `AskUserQuestion`, adapted from the post-plan-mode menu in §5.4 because at this moment no plan is drafted yet):

```
AskUserQuestion(
  question: "<one-sentence summary of why phasing might apply>. Phase it?",
  options: [
    { label: "Phase it (Recommended)",
      description: "Decompose into N coherent phases. Each gets its own fresh session, plan-mode gate, self-verification, and approval." },
    { label: "Adjust the phasing first",
      description: "Re-enter brainstorming on phase boundaries before locking." },
    { label: "Show me the proposed phasing first",
      description: "Render the proposed master plan (phase list + briefs + run-end verification) before deciding. No artifacts written yet." },
    { label: "Run as single execution anyway",
      description: "Override the recommendation. Faster start; accept context-rot, verification-deferral risks." },
    { label: "Abort",
      description: "Stop. No plan locked, no artifacts written." }
  ]
)
```

The "Phase it (Recommended)" option proceeds into the master plan run lifecycle (§5). "Show me the proposed phasing first" enters plan mode (§5.3), drafts the master plan, then re-issues this menu (now with "View full plan" available because a plan now exists).

### §4.2 Manual `/phase`

User runs `/phase` (against current plan in conversation) or `/phase <task description>` (from scratch). Always force; no auto-detection gate.

### §4.3 Mid-run split

A phase session that finds its scope larger than specced can `AskUserQuestion`: "Split into sub-phases?" Rare; default is to execute as specced.

## Mental model

```
You + this session (the orchestrator)
     │
     ├─ brainstorm/ask/research → plan mode → SELF-VERIFY → ExitPlanMode for user approval
     ├─ on approval → write master plan + per-phase specs (GitHub issues or files)
     │
     ├─ spawn phase 1 (manual default; auto-try optional)
     │       │
     │       └─ phase 1 session: brainstorm/ask/research → plan mode →
     │           SELF-VERIFY → ExitPlanMode → execute → self-verify deliverables
     │           → write handoff → exit
     │
     ├─ verify phase 1 result (orchestrator post-phase) → "go to phase 2?" gate
     ├─ spawn phase 2 ... etc
     │
     └─ run-end: verification plan → closure summary → archive prompt → improvement candidates
```

Three first-class invariants: **plan-mode gating** in every fresh session, **self-verification** before every `ExitPlanMode`, **user approval** at every transition.

## Session naming

Every session that participates in a phasing run gets a human-readable name derived from the task it's working on. **This is the same name that appears as the session-title pill in the Claude Code status line** — set it at session start so the pill is correct, and reuse it in summaries and handoffs so the user can tell at a glance which session produced which artifact.

- **Orchestrator session**: `orchestrator-<run-topic-slug>` — the topic-slug component of the run-id (the part after `<YYYY-MM-DD>-`). Example: run-id `2026-04-30-p0-bootstrap` → session `orchestrator-p0-bootstrap`. Stored at `run.json#session_name`.
- **Phase session**: `phase-<N>-<phase-name-slug>` — the phase number followed by the phase's name from the master plan, kebab-case-slugified. Example: phase 2 named "Hooks audit + fixtures" → session `phase-2-hooks-audit-fixtures`. Stored at `run.json#phases[N].session_name`.

Slugify rule: lowercase, replace whitespace and `_/.+` with `-`, drop other non-alphanumerics, collapse repeated `-`, trim leading/trailing `-`. If two phase names slugify to the same value (rare; phase numbers already disambiguate), append `-a`, `-b` to disambiguate.

The name identifies the *task*, not a particular session execution: a resumed orchestrator (`/phase-resume`) reuses the same name because the task hasn't changed.

### Data vs display rule

`run.json#session_name` and `run.json#phases[N].session_name` are **plain text** — the bare slug, no decoration. Every grep / lookup / equality check against the session name depends on this. Examples of valid stored values: `orchestrator-trivial-files`, `phase-2-hooks-audit-fixtures`.

The **display layer** prepends an emoji at render time:
- Orchestrator session displays as `🎯 orchestrator-<slug>` — in the OSC-2 title, in card body lines, in the run-end `Sessions:` audit line, in handoff `**Session**:` lines.
- Phase session displays as `⚡ phase-<N>-<slug>` — same surfaces.

Never write the emoji into `run.json`. Never strip the emoji from a chat display. The renderer's job is to add the prefix; the data layer's job is to stay clean.

### How to surface the name as the Claude Code title pill

For **phase sessions**: `scripts/launch-terminal.sh` emits the OSC-2 title-set (with the `⚡` prefix) before exec'ing `claude` in the new terminal. Reliable — the title is set on the spawned terminal before Claude Code starts, so the pill renders correctly from the first frame.

For the **orchestrator session**: see the "Orchestrator title pill limitation" subsection below. There is no reliable in-session OSC-2 path because Claude Code sanitizes ANSI escapes in chat output. The user can opt in via a shell wrapper.

These names appear:
- As the **Claude Code title pill** for the session (phase sessions auto-set; orchestrator user-opted).
- In the status block (see "Status block" below) at every orchestrator gate — with the emoji display prefix.
- In the handoff document (§6.7, see `references/handoff-shape.md`) — at the top, with the emoji display prefix.

### Orchestrator title pill limitation

The orchestrator session is already running when it tries to set its own terminal title, and Claude Code sanitizes ANSI escapes in chat output. There is no reliable way to update the orchestrator's pill from inside the running session.

Two options for the user:

**Option 1 (recommended): shell wrapper alias.** Add to your shell rc (`.zshrc` / `.bashrc`):

```bash
phase-claude() {
  printf '\033]2;🎯 orchestrator-pending\007'
  claude "$@"
}
```

Invoke `phase-claude /phase ...` instead of `claude /phase ...`. The wrapper sets a placeholder title before `claude` starts; once the orchestrator locks the run-id, it surfaces a follow-up shell line in chat for the user to paste — something like:

```
Set your terminal pill to the real run name:
  printf '\033]2;🎯 orchestrator-<run-topic-slug>\007'
```

**Option 2: accept the default pill.** The orchestrator pill stays as the terminal's default (project name, `~`, whatever). Phase pills update correctly via `launch-terminal.sh`, so the visible phase-execution signal is intact. Less ergonomic but no extra config.

The orchestrator MUST surface the Option-1 paste line in chat at §5.5 right after locking the run-id, so the user has a copy-pastable command. Surface it once; don't repeat across phases.

### Missing-field derivation rule

Both `session_name` fields in `run.json` are caches, not preconditions. If the orchestrator reads a `run.json` lacking either:

- **Top-level `session_name` missing** → derive as `orchestrator-<run-topic-slug>` from the run-id (the part after `<YYYY-MM-DD>-`).
- **`phases[N].session_name` missing** → derive as `phase-<N>-<slug-of-name>` using the slugify rule above.

This means `run.json` files written before this skill version still render correctly — no migration code needed. When the orchestrator next writes `run.json`, the derived values are persisted so subsequent reads are O(1).

## Status block

Every orchestrator gate emits a **status block** — a Unicode-box-drawing card that tells the user where they are in the run, what's done, what's left, and what to do next. One card shape, five variants (plus a one-line mid-phase beat). The card replaces the ad-hoc prose summaries earlier iterations relied on.

**Rendering rule (NON-NEGOTIABLE).**

1. The card is the **first** chat output at every gate. Emit the card, THEN any `AskUserQuestion` menu. Never substitute a prose summary. Never skip the card. If you're about to ask the user a gate question without the card immediately above it, that's a bug — render the card first.
2. The card MUST be emitted **inside a triple-backtick code fence** (` ``` ... ``` `). The fence is part of the card. Do not emit the card unfenced — Claude Code re-interprets the box-drawing and bullet characters as markdown without the fence, and the card body collapses to plain text.
3. Emit the card **literally as shown below**, character for character. Preserve every box-drawing character (`╭ ╮ ╰ ╯ ─ │`), every progress glyph (`▰ ▱`), every status emoji (`✅ 🚀 ⏳ 🏁 🛑 🟢 🟡 ⚪ 🔴 ⚡ 🎯`), every section emoji (`📦 🔧 ❔ ▶`), and the spacing within each line.
4. Right-edge alignment may wiggle ±2 cells across terminals where emoji widths differ. That's expected; the card still reads as framed. Render the card once and move on — do not retry to "fix" alignment.
5. Do NOT substitute markdown headers (`##`), do NOT swap bullets (`*`, `-`) for the section markers, do NOT render this as a markdown list.

**Data vs display rule.** Emoji prefixes (`🎯` on orchestrator, `⚡` on phase) are **display-only**. `run.json#session_name` and `run.json#phases[N].session_name` stay plain text (`orchestrator-foo`, `phase-1-bar`) — every grep/lookup/equality check against the data depends on this. The display layer (OSC-2 titles, card body lines, handoff `**Session**:` lines) prepends the emoji at render time only. See "Session naming" for the full rule.

### Post-phase variant (canonical — emitted at every between-gates moment)

Emit this card **inside a code fence**, then fire the approval `AskUserQuestion` (Approve / Adjust / Abort):

````
```
╭─ Phase <N> / <total> ────────────── ✅ COMPLETE ──╮
│ ⚡ phase-<N>-<phase-name-slug>                     │
│ <progress-bar>  <pct>% · <remaining> phases left  │
╰───────────────────────────────────────────────────╯

  📦 Did
     • <deliverable path or summary>
     • <deliverable path or summary>

  🔧 Decisions
     • <topic>: <decision> · <why, ≤60 chars>

  ❔ Open
     <open-questions text from handoff, or "none">

  ▶ Up next
     🟢 P<m>  <name>                                       (completed phases stay listed)
     🟡 P<m>  <name>                ⏳ ~<X>m elapsed       (in_progress phase)
     ⚪ P<n+1>  <name> — <1-line goal>                     (pending)
     ⚪ P<n+2>  <name> — <1-line goal>
     🔴 P<m>  <name>                                       (only if a phase failed)

  /phase-next  ·  /phase-status  ·  /phase-abort
```
````

**Field rules:**
- `<N>` / `<total>`: numbers, not placeholders. E.g., `Phase 2 / 6`.
- `<phase-name-slug>`: the **plain-text** value of `run.json#phases[N-1].session_name`, or derived per "Session naming". The `⚡ ` prefix is added by the renderer (data/display rule); do NOT prepend it inside `run.json`.
- `<progress-bar>`: 6-segment bar, filled = `▰`, empty = `▱`. Formula: `floor((complete / total) * 6)` filled segments. E.g. 33% (2/6) → `▰▰▱▱▱▱`.
- `<pct>`: integer percent of phases complete (`round((complete / total) * 100)`).
- `<remaining>`: count of phases with status `pending` or `in_progress`.
- `📦 Did` / `🔧 Decisions` / `❔ Open` content: lifted **verbatim** from the just-completed phase's handoff sections `What I did`, `Decisions I made` (or `Decisions made`), `Open questions for you` (or `Open questions / notable`). If a section is empty in the handoff, the card shows `none`. No re-summarization.
- `▶ Up next` entries: one line per phase in `run.json#phases[]`, prefixed by its status circle: `🟢` complete, `🟡` in_progress (with `⏳ ~Xm elapsed` after the name), `⚪` pending, `🔴` failed. Completed phases stay in the list so the user sees full run progress, not just remaining work. For pending phases, the 1-line goal is derived from the phase spec's `## Goal` (see "Phase briefs"). If absent, omit the `— <goal>` suffix.
- The final shortcuts line is rendered verbatim — those characters help the user discover the commands.

After the card (and the closing ` ``` ` fence), fire the approval `AskUserQuestion` menu (Approve / Adjust / Abort). The card is the **read** surface; the menu is the **action** surface.

### Run-start variant (emitted at §5.5 after master plan locks)

Emit inside a code fence, then the spawn-approval `AskUserQuestion`:

````
```
╭─ Run start · <total> phases ──────────── 🚀 READY ──╮
│ 🎯 orchestrator-<topic-slug>                         │
│ ▱▱▱▱▱▱  0% · <total> phases ahead                    │
╰─────────────────────────────────────────────────────╯

  ▶ Phase queue
     ⚪ P1  <name> — <1-line goal>
     ⚪ P2  <name> — <1-line goal>
     ...

  Approve to spawn P1, or adjust the master plan.
```
````

NO `📦 Did` / `🔧 Decisions` / `❔ Open` sections (nothing has happened yet). Badge is `🚀 READY`. Section heading is `▶ Phase queue` (not `▶ Up next`) because nothing's been done. All phases are `⚪` pending. Orchestrator name carries the `🎯` display prefix.

### Resume variant (emitted when `/phase-resume` is invoked)

Emit inside a code fence, as the **first** chat output after rebuilding state from `run.json`:

````
```
╭─ Resumed at Phase <N> / <total> ────── ⏳ IN PROGRESS ──╮
│ 🎯 orchestrator-<topic-slug>                            │
│ <progress-bar> <pct>% · P<N> running ~<M>m · <K> left   │
╰────────────────────────────────────────────────────────╯

  📦 Did (P<N-1>)
     • <deliverables from the most recently completed phase's handoff>

  🔧 Decisions (P<N-1>)
     • <decisions from P<N-1>'s handoff>

  ▶ Phase status
     🟢 P1  <name>
     🟢 P2  <name>
     🟡 P<N>  <name>                ⏳ ~<M>m elapsed
     ⚪ P<N+1>  <name> — <1-line goal>
     ⚪ P<N+2>  <name> — <1-line goal>

  Wait for handoff, or /phase-retry <N> if you believe it's dead.
```
````

Badge is `⏳ IN PROGRESS`. `<M>` is minutes since `phases[N-1].started_at`. If no phase is `in_progress` (orchestrator was killed between phases), drop the elapsed marker and use the post-phase template's badge (`✅ COMPLETE`) and next-action ("Approve to spawn the next, or /phase-next"). Section heading becomes `▶ Phase status` (showing all phases with status circles) rather than just `Up next` — the resume needs to show the user what's done as well as what's left.

### Run-end variant (emitted at §5.7)

Emit inside a code fence, then the archive `AskUserQuestion`:

````
```
╭─ Run complete · <total>/<total> ────────── 🏁 DONE ──╮
│ 🎯 orchestrator-<topic-slug>                          │
│ ▰▰▰▰▰▰  100%                                          │
╰──────────────────────────────────────────────────────╯

  Sessions: 🎯 orchestrator-<topic-slug> → ⚡ phase-1-<slug> → ⚡ phase-2-<slug> → ...

  📦 Did (aggregated · <total> phases)
     • <deliverable from P1's handoff>
     • <deliverable from P2's handoff>
     • ...

  🔧 Decisions (aggregated)
     • <decision from any phase>
     • <decision from any phase>

  ❔ Open / notable
     <any open question that survived to run-end, or "none">

  ▶ All phases
     🟢 P1  <name>
     🟢 P2  <name>
     🟢 P3  <name>
     ...

  Next: /phase-archive (recommended), keep in active dir, or delete.
```
````

Then fire the archive `AskUserQuestion`. The `Sessions:` line uses the **display form** with `🎯`/`⚡` emoji prefixes (Q2 data/display rule — the prefixes come from the renderer, not `run.json`). `📦 Did` / `🔧 Decisions` aggregate across all phases. All phases show as `🟢` (completed) under `All phases`.

### Aborted variant (emitted when `/phase-abort` resolves)

Emit inside a code fence:

````
```
╭─ Run aborted at Phase <N> / <total> ───── 🛑 ABORTED ──╮
│ 🎯 orchestrator-<topic-slug>                            │
│ <progress-bar>  <pct>% · <K> done, <M> not started      │
╰────────────────────────────────────────────────────────╯

  📦 Did (<K> phases)
     • <aggregated deliverables from completed phases>

  ❔ Reason
     <abort_reason from run.json, or "no reason given">

  ▶ Phase status
     🟢 P1  <name>
     🟢 P2  <name>
     ⚪ P<N>  <name>                                       (not started or in_progress when aborted)
     ⚪ P<N+1>  <name>

  Next: /phase-archive <run-id> to file it, or delete <run-dir>.
```
````

Badge is `🛑 ABORTED`. Phase queue uses `🟢` for completed, `⚪` for not started / aborted-mid-flight. Done phases keep their `🟢` (audit trail of what got finished).

### Mid-phase beat (NOT a card — a single line)

Emitted every ~5 minutes by the polling loop in §7.3 while a phase is `in_progress`. **Not** fenced — it's a chat one-liner:

```
⏱  ⚡ phase-<N>-<phase-name-slug>  ·  ~<M>m elapsed  ·  still running
```

Phase name carries the `⚡` display prefix (consistent with the title pill and card body). After 4 consecutive beats (~20 min) without a handoff, escalate to a one-paragraph long-running warning with an `AskUserQuestion`: `Keep waiting` / `Open the phase terminal` / `Assume dead and /phase-retry` / `Abort run`. The card returns on the next gate (post-phase or aborted variant).

### Phase briefs come from each spec's `## Goal`, on demand

The 1-line goal in `▶ Up next` / `▶ Phase queue` entries is **derived from the phase spec**, not persisted in `run.json`. The renderer:

1. For each upcoming phase, reads its spec body (file mode: `phase-<N>-spec.md`; GitHub mode: `gh issue view <issue-N> --json body`).
2. Extracts the first non-empty line under the spec's `## Goal` header.
3. Truncates to ~60 chars (so it fits one card row).
4. If the spec is missing or has no `## Goal`, omit the ` — <goal>` suffix entirely. No crash, no placeholder.

The renderer caches reads **within a single card render** (don't re-read N specs N times). No caching across renders. The phase spec is the single source of truth for goals.

`references/master-plan-shape.md` also surfaces the goal inline in the Phases checklist — that's for the human reading the master plan at the approval gate, independent of the card renderer.

### Card width

The header line is fixed-width to keep the card aligned. Target the longest header content to fit within ~52 chars between the `╭─` and `─╮`. If a slug or session name exceeds the budget, truncate with an ellipsis (`…`). Don't widen the card — preserves visual consistency across surfaces.

### Anti-patterns (do not do these)

- Replacing the card with markdown headers (`## Phase 2 complete`) — defeats the visual distinction the user asked for.
- Re-summarizing handoff content in your own prose — lift verbatim.
- Omitting the progress bar or replacing `▰▱` with ASCII (`#`, `=`) — those exact glyphs are the design.
- Skipping the card and going straight to `AskUserQuestion` — the card is the read surface and gates the menu.
- Padding the card with extra blank lines or decorative ASCII art beyond the spec — keep it lean.

## §5. Master plan run lifecycle

When `/phase` is invoked (or auto-offer accepted), this session becomes the orchestrator. Order:

### §5.1 Load + understand (project-agnostic)

Discover docs without hardcoding paths. Read in this order:
- Always: `CLAUDE.md`, `MEMORY.md` (typically already in context), the source plan in conversation if any, files the user explicitly references.
- Discover and read if relevant: pointers from CLAUDE.md (master design specs, ADR directories, project-status docs).
- Ask if the task is non-trivial and nothing relevant has surfaced: `AskUserQuestion`: "Are there any project docs I should read before drafting? (paths or 'no')"

This skill is cross-project — no path assumptions.

### §5.2 Brainstorm + ask + research (loop, any order)

- **Brainstorm** alternatives. State options, pick a recommendation, surface trade-offs.
- **Ask** clarifying questions via `AskUserQuestion`, one at a time, with concrete options. Use free text only when the answer requires it (e.g., "what's the file path?").
- **Research** when quality demands it: WebFetch, context7 MCP for library docs, repo analogues, industry references. Skip when not needed — research is not theater.

Loop until you have enough signal to draft a master plan.

### §5.3 Plan mode (`EnterPlanMode`) — drafts the master plan

Inside plan mode, draft: phase list with one-paragraph briefs, decisions baked in, out-of-scope, the run-end verification plan. No files written yet.

### §5.3a Self-verification before `ExitPlanMode` — MANDATORY

Re-read the draft as if seeing it fresh. Check for: internal contradictions, hallucinated facts (claims not actually verified), missing context (required reading not loaded), under/over-scoped phases (one phase that's two phases jammed together; one phase that's a subset of another), missing verification steps, tone/length issues.

**Pass count**: default 1 pass. If issues found, fix and re-verify (pass 2). High-complexity plans (≥5 phases) get ≥2 passes minimum. Hard ceiling: 3 passes.

**Output**: every plan file MUST end with a `## Self-verification` section showing passes count, per-pass summary, and "Final state: clean" (or "clean after N fixes"). The user sees this footer in the plan during review. This isn't ceremony — it forces a real second look at the draft before it lands in front of the user.

### §5.4 Approval menu (`ExitPlanMode` then `AskUserQuestion`)

Options:
- **Approve and start** (Recommended) — locks the plan, enters execute mode.
- **Adjust** — sub-menu (re-order, split phase, merge, drop, edit).
- **View full plan** — re-render.
- **Abort** — stop, no artifacts written.

### §5.5 Execute mode (writes artifacts)

Pick run-id `<YYYY-MM-DD>-<topic-slug>`. Append `-2`, `-3` on collision.

Derive the orchestrator session name `orchestrator-<run-topic-slug>` from the run-id (plain text — no emoji per the data/display rule) and store at `run.json#session_name` on first write. The `🎯` display prefix is added by renderers (cards, handoff lines, OSC-2 title).

Pick mode (`AskUserQuestion`):
- GitHub remote present (`git remote get-url origin` returns `github.com`)? → default GitHub mode (confirm).
- No GitHub? → ask: "Create a GitHub repo for this run, or use file mode?"

Write artifacts per `references/master-plan-shape.md` (master plan), `references/phase-spec-shape.md` (each phase), `references/github-mode-commands.md` (exact `gh` invocations for GitHub mode), and the file-mode layout below.

**Surface the orchestrator-pill paste line** in chat right after locking the run-id (per "Orchestrator title pill limitation"):

> Set your terminal pill to the run name:
> ```
> printf '\033]2;🎯 orchestrator-<run-topic-slug>\007'
> ```

Render this once; do not repeat per phase.

**Render the run-start status block** (see "Status block" → Run-start variant) as the **first** chat output before the spawn-approval `AskUserQuestion`. The card is fenced (```` ``` ````), uses the `🚀 READY` badge, lists all phases as `⚪` pending under `▶ Phase queue` with their 1-line goals derived from each spec's `## Goal`.

### §5.6 Per-phase orchestration loop

**NON-NEGOTIABLE: the orchestrator NEVER executes phase work itself.** This is the framework's foundational contract. After dispatching a phase (manual command emitted, or `launch-terminal.sh` invoked), the orchestrator's **only** allowed activities are:

1. Polling for the handoff (file write in file mode, issue close + handoff comment in GitHub mode).
2. Emitting mid-phase beats every ~5 min (see §7.3).
3. Reading the handoff when it lands and rendering the **post-phase card** at the next gate.
4. Running orchestrator-side post-phase verification (§9.2) — re-running key command steps, confirming file existence — but NOT redoing the phase's scope.

**BANNED** while a phase is dispatched:
- Editing files within the phase's scope (the phase session owns those edits).
- Running commands that perform phase work (build, test, install, etc., except for orchestrator-side verification).
- Drafting code, configs, content that belongs to the phase.
- "Helping out" the phase session in any way.

If the orchestrator finds itself about to do phase work, **stop, dispatch properly, and wait.** The phase session is supposed to load context fresh, enter plan mode, self-verify, and execute — that's the framework's quality lever. Orchestrator-side phase work bypasses every quality gate and undoes the whole point of phasing.

For each phase:
- Spawn phase session (see Spawning model). `scripts/launch-terminal.sh` sets the phase terminal title to `⚡ phase-<N>-<slug>` via OSC-2 before exec'ing `claude`.
- Poll in background for completion (file write or issue close + handoff comment). The poll loop emits mid-phase beats every ~5 min (see §7.3 and "Status block" → Mid-phase beat).
- Read handoff. Run orchestrator post-phase verification (see Verification).
- If issues found: self-healing menu.
- **Render the post-phase status block as the FIRST chat output at this gate** (see "Status block" → Post-phase variant). The card is fenced (```` ``` ````), uses `✅ COMPLETE` badge, lifts `What I did` / `Decisions made` / `Open questions` verbatim from the handoff, and renders the full phase queue with status circles (🟢/🟡/⚪/🔴) and goals from each pending phase's spec. THEN fire the approval `AskUserQuestion` (Approve / Adjust / Abort).
- On approval, spawn phase N+1.

### §5.7 Run-end closure

- Run the run-level verification plan.
- **Render the run-end status block as the FIRST chat output** (see "Status block" → Run-end variant). The card is fenced (```` ``` ````), uses `🏁 DONE` badge, opens with the `Sessions:` audit line in **display form** (`🎯 orchestrator-<slug> → ⚡ phase-1-<slug> → ⚡ phase-2-<slug> → ...`), aggregates `Did` / `Decisions made` / `Open` across all phases, and shows all phases as `🟢` complete under `▶ All phases`. Then fire the archive `AskUserQuestion`.
- Mark run complete; close tracking issue (GitHub mode).
- **Archive prompt** (`AskUserQuestion`): Archive (Recommended) / Keep in active dir / Delete local state. See `references/archive-policy.md`.
- Surface continuous-improvement candidates collected during run.

## §6. Phase session lifecycle

Each phase opens in a fresh session via `claude /phase-execute <run-id> <N>`. Order:

### §6.1 Load context

- Master plan (GitHub mode: `gh issue view <tracking-issue> --json body`; file mode: read file).
- This phase's spec/issue.
- Predecessor handoffs (every prior completed phase).
- Cross-phase landscape (the one-line summary of every phase, present in the spec — so this phase knows where it sits).
- Project files listed in spec's "Required reading".

Derive this session's name: `phase-<N>-<phase-name-slug>` from the phase number and phase name in the spec (plain text — no emoji per the data/display rule), and persist to `run.json#phases[N].session_name` on first write. The terminal title (`⚡ phase-<N>-<slug>`) is already set by `scripts/launch-terminal.sh` before this session started — no need to re-emit OSC-2 from inside the running session. The handoff (§6.7) MUST surface the display name `⚡ phase-<N>-<slug>` at the top.

### §6.2 Brainstorm + ask + research (loop, any order)

Same shape as master plan §5.2, scoped to this phase. Skip if the spec encodes everything needed.

### §6.3 Plan mode (`EnterPlanMode`) — MANDATORY, ALWAYS

Non-negotiable. Every phase enters plan mode regardless of task type — code, writing, research, design, anything. The reason this is hard-rule: the user paid the orchestration overhead specifically for the plan-mode gate. Skipping it defeats the purpose.

Plan covers: which files to touch, in what order, with what tests, what's the verification trail. For code phases, TDD steps explicit (test → red → impl → green). For non-code phases, outline / sources / decisions.

### §6.3a Self-verification before `ExitPlanMode` — MANDATORY

Same protocol as master plan §5.3a. High-complexity = ≥10 work steps → ≥2 passes minimum. Hard ceiling 3 passes. Same `## Self-verification` footer required.

### §6.4 Approval (`ExitPlanMode`)

User approves the plan file the system shows them. No bypass. The plan file is the gate.

### §6.5 Execute

Make the changes. Run verification commands as you go (don't bunch them at the end — that's how DEFERREDs sneak in).

### §6.6 Self-verify deliverables

Run all verification steps in the spec. Every step MUST resolve to PASS or surface a real failure.

**Hard rule: do NOT defer verification to the orchestrator.** If a step can't be verified inside the phase session, the phase fails — full stop. The temptation to write "couldn't verify X, leaving for orchestrator" survives subagent removal; it's still banned. The reason: the orchestrator can't actually re-do the work. Deferral becomes hallucinated confidence downstream.

If any step fails: write a `failed` handoff with the failing step. Do NOT loop. Do NOT auto-fix. Do NOT defer.

### §6.7 Write handoff

- File mode: write `<run-dir>/phase-N-handoff.md`.
- GitHub mode: comment handoff content on phase issue, close issue.
- Handoff is short (~200 lines max, soft target), human-readable. See `references/handoff-shape.md`.

### §6.8 Exit

One-line completion to chat. Orchestrator's poll picks it up.

## §7. Spawning model

### §7.1 Default: manual spawn

Auto-spawn into VS Code is unreliable. Default to manual via `AskUserQuestion`:
```
Phase N is ready. How to launch?
  1. I'll open a new terminal myself (Recommended)
  2. Try auto-spawn (best-effort; falls back to option 1 if it fails)
  3. Cancel
```

**If "manual": MANDATORY emission sequence. Do NOT skip any step. Do NOT reorder.**

**Step 1: Emit the spawn command in chat as a fenced bash block with ALL placeholders substituted from `run.json`.** This is non-negotiable. The user must see a copy-paste-ready command, not a template. Example with substituted values for a phase named "Plugin scaffolding" in run-id `2026-05-12-unify-kit-v2`:

````
Spawn phase 1 by pasting this in a new terminal:

```bash
cd ~/Projects/unify-kit && printf '\033]2;⚡ phase-1-plugin-scaffolding\007' && claude /phase-execute 2026-05-12-unify-kit-v2 1
```
````

Substitution rules:
- `<repo-root>` → absolute path to the project root (the directory containing `.claude/phasing/<run-id>/`). Use `~` for `$HOME` if appropriate; otherwise full path. Do NOT leave as a placeholder.
- `<N>` → the phase number (integer).
- `<phase-name-slug>` → the plain-text value of `run.json#phases[N-1].session_name` (e.g., `phase-1-plugin-scaffolding`).
- `<run-id>` → the run-id from `run.json#run_id`.

**Step 2: Fire `AskUserQuestion` confirming the user has spawned.** Do NOT mark `run.json` as `in_progress` yet — wait for the user to confirm.
```
Did you paste the command and start the phase session?
  1. Yes — start polling for the handoff (Recommended)
  2. Wait — I need to fix something / try auto-spawn instead
  3. Cancel — don't spawn this phase
```

**Step 3: On "Yes" confirmation only**, mark `run.json#phases[N-1]`:
- `status: "in_progress"`
- `started_at: <iso-now>`

Atomic write.

**Step 4: Start the background poll** (per §7.3).

This four-step order matters: a phantom `in_progress` state with no actual phase session is worse than nothing — the orchestrator polls indefinitely for a handoff that never arrives.

### §7.2 Auto-spawn (best-effort)

`scripts/launch-terminal.sh` detects iTerm/Terminal/VS Code/Warp and tries the appropriate AppleScript or CLI. Pass the phase-name-slug as the 4th arg so the script sets the title (`phase-<N>-<slug>`) before exec'ing claude. On failure, prints the manual command and falls back. Do not promise auto-spawn works in any specific terminal until tested.

### §7.3 Polling + mid-phase beats

`Bash` with `run_in_background: true`. Doesn't block the chat — the user can keep talking to you while a phase runs.
- File mode: `until [ -f <run-dir>/phase-N-handoff.md ]; do sleep 5; done`
- GitHub mode: poll `gh issue view <issue-N> --json state,comments` for `state: CLOSED` plus a handoff comment.

**Mid-phase beats.** While the poll waits, the orchestrator emits a one-line status beat every ~5 min so the user knows the phase is still alive (the `⚡` emoji prefix is consistent with the title pill and card body — display rule):
```
⏱  ⚡ phase-<N>-<phase-name-slug>  ·  ~<M>m elapsed  ·  still running
```
After 4 consecutive beats (~20 min) without a handoff, the orchestrator escalates to a one-paragraph long-running warning with options via `AskUserQuestion`: `Keep waiting` / `Open the phase terminal to check on it` / `Assume dead and /phase-retry` / `Abort run`. Beats stop the moment the handoff lands or the orchestrator is `/phase-resume`d (a fresh poll loop starts with its own beat clock).

### §7.4 Manual nudge

`/phase-resume <run-id>` re-checks state if the background poll dropped (terminal crashed, context reset). Idempotent. On invocation, the orchestrator renders the **Resume variant** of the status block (see "Status block") as the FIRST chat output before doing anything else, so the user re-grounds on current state.

## §9. Verification

Two real layers + run-end. See `references/verification-types.md` for step types.

### §9.1 Per-phase self-verification (inside phase session)

The phase spec lists verification steps. Phase session runs them itself before handoff. Step types:
- **command** — exact shell command, exit 0 + match expected output.
- **check** — phase confirms a structured criterion against the deliverable.
- **review** — phase re-reads its own work against the spec's acceptance criteria.

No DEFERRED. No defer-to-orchestrator (see Phase session §7 hard rule).

### §9.2 Orchestrator post-phase verification (after handoff)

Orchestrator reads handoff, then runs its own checks. Re-runs key `command` steps for high-stakes phases. Confirms files claimed in handoff actually exist with claimed content. Confirms cross-phase consistency (does this phase's output respect prior phases' decisions?). Surfaces anything notable in plain language.

For deeper spec-conformance review of a completed phase's deliverables, invoke `/iterative-review phase <run-id> <N>` — auto-detects phase mode, reads the spec + handoff, and runs the bounded review-fix-verify loop. Plan-affecting findings surface through the existing handoff "Open questions for downstream" channel, so the locked master plan is never modified. Reserve this for phases where structural verification alone isn't enough (e.g., docs-heavy phases, cross-cutting refactors).

### §9.3 Self-healing on issues

If post-phase verification finds problems, render the issue + a proposed fix. `AskUserQuestion`:
- "Apply fix in this session" (orchestrator does it now — only for trivial-medium)
- "Show details first"
- "Punt to a fix-phase" (insert mini-phase before continuing — DEFAULT for load-bearing fixes)
- "Accept as-is" (note gap, move on)
- "Abort run"

Self-healing only fires for trivial-medium issues. For anything load-bearing, default to fix-phase.

### §9.4 Run-end verification plan

Master plan generation includes a checklist (in tracking issue body / `master-plan.md`):
- Tests pass on merged result.
- All planned deliverables exist.
- Master design spec (if any) honored.
- No orphan files.
- Closure summary signed-off.

Same self-healing protocol applies.

## State model (`run.json`)

Atomic write (temp-file-then-rename) on every transition. Lives at `.claude/phasing/<run-id>/run.json`.

```json
{
  "run_id": "2026-04-30-p0-bootstrap",
  "created_at": "...",
  "locked_at": "...",
  "task_description": "...",
  "mode": "github",
  "tracking_issue": 42,
  "overall_status": "in_progress",
  "session_name": "orchestrator-p0-bootstrap",
  "phases": [
    { "n": 1, "name": "Monorepo skeleton", "issue_number": 43, "status": "complete",
      "session_name": "phase-1-monorepo-skeleton",
      "started_at": "...", "completed_at": "...", "handoff_url": "..." },
    { "n": 2, "name": "Hooks audit + fixtures", "issue_number": 44, "status": "in_progress",
      "session_name": "phase-2-hooks-audit-fixtures", "started_at": "...",
      "retry_count": 0 }
  ],
  "archived_at": null,
  "aborted_at": null,
  "abort_reason": null
}
```

`session_name` at the top level identifies the orchestrator session; `session_name` inside each `phases[]` entry identifies the phase session that produced (or is producing) that phase. Both values are also set as the Claude Code title pill at session start. See "Session naming" for format.

`retry_count` (per phase, optional, default 0) — incremented by `/phase-retry`. Absent on phases that have never been retried; renderers treat missing as 0.

`aborted_at` / `abort_reason` (top-level, optional) — set by `/phase-abort`. Null/absent on healthy runs; populated when a run is stopped mid-flight (distinct from `archived_at`, which is set by `/phase-archive` after a run completes or is aborted).

States: `pending` / `in_progress` / `complete` / `failed`. No `BLOCKED`, `NEEDS_INPUT`, `DEFERRED`, `awaiting_*`. The simplicity is the win — fewer states = fewer ambiguities.

## File mode layout

When GitHub mode unavailable and user declines repo creation:
```
.claude/phasing/<run-id>/
├── master-plan.md         # the master plan body
├── phase-N-spec.md        # one per phase
├── phase-N-handoff.md     # one per phase, written at completion
└── run.json               # state file
```

Archived runs move to `.claude/phasing/archive/<YYYY>/<run-id>/` (see `references/archive-policy.md`).

## Slash commands

### Run-id auto-detection (shared by all `/phase-*` commands that take `[run-id]`)

All commands that accept an optional `[run-id]` argument resolve it identically:

1. If passed explicitly, use that. Validate it points to a real `run.json` (`.claude/phasing/<run-id>/run.json` under any project root).
2. Otherwise scan `~/Projects/*/.claude/phasing/*/run.json` (skip `archive/` subtrees) for files where `overall_status == "in_progress"`.
3. If exactly one in-flight run, use it.
4. If zero, error: `No in-flight phasing runs. Pass a run-id explicitly or start one with /phase.`
5. If multiple, render the same compact table as `/phase-list` and `AskUserQuestion` "Which run?" with the in-flight options.

The scan is cheap (single pass, no GitHub round-trip). GitHub-mode runs are still indexed by their local `run.json`.

### Entry points

- `/phase [task description]` — entry point. Always forces; no auto-detection gate.
- `/phase-execute <run-id> <N>` — auto-loaded by `launch-terminal.sh` OR run manually in a fresh terminal. MUST `EnterPlanMode` after loading context. Executes after approval. Writes handoff.
- `/phase-resume <run-id>` — resume from `run.json`; renders the Resume variant of the status block. Folds in manual-nudge use case. Idempotent.
- `/phase-archive <run-id>` — manual archive (per `references/archive-policy.md`).

### Status + navigation commands

- `/phase-status [run-id]` — render the current status block on demand. No state mutation. The variant is chosen from `run.json`: `overall_status: complete` → run-end; any phase `in_progress` → resume; at least one phase `complete`, none `in_progress`, more pending → post-phase; nothing started → run-start.
- `/phase-list` — enumerate all in-flight phasing runs on this machine. Scans `~/Projects/*/.claude/phasing/*/run.json` for `overall_status == "in_progress"` (skip `archive/`). Renders a markdown table: `Run-id | Mode | Progress | Last activity | Task`. Below the table, lists shortcuts (`/phase-status <run-id>`, `/phase-next <run-id>`, `/phase-abort <run-id>`).

### Progression commands

- `/phase-next [run-id]` — advance to the next pending phase. **Typing this command IS the approval** — no `AskUserQuestion` menu fires.
  1. Resolve run-id (auto-detect rule).
  2. Verify the last completed phase actually has a handoff present (file mode: `phase-<N>-handoff.md`; GitHub mode: phase issue closed + handoff comment). If a phase is `in_progress` without a handoff, error: `Phase <N> still running. Wait for handoff, or /phase-retry <N> if dead.`
  3. Identify the next pending phase. If none, error: `Run complete (<K> phases done). Use /phase-archive <run-id>.`
  4. Render the **post-phase status block** for context (showing the just-completed phase + remaining queue).
  5. Spawn the next phase via `scripts/launch-terminal.sh <run-id> <N+1> <project-dir> <phase-name-slug>`.
  6. Update `run.json`: set phase N+1 `status: in_progress`, write `started_at`.
  7. One-line confirmation. If invoked inside the orchestrator session, the existing poll picks up the new in-progress phase; if invoked elsewhere, exit cleanly — the orchestrator's poll will see the new state on its next tick.

- `/phase-abort <run-id> [reason]` — clean run abort (distinct from archive). Archive = run completed and we're filing it; abort = stopping a live run mid-flight.
  1. Resolve run-id.
  2. Confirm via `AskUserQuestion`: `Abort run <run-id>? <K> phases done, <M> remaining. This is irreversible.` Options: `Abort (Recommended)` / `Adjust the master plan instead` / `Keep going`.
  3. On confirm: update `run.json` (`overall_status: aborted`, `aborted_at: <iso>`, `abort_reason: <reason arg or free text>`). GitHub mode: post abort comment on the tracking issue, add `phasing:aborted` label, close it. For each non-complete phase issue: brief comment + close with `phasing:aborted`. File mode: state in `run.json` is enough.
  4. Render the **Aborted variant** of the status block. Next action mentions `/phase-archive` and local deletion.

- `/phase-retry <run-id> <N>` — re-spawn a phase that died, hung, or failed. `<N>` is required (no auto-detect — explicit on purpose).
  1. Resolve run-id.
  2. Read phase N's current status and prompt accordingly:
     - `complete` → `AskUserQuestion`: `Phase <N> is marked complete. Retry anyway? (overwrites handoff)`
     - `in_progress` → `Phase <N> shows in_progress (started <ago>). Assume dead and retry?`
     - `failed` → no confirmation, proceed.
     - `pending` → error: `Phase <N> never started. Use /phase-next instead.`
  3. Back up any existing handoff: rename `phase-<N>-handoff.md` → `phase-<N>-handoff.retry-<timestamp>.bak.md`. GitHub mode: leave the comment on the issue but post a retry marker.
  4. Reset `run.json#phases[N]`: `status: pending`, clear `completed_at`, clear `handoff_url`, increment `retry_count` (new optional field; absent = 0).
  5. Spawn via `scripts/launch-terminal.sh <run-id> <N> <project-dir> <phase-name-slug>`.

## Cutover when editing this skill

Editing `SKILL.md` (or any reference under `~/.claude/skills/phasing/`) on disk does not affect any orchestrator process that has already loaded it — that session keeps the previous skill content in its in-memory context. To pick up changes mid-run:

1. Wait for the current phase to finish (so you don't kill mid-execution).
2. Kill the orchestrator terminal.
3. Open a fresh terminal and run `claude` + `/phase-resume <run-id>`.

The resumed orchestrator loads the new skill content and renders the Resume variant of the status block from current `run.json` state.

Alternatively, just finish the run on the old behavior — both are valid; only do not mix.

## Continuous improvement (self-evolving framework)

When a run reveals a flow gap — missing prompt, bad default, verification step that didn't catch what it should — capture and offer a fix.

**When it fires**: repeated friction (same correction twice in one run); a verification failure the framework "should have prevented"; a flow choice obviously wrong in retrospect; user says "this should always do X" or "you shouldn't have to ask me Y" mid-run.

**Timing**: queue candidates during the run, surface at run-end (after archive prompt). Mid-run application only when blocking ongoing damage. Reason: editing SKILL.md while a run depends on it = mid-flight spec change = weirdness.

**Prompt**: `AskUserQuestion` with proposed fix + diff. Options: Apply now (Recommended) / Show diff first / Note for later / Reject.

**Scope**: ONLY edits files under `~/.claude/skills/phasing/`. NOT repo CLAUDE.md, NOT MEMORY.md, NOT source code, NOT `~/.claude/settings.json`.

**Audit trail**: Each applied improvement appends to `~/.claude/skills/phasing/CHANGELOG.md`.

## Spec length is whatever the work needs

This is industry-standard software engineering practice: specs include everything required to execute quality work. No length target, no cap. Hundreds of lines is normal for non-trivial phases.

The cost of under-specifying (fresh session improvises = hallucinated decisions) is far higher than the cost of over-specifying (slightly slower start). When in doubt, include more context, more decisions, more examples, more references.

The ONLY length constraint in this framework is on **handoffs** (~200 lines soft target — they're summaries for the next session). Specs (master plan + phase specs) have no length constraint.

See `references/master-plan-shape.md` and `references/phase-spec-shape.md` for the principle in detail.

## References (read when noted)

- `references/master-plan-shape.md` — read when writing the master plan body in execute mode (§6).
- `references/phase-spec-shape.md` — read when writing each phase spec.
- `references/handoff-shape.md` — read when a phase session is about to write its handoff (phase §8).
- `references/github-mode-commands.md` — read when in GitHub mode and need exact `gh` invocations for issue create/comment/close/label.
- `references/verification-types.md` — read when defining verification steps in a phase spec, or when running them.
- `references/archive-policy.md` — read at run-end archive prompt or when `/phase-archive` is invoked.

## Scripts

- `scripts/launch-terminal.sh` — best-effort spawn into a new terminal. Falls back to printing manual command on failure.
- `scripts/archive-run.sh` — moves run dir to archive, applies GitHub label.

## Why this skill exists

The previous `phased-execution` skill leaned on subagents. Subagents lacked tools to escalate or ask clarifying questions, so they guessed. Verification became performative (DEFERRED everywhere). Handoffs ballooned into self-reports the next subagent grounded on, amplifying invented confidence into hallucinations. The user was outside the loop by construction.

This skill rejects subagents. The whole point is plan mode in a fresh session — that's where quality lives. Plan mode gates every phase. Self-verification gates every plan-mode exit. The user reviews, approves, watches the work, and signs off before the next phase runs.
