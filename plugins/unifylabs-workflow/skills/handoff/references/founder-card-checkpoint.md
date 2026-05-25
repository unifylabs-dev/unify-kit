# Founder reference card — Phase checkpoint menu

When a phase-executor session paused mid-flight by invoking `/handoff` (per phasing skill §6.9), the orchestrator picks up the resulting `phase-N-checkpoint.md`, renders the ⏸ CHECKPOINT card (phasing skill "Status block" → ⏸ CHECKPOINT variant), then fires a 4-option decision menu (phasing skill §9.5). This card explains what each option does, when it's the right pick, and when it's the wrong pick. Read this when the menu surfaces and you're not sure which to choose.

The menu's Recommended tag attaches dynamically based on the checkpoint's Reason enum value (`context-pressure` / `scope-creep-detected` / `blocker-out-of-scope` / `other`) — but the founder's judgment overrides the tag. Read the full checkpoint body via option 3 (View detail) if you're undecided.

## Option 1 — Re-spawn from checkpoint

**Recommended when:** `reason=context-pressure`.

**What happens:** orchestrator invokes `scripts/launch-terminal.sh ... phase-continue` to spawn a fresh executor session in a new terminal. The new session loads the checkpoint, re-enters plan mode for the remaining `## Work-step progress` entries (IN-FLIGHT + PENDING), gets your approval, and executes. When it completes, the standard `phase-N-handoff.md` lands and the post-phase ✅ COMPLETE card replaces this one.

**Consequences:** `run.json#phases[N].status` transitions `checkpoint → in_progress`. `checkpoint_count` is NOT incremented by re-spawn (only by checkpoint writes). The original `phase-N-checkpoint.md` stays on disk for audit; the new session does NOT overwrite it.

**When this is the right pick:** the previous executor hit context %, paused cleanly, and a fresh-context session has plenty of room to finish the remaining steps. The work is right-scoped; only the executing session was wrong-sized.

**When this is the WRONG pick:** the phase is genuinely too big and a fresh executor will also hit context pressure (resulting in `checkpoint_count: 2`, then `3`, then re-spawn is removed from the menu). If `reason=scope-creep-detected`, prefer Split — re-spawning a scope-creep phase just wastes a session.

## Option 2 — Split phase

**Recommended when:** `reason=scope-creep-detected`, OR `checkpoint_count=2` regardless of reason.

**What happens:** orchestrator marks the current phase `complete (partial)` — partial deliverables noted in the handoff comment. Then auto-derives a NEW phase spec from the checkpoint's `## Work-step progress` (IN-FLIGHT + PENDING entries) plus any open questions, and inserts it at position N+1. Later phases renumber (P(N+1) becomes P(N+2), etc.). In GitHub mode, phase issue titles update to match.

**Consequences:** `run.json#phases[N].status` transitions `checkpoint → complete` with a `partial: true` marker in the handoff. New phase appears as `pending` at N+1. The renumbering cascades through `run.json#phases[]` and GitHub phase issues.

**When this is the right pick:** the executor's `Reason for checkpoint` body said "this phase is doing more work than the spec describes" — the spec under-scoped the phase. Splitting is the right hygiene; the framework was designed for phases to be right-sized, not heroic.

**When this is the WRONG pick:** the executor was just hitting context pressure on a correctly-scoped phase. A re-spawn would have finished it. Split creates ceremony (a new phase issue, renumbering) for no quality gain. Only escalate to Split if you've already re-spawned once and hit another checkpoint, OR the executor explicitly flagged scope creep.

## Option 3 — View checkpoint detail

**Recommended when:** `reason=other` OR no reason given OR you're undecided.

**What happens:** orchestrator reads the full `phase-N-checkpoint.md` file and displays it in chat (no state mutation; no spawn). After you've read it, the menu re-renders so you can pick a real action (Re-spawn / Split / Abort).

**Consequences:** none. `run.json` unchanged. Phase stays in `checkpoint` status. The chat context grows by the checkpoint body length (~150–250 lines typically).

**When this is the right pick:** the executor wrote `reason=other` and you need to see the full context. OR the Reason body says something ambiguous like "ran into an issue with the test fixture" and you want to inspect the World-state delta + Open questions before deciding. OR the menu auto-recommended one path but your intuition disagrees and you want evidence before overriding.

**When this is the WRONG pick:** the reason is unambiguous (`context-pressure`, `scope-creep-detected`, or `blocker-out-of-scope`) and you've worked the framework before. View-detail then re-firing the menu is an extra step; pick the recommended option directly. Don't use View detail as a procrastination move when the decision is clear.

## Option 4 — Abort phase

**Recommended when:** `reason=blocker-out-of-scope`.

**What happens:** orchestrator marks the current phase `failed`. The §9.3 self-healing menu fires next (Apply fix in this session / Show details first / Punt to a fix-phase / Accept as-is / Abort run). For abort recovery, "Punt to a fix-phase" is the most common pick — it inserts a small fix-phase before continuing the run.

**Consequences:** `run.json#phases[N].status` transitions `checkpoint → failed`. The run does NOT auto-abort; the rest of the queue can still proceed once the blocker is unblocked (typically via a fix-phase). To abort the whole run, use `/phase-abort <run-id>` separately.

**When this is the right pick:** the executor discovered something genuinely out of scope (e.g., "this phase needs a new credential we don't have yet" or "the spec relies on a library we haven't installed"). The phase cannot finish until that blocker is resolved; pretending otherwise wastes founder time.

**When this is the WRONG pick:** the blocker is actually in-scope and the executor just didn't recognize it. Read the checkpoint detail first; if the "blocker" is a misunderstanding (e.g., the executor thought it needed credentials that are already in `.env`), Re-spawn with a clarifying note in the spec rather than failing the phase.

## How `checkpoint_count` changes the menu

The orchestrator tracks how many times the same phase has hit a checkpoint (incremented on every `phase-N-checkpoint.md` write). Counts above 1 are a quality signal: the phase boundary is wrong.

| `checkpoint_count` | Menu treatment | Why |
|---|---|---|
| `=1` (first time) | Base menu, Recommended per reason. | Normal — first checkpoint is information; pick recovery accordingly. |
| `=2` (twice) | WARNING line prepended: `⚠ Phase has hit checkpoint twice — may be over-scoped. Recommend Split.` Recommended tag forced onto Split regardless of reason. | Two checkpoints means the previous Re-spawn (or whatever) didn't resolve the underlying issue. Split surfaces as the corrective. |
| `≥3` (third+) | **Re-spawn (option 1) removed.** Only Split / View detail / Abort offered. | Three checkpoints proves the scope is wrong; re-spawning will just hit a fourth. The framework forces a structural decision. |

## After picking

**After Re-spawn:** the new terminal opens with `⚡ phase-<N>-<phase-name-slug>` as the title pill. The fresh executor session loads checkpoint + spec + predecessor handoffs, enters plan mode for the remaining work, and proceeds normally. You return to the standard polling-and-gates flow.

**After Split:** the post-phase ✅ COMPLETE card renders for the now-completed (partial) phase, then the run-start-style card for the new auto-inserted phase. You approve to spawn it like any other phase. The renumbering is invisible day-to-day — `/phase-status` and `/phase-list` reflect the new sequence automatically.

**After View detail:** the menu re-renders. Pick a real action; no state has changed.

**After Abort:** §9.3 self-healing menu fires. Most common follow-through is a fix-phase. If the abort means the whole run is dead, `/phase-abort <run-id>` cleans up the run-level state separately.
