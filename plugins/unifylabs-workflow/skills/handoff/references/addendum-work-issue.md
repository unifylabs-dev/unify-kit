# §8.E — Work-issue addendum

**Read when**: `detect-mode.sh` returns `mode: work-issue`, or `work-issue` appears in `secondary_modes`. Stacks on the 7-section core as §8 (if primary) or §11 (if secondary; see `SKILL.md` precedence).

Captures the state of a `/work-issue <N>` session — the GitHub issue being worked, the branch, the 8 sub-phase progress, the TDD cycle position if mid-implementation, and the acceptance test results if mid-acceptance. The resume session uses this to re-enter the `/work-issue` flow at the right sub-phase without re-running earlier ones.

Cross-reference: the `work-issue` skill at `plugins/unifylabs-workflow/skills/work-issue/SKILL.md` owns the 8-sub-phase definition and the TDD enforcement. This addendum captures *state*, not policy.

---

## 8.E.1 Issue identity

Which issue, which branch, which base.

**Template:**

```markdown
### 8.E.1 Issue identity

- **Issue:** #<N> — <title>
- **URL:** <https://github.com/<org>/<repo>/issues/<N>>
- **Branch:** <branch-name, e.g., `feature/83-staff-management`>
- **Base:** <main | other base branch>
- **Linked PR (if any):** <#M or "none yet">
```

---

## 8.E.2 `/work-issue` 8-checkbox sub-phase progress

The 8 sub-phases of `/work-issue` per the skill's flow. One checkbox per sub-phase.

**Template:**

```markdown
### 8.E.2 /work-issue sub-phase progress

- [✓] Phase 0 — Spec Sync
- [✓] Phase 1 — Issue analysis
- [✓] Phase 2 — Branch creation
- [✓] Phase 3 — Planning
- [⏳] Phase 4 — TDD implementation (in progress; see §8.E.3)
- [○] Phase 5 — Verification
- [○] Phase 6 — Acceptance testing
- [○] Phase 7 — Review prep
- [○] Phase 8 — PR creation
```

Glyph enum: `[✓]` complete / `[⏳]` in progress (at most one) / `[○]` pending.

(Note: the skill's flow is documented as 8 sub-phases in `plugins/unifylabs-workflow/skills/work-issue/SKILL.md`; some renderings count Phase 0 as a separate "spec sync" gate making it 9 total. Use the canonical numbering from the skill at the time of handoff write.)

---

## 8.E.3 TDD state (conditional — only if currently in sub-phase 4)

TDD cycle position. Only present if the active sub-phase is Phase 4 (implementation). Otherwise this section is `_n/a — not in sub-phase 4._`.

**Template (when in sub-phase 4):**

```markdown
### 8.E.3 TDD state

- **Current cycle position:** red | green | refactor
- **Tests added this cycle:** <list, e.g., `tests/foo.test.ts::should_handle_X`>
- **Tests passing count:** <N> passing / <M> total (<percent>%)
- **Last failing test (if red):** <test name + one-line: what's expected vs actual>
- **Last GREEN attempt (if not yet green):** attempt <N> of 3 (per CLAUDE.md §5 "if GREEN fails 3 times, stop and ask")
```

---

## 8.E.4 Acceptance test results (conditional — only if currently in sub-phase 6)

Acceptance test summary. Only present if the active sub-phase is Phase 6.

**Template (when in sub-phase 6):**

```markdown
### 8.E.4 Acceptance test results

- **Suite run command:** <command>
- **Run-at timestamp:** <ISO>
- **Result:** PASS | FAIL | PARTIAL
- **Test summary:** <X passed / Y failed / Z skipped of W total>
- **Failures (if any):**
  - <test name> — <one-line: what failed>
  - <test name> — <one-line>
```

---

## 8.E.5 Cross-reference to work-issue skill

Pointer to the canonical skill that owns the flow definitions:

- **Skill path:** `plugins/unifylabs-workflow/skills/work-issue/SKILL.md`
- **Skill version (at time of handoff):** <semver or commit SHA of plugin>

Resume sessions consult this skill for sub-phase semantics (what each Phase X does, what triggers transitions, etc.). This addendum captures *which phase is active*; the skill captures *what that phase means*.

---

## Tier notes

| Sub-section | FULL | LEAN | EMERGENCY |
|---|---|---|---|
| 8.E.1 Issue identity | Full | Full | Full |
| 8.E.2 Sub-phase progress | Full checkboxes | Full checkboxes | Full checkboxes |
| 8.E.3 TDD state (conditional) | Full | Drop "tests added this cycle" list | Cycle position + counts only |
| 8.E.4 Acceptance results (conditional) | Full | Drop per-failure detail | Summary line only |
| 8.E.5 Cross-reference | Full | Full | Skill path only |
