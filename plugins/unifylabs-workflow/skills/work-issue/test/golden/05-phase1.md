## Phase 1: Issue Analysis

**Goal:** Understand the issue, validate it's workable, extract acceptance criteria.

```bash
gh issue view <N> --json title,body,labels,state,assignees,milestone
```

### Checks (stop if any fail):
- **Issue not found** → `"Issue #<N> not found. Check the number and try again."`
- **Issue is closed** → `"Issue #<N> is already closed. To reopen: gh issue reopen <N>"`
- **No acceptance criteria** → `"Issue #<N> has no clear acceptance criteria. Add an 'Acceptance Criteria' section with checkboxes before proceeding."`

### Extract:
1. **Title** and **description** — summarize in 2-3 sentences
2. **Acceptance Criteria (ACs)** — look for a section titled "Acceptance Criteria", checkbox lists (`- [ ]`), or numbered requirements. Each AC must be a testable statement. Separate behavioral ACs from visual fidelity ACs (under `### Visual Fidelity`).
3. **Type** — infer from labels: `bug` → fix, `enhancement`/`feature` → feature, otherwise → chore. If no labels, infer from title/body.
4. **Scope estimate** — S/M/L based on AC count and complexity
5. **Visual Specification** — look for a `## Visual Specification` section. If present, this contains binding visual constraints extracted from the prototype. Store it for Phase 3 and Phase 4.
6. **Prototype Branch** — look for a `## Prototype Branch` section. Extract the branch name — this is the source of truth for visual details via `git show`.

If the issue has visual ACs but no Visual Specification section, flag it:
```
⚠️ Issue has visual ACs but no Visual Specification section. Visual fidelity may be approximate.
Consider running /review-prototype again on the prototype branch to generate full visual specs.
```

### Present to user:

```
📋 Issue #<N>: <title>

Summary: <2-3 sentence summary>

Type: <feature|fix|chore|refactor>
Scope: <S|M|L>

Acceptance Criteria:
  Behavioral:
    1. <AC1>
    2. <AC2>
  Visual Fidelity:
    1. <Visual AC1>
    2. <Visual AC2>

Visual spec: <present with N component specs | absent — visual ACs only | none>
Prototype branch: <branch-name | not specified>

Proposed branch: <type>/<N>-<kebab-description>
```

**🚏 GATE 1 — STOP and wait for user confirmation.**
Show:
```
🚏 Phase 1 Complete: Issue Analysis

#<N> analyzed. <count> behavioral ACs + <count> visual ACs extracted. Type: <type>, Scope: <scope>.
Visual spec: <present | absent>. Prototype branch: <name | none>.

📋 Open Items:
  - ⚠️ <any concerns about ACs, ambiguity, or scope>
  (or "None — all clear.")

⏭️ Next: Phase 2 — Branch & Worktree (create isolated dev environment)
```

Then use `AskUserQuestion`:
- Question: "Phase 1 complete — how to proceed?"
- Header: "Phase 1"
- Options:
  1. **Continue to Phase 2 (Recommended)** — "Create branch and worktree. ACs look good."
  2. **Modify ACs** — "I want to add, remove, or change acceptance criteria before proceeding."
  3. **Change scope/type** — "Adjust the type (feature/fix/chore) or scope estimate (S/M/L)."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

