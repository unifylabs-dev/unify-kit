# §8.C — Brainstorm addendum

**Read when**: `detect-mode.sh` returns `mode: brainstorm`, or `brainstorm` appears in `secondary_modes`. Stacks on the 7-section core as §8 (if primary) or §9 (if secondary; see `SKILL.md` precedence).

Captures brainstorming-session state — the design-doc target, the options surveyed with verdicts, the visual artifacts referenced, and the `superpowers:brainstorming` checklist progress. Lossy without this addendum: a fresh session sees no record of which options were already rejected, leading to re-litigation.

---

## 8.C.1 Brainstorm phase

Which phase of the `superpowers:brainstorming` skill flow the session was in at handoff time.

**Template:**

```markdown
### 8.C.1 Brainstorm phase

- **Phase:** clarifying-questions | approaches-proposed | design-presenting | spec-writing
- **Time-in-phase:** <duration>
- **Next expected transition:** <next phase + what triggers it>
```

---

## 8.C.2 Design doc target

The artifact the brainstorm is producing (a design spec, ADR, etc.).

**Template:**

```markdown
### 8.C.2 Design doc target

- **Path:** <abs-path>
- **Status:** not-started | in-progress | first-draft-complete | reviewed | locked
- **Sections drafted:** <list, e.g., §1 Executive summary, §2 Problem statement>
- **Sections remaining:** <list, e.g., §6 Implementation, §10 Risks>
```

If no doc has been started yet (early brainstorm phases), `Path: <none yet>` is valid.

---

## 8.C.3 Options surveyed (NEVER trimmed at any tier)

The load-bearing sub-section for brainstorms. Each option considered during the session, its verdict, and the one-line why. **NEVER trimmed.**

**Template:**

```markdown
### 8.C.3 Options surveyed

| Option | Verdict | Why |
|---|---|---|
| <option A> | locked | <one-line why this won> |
| <option B> | rejected | <one-line why this lost> |
| <option C> | rejected | <one-line why> |
| <option D> | parking-lot | <reason for parking, not yet decided> |
```

Verdict enum: `locked` (this is the chosen approach) / `rejected` (do not re-propose) / `parking-lot` (set aside, may revisit).

Losing this table means the resume session re-proposes already-rejected options. That's the failure mode this addendum exists to prevent. **NEVER trimmed.**

---

## 8.C.4 Visual artifacts

Figma URLs, mockup paths, screenshot references, visual-companion browser session usage.

**Template:**

```markdown
### 8.C.4 Visual artifacts

- **Figma:** <URL with node-id> — <one-line: what it shows>
- **Mockup:** <abs-path> — <one-line>
- **Screenshot:** <abs-path> — <one-line>
- **Visual-companion browser session:** active at <URL> | not used
```

LEAN: keep URLs and one-line labels.
EMERGENCY: compress to URLs only (drop one-line labels).

---

## 8.C.5 Brainstorming-skill checklist state (NEVER trimmed at any tier)

The `superpowers:brainstorming` skill maintains an internal checklist. Captures progress per item.

**Template:**

```markdown
### 8.C.5 Brainstorming-skill checklist state

- ✓ <checklist item 1>
- ✓ <checklist item 2>
- ⏳ <checklist item 3 — in progress>
- ○ <checklist item 4>
- ○ <checklist item 5>
```

Glyph enum: ✓ done / ⏳ in progress / ○ pending. **NEVER trimmed** — the resume session uses this to know which brainstorming-skill prompts to skip.

---

## Tier notes

| Sub-section | FULL | LEAN | EMERGENCY |
|---|---|---|---|
| 8.C.1 Brainstorm phase | Full | Full | Full |
| 8.C.2 Design doc target | Full | Sections-remaining can be one line | Sections-remaining can be one line |
| 8.C.3 Options surveyed | Full (**NEVER trimmed**) | Full (**NEVER trimmed**) | Full (**NEVER trimmed**) |
| 8.C.4 Visual artifacts | Full | URLs + labels | URLs only |
| 8.C.5 Checklist state | Full (**NEVER trimmed**) | Full (**NEVER trimmed**) | Full (**NEVER trimmed**) |
