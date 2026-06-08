# Tier logic — FULL / LEAN / EMERGENCY selection

**Read when**: computing the tier at `/handoff` invocation, surfacing the 85% pre-write safety warning, or implementing the natural-break gate.

The tier controls section *depth*, never section *presence*. The 7-section core (per `references/core-shape.md`) is always present; tier governs how much each section spends on prose, sub-blocks, and trim-eligible material.

---

## 1. Tier table

| Tier | Context at invocation | Approximate write cost | Approximate output |
|---|---|---|---|
| FULL | <75% | 3–5% | 200–400 lines |
| LEAN | 75–84% | 1.5–2.5% | 100–150 lines |
| EMERGENCY | ≥85% | 0.5–1% | 40–70 lines |

**Note on the % values.** They are the **window-fraction**: the fraction of the full context window in use, read from the harness-native `context_window.used_percentage` (the same value the statusline already surfaces). They are NOT relative to a separate pressure baseline. With a 1M window plus native compaction, real pressure is far out, so the bands are intentionally generous.

The tier is computed from the context-percentage value the hook last injected (per `context-awareness.sh`'s `Context-awareness: ~<N>%` reminder). When the skill is invoked without recent hook injection (e.g., user typed `/handoff` cold), the skill computes context % itself by reading the transcript per the same logic the hook uses.

Mapping:

- `pct < 75` → FULL
- `75 ≤ pct < 85` → LEAN
- `pct ≥ 85` → EMERGENCY

Boundaries are inclusive on the lower end. A session at exactly 75% writes LEAN; at exactly 85% writes EMERGENCY.

---

## 2. Pre-write size estimate (the 85% safety check)

Before committing to a tier, the skill estimates the output size and checks whether the write itself will push the session past 85%. The procedure:

1. Compute (section depths × tier multiplier) → estimated output line count.
2. Convert to tokens via line-to-token heuristic (~10 tokens per markdown line average; conservative).
3. Add to current context tokens. Divide by the **full context window** (the same window-fraction denominator the hook uses — `context_window.used_percentage`). → post-write context %.
4. If post-write % > 85, surface a warning to the user with an AskUserQuestion offering downgrade tier.

The check matters most at the LEAN/EMERGENCY boundary: an 80%-context session asking for LEAN might land at 82% post-write — fine. An 83%-context session asking for FULL on a complex addendum-stacking handoff might land at 88% — dangerous (the write itself just created a context-pressure problem worse than the one it solved). Using the same window-fraction denominator as the hook keeps the user's mental model consistent across the two systems.

**85% safety warning (verbatim):**

```text
"This /handoff write at <tier> tier is estimated to push the session past 85% context (~<post-pct>%). After the write, very little headroom remains for finishing the current task — and the resume session will spend more loading the handoff than it would if you used a leaner tier. Continue at <tier>, or downgrade?"

Options:
  1. Downgrade to <next-tier-down> (Recommended) — smaller output, smaller post-write footprint.
  2. Continue at <tier> — write the full version anyway. Accept that the current session is effectively done after the write.
  3. Cancel — don't write a handoff; user will decide later.
```

If the user picks Continue, the skill writes at the requested tier. The session is treated as "context-spent" — any further work in this session is at the user's discretion.

---

## 3. Override rules

The user can force a tier with subcommand suffixes (the command surface is owned by P2):

- `/handoff lean` — force LEAN tier regardless of context %.
- `/handoff emergency` — force EMERGENCY tier regardless of context %.
- `/handoff full` — explicit FULL tier (implicit default if context < 75%, but available as an explicit form).
- `/handoff` — auto-select per the tier table.

A user-forced tier still triggers the 85% safety check; the warning surfaces but the user-chosen tier is the default option in the warning's AskUserQuestion (`Continue at <user-chosen-tier>` becomes Recommended).

Forcing EMERGENCY when context % is low (e.g., at 22%) is allowed — useful for sessions where the user wants a quick handoff because they're context-switching rather than because they're out of room. The 7-section core is always present; EMERGENCY just compresses the trim-eligible sections.

Forcing FULL when context % is high (e.g., at 83%) triggers the safety warning by definition.

---

## 4. Natural-break gate

Triggered by `/handoff` invocation when the skill detects mid-task signals. Signals include: an `[in_progress]` TaskList task, an in-flight `gh issue` or `gh pr` command, recent EditFile calls without a corresponding test/verification call.

When detected, the skill asks:

```text
"Currently mid-task: <one-line summary of the in-progress activity>. How to proceed?"

Options:
  1. Finish current task first, then /handoff (Recommended) — let the
     current work conclude; re-invoke /handoff after. The session keeps
     coherence; the handoff captures a clean state.
  2. Write handoff now, abandon current task (in-progress captured in §5) —
     forced write; the [in_progress] task is recorded in §5 TaskList
     snapshot and the resume session picks up from that exact spot.
  3. Cancel handoff — go back to the current task; user will re-invoke
     /handoff manually when ready.
```

Default: **option 1 (Recommended)**.

Option 2 writes immediately; the in-progress task is captured in §5 with its `[in_progress]` marker and description. The resume session sees it via `recreate-tasklist.sh` and continues exactly where the prior session left off — but the prior session's mid-task working memory (variable values, partial tool outputs, etc.) is lost. Picking option 2 is a trade: faster handoff, less continuity.

Option 3 is the bail-out. Used when the user realized the handoff was premature and would rather finish the in-progress work first without committing to a specific re-invocation time.

---

## 5. Why tier exists

Every line written into the handoff costs tokens both at write time (in the current session) and at read time (in the resume session). FULL/LEAN/EMERGENCY exists to make that trade-off explicit:

- **FULL** is the right default when you have headroom. The prior session's full context fits comfortably in the resume session.
- **LEAN** is the right default when context is tight but not critical. The resume session gets enough to continue without spending its own headroom on parsing prose.
- **EMERGENCY** is the right default when the write itself is the last meaningful action of the session. The 7-section core is present, decisions and world state survive, but everything trim-eligible is cut.

The 7-section core is non-negotiable at every tier. Trim is depth, not presence. See `references/core-shape.md` for which sub-blocks within each section are "NEVER trimmed".
