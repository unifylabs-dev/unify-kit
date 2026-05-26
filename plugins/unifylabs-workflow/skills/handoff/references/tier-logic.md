# Tier logic — FULL / LEAN / EMERGENCY selection

**Read when**: computing the tier at `/handoff` invocation, surfacing the 75% pre-write safety warning, or implementing the natural-break gate.

The tier controls section *depth*, never section *presence*. The 7-section core (per `references/core-shape.md`) is always present; tier governs how much each section spends on prose, sub-blocks, and trim-eligible material.

---

## 1. Tier table

| Tier | Context at invocation | Approximate write cost | Approximate output |
|---|---|---|---|
| FULL | <50% | 3–5% | 200–400 lines |
| LEAN | 50–64% | 1.5–2.5% | 100–150 lines |
| EMERGENCY | ≥65% | 0.5–1% | 40–70 lines |

**Note on the % values.** They are relative to the **pressure baseline** that `context-awareness.sh` uses (the absolute token count at which quality degradation is felt — typically 500k for Opus 4.7 1M and 150k for 200k-window models, env-overridable via `UNIFYLABS_PRESSURE_BASELINE_TOKENS`). They are NOT a fraction of the model's physical context window. This keeps the tier semantics calibrated to user-felt pressure regardless of which model is in use.

The tier is computed from the context-percentage value the hook last injected (per `context-awareness.sh`'s `Context-awareness: ~<N>%` reminder). When the skill is invoked without recent hook injection (e.g., user typed `/handoff` cold), the skill computes context % itself by reading the transcript per the same logic the hook uses.

Mapping:

- `pct < 50` → FULL
- `50 ≤ pct < 65` → LEAN
- `pct ≥ 65` → EMERGENCY

Boundaries are inclusive on the lower end. A session at exactly 50% writes LEAN; at exactly 65% writes EMERGENCY.

---

## 2. Pre-write size estimate (the 75% safety check)

Before committing to a tier, the skill estimates the output size and checks whether the write itself will push the session past 75%. The procedure:

1. Compute (section depths × tier multiplier) → estimated output line count.
2. Convert to tokens via line-to-token heuristic (~10 tokens per markdown line average; conservative).
3. Add to current context tokens. Divide by **pressure baseline** (the same denominator the hook uses — see `context-awareness.sh` header for the value). → post-write context %.
4. If post-write % > 75, surface a warning to the user with an AskUserQuestion offering downgrade tier.

The check matters most at the FULL/LEAN boundary: a 48%-context session asking for FULL might land at 53% post-write — fine. A 49%-context session asking for FULL on a complex addendum-stacking handoff might land at 78% — dangerous (the write itself just created a context-pressure problem worse than the one it solved). Using the same pressure-baseline denominator as the hook keeps the user's mental model consistent across the two systems.

**75% safety warning (verbatim):**

```text
"This /handoff write at <tier> tier is estimated to push the session past 75% context (~<post-pct>%). After the write, very little headroom remains for finishing the current task — and the resume session will spend more loading the handoff than it would if you used a leaner tier. Continue at <tier>, or downgrade?"

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
- `/handoff full` — explicit FULL tier (implicit default if context < 50%, but available as an explicit form).
- `/handoff` — auto-select per the tier table.

A user-forced tier still triggers the 75% safety check; the warning surfaces but the user-chosen tier is the default option in the warning's AskUserQuestion (`Continue at <user-chosen-tier>` becomes Recommended).

Forcing EMERGENCY when context % is low (e.g., at 22%) is allowed — useful for sessions where the user wants a quick handoff because they're context-switching rather than because they're out of room. The 7-section core is always present; EMERGENCY just compresses the trim-eligible sections.

Forcing FULL when context % is high (e.g., at 73%) triggers the safety warning by definition.

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
