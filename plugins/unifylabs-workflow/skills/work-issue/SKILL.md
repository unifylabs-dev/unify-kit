---
name: work-issue
description: >
  Orchestrates GitHub issue-driven development with 8 gated phases: issue analysis,
  branch creation, planning, strict TDD implementation, verification, automated
  acceptance testing, review, and PR creation. Use when the user says "/work-issue 83",
  "work on issue 83", "pick up issue 83", or wants to start working on a GitHub issue.
  Also use when the user mentions working from GitHub issues, linking branches to
  issues, or issue-driven development.
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Agent
  - EnterPlanMode
  - ExitPlanMode
  - WebSearch
  - mcp__plugin_playwright_playwright__browser_navigate
  - mcp__plugin_playwright_playwright__browser_snapshot
  - mcp__plugin_playwright_playwright__browser_click
  - mcp__plugin_playwright_playwright__browser_fill_form
  - mcp__plugin_playwright_playwright__browser_wait_for
  - mcp__plugin_playwright_playwright__browser_take_screenshot
  - mcp__plugin_playwright_playwright__browser_close
---

# Work Issue — GitHub Issue-Driven Development

Orchestrate the full lifecycle of a GitHub issue: analysis → branch → plan → TDD implementation → verification → automated acceptance testing → review → PR.

**Invocation:** `/work-issue 83` (single issue) or `/work-issue 83 91 145` (batch — process sequentially)

**Optional flags** (single-issue mode only):
- `--phase` — force phased-execution for the implementation portion (Phase 4). Skips auto-detection.
- `--no-phase` — skip phasing entirely. Runs Phase 4 as TDD regardless of plan size.
- (no flag) — runs conservative auto-detection at Phase 3.5; phasing only if both quantitative + self-assessment gates agree.

Example: `/work-issue 83 --phase`

## Instructions

When invoked, extract the issue number(s) from the argument string. If multiple numbers are provided, process them one at a time in order. For each issue, execute the 8 phases below **in strict sequence**, stopping at each gate for user approval.

### Gate Prompt Convention

At every gate, use `AskUserQuestion` to present structured options instead of free text. This lets the user press Enter to continue (the default), or pick an alternative action. Each gate's options are tailored to the phase, but the pattern is always:
- **Option 1** = Continue to next phase (Recommended) — always the default
- **Options 2-3** = Phase-appropriate alternatives (e.g., review diff, modify ACs, skip phase)
- **Option 4** = Abort workflow
- The user can always select "Other" (built into AskUserQuestion) for free-text feedback

Never use a plain text question like "Continue?" — always use `AskUserQuestion` with options.

**IMPORTANT — Always provide next steps:** When implementation and verification are complete (whether via the full 7-phase flow or a partial run), you MUST present:
1. **What you verified** — list every automated check you ran and its result (tests, tsc, build)
2. **Manual testing steps** — concrete, step-by-step instructions for the user to verify the feature themselves (e.g., "Open the app, navigate to X, click Y, confirm Z happens"). Cover happy path + key edge cases from the ACs.
3. **Merge process** — the standard merge checklist

Never end a work-issue session without giving the user clear manual testing instructions.

If the user says "stop" or "abort" at any point, halt immediately and print:
```
⛔ Aborted. Current state:
- Branch: <branch-name>
- Worktree: <worktree-path>
- Changes: <committed/uncommitted>
- To clean up:
    cd <main-repo-path>
    git worktree remove <worktree-path>
    git branch -D <branch-name>
    git branch --show-current  # verify → master
```

---

## Master Branch Protection (NON-NEGOTIABLE)

The main working directory must **ALWAYS** remain checked out on `master`. All feature work happens exclusively in worktrees under `.worktrees/`.

**NEVER run `git checkout <branch>` in the main repo.** Use worktrees instead.

This is critical because the user runs multiple terminals and branches simultaneously — switching branches in the main repo breaks every other terminal's working state.

---

## Pre-flight Check (runs before Phase 1)

Before starting any work, verify the environment is safe:

```bash
# 1. Detect if we're already inside a worktree
TOPLEVEL=$(git rev-parse --show-toplevel)
COMMON_DIR=$(git rev-parse --git-common-dir)
if [ "$COMMON_DIR" != ".git" ] && [ "$COMMON_DIR" != "$(git rev-parse --git-dir)" ]; then
  echo "⚠️ You are inside a worktree ($TOPLEVEL). Please cd to the main repo first."
  # STOP — ask user to cd to the main repo
fi

# 2. Verify master is checked out in the main repo
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "⚠️ Main repo is on '$CURRENT_BRANCH', not master. Switching back."
  git checkout master
fi

# 3. Pull latest master
git pull origin master
```

If the pre-flight detects a non-master branch, switch back to master automatically and warn the user. If inside a worktree, stop and ask the user to navigate to the main repo.

---

## Phase 0: Spec Sync

**Goal:** Read the issue's "Spec sections affected" field, read existing module/journey specs for the listed paths, identify which spec sections need to change to satisfy the AC, and lock the spec deltas before any code work begins.

This phase exists to ground every new feature in the durable specification layer at `docs/specs/`. See `docs/methodology.md` for the full SDD + BDD-Lite + TDD methodology. Phase 0 runs against the main repo (the worktree doesn't exist yet); the identified spec deltas become the FIRST commits in Phase 4 once the worktree is created in Phase 2.

### Steps:

1. **Fetch issue body:**
   ```bash
   gh issue view <N> --json body --jq '.body'
   ```

2. **Extract "Spec sections affected" field.** Look for a section with that label (the issue templates make it required). Possible values:
   - One or more `docs/specs/modules/<x>.md` paths (with optional section anchors, e.g. `(Behavior §QC verification)`)
   - One or more `docs/specs/journeys/<slug>.md` paths
   - `NEW: <module-name>` for a brand-new module that has no spec yet
   - `None — fixing drift from spec` for pure drift fixes (code drifted from documented behavior; spec is correct)
   - `None — no behavior change` for pure docs/config/typo PRs

3. **Read existing specs** for every listed module / journey. If a listed spec doesn't exist yet (`NEW:` sentinel or path missing on disk), **bootstrap it from current code**:
   - Read relevant `src/lib/actions/<x>.ts`, `src/app/<route>/`, and Prisma schema fields for the module
   - Write the initial module spec following `docs/specs/modules/_template.md`
   - Aim for 200–500 lines, behavior-focused (no quoted Zod schemas, no copied function signatures — link only)

4. **Identify spec deltas** required to satisfy the issue's Acceptance Criteria. List them in this shape:
   ```
   - docs/specs/modules/orders.md
       § Behavior: add rule "When isDualInvoice = true, …"
       § Edge Cases: add rule for null lensType handling
   - docs/specs/journeys/order-fulfillment-lifecycle.md
       § Steps: add step 6 "Given QC fails, When optician marks failed, Then …"
   ```

4a. **Cross-check spec deltas against project non-negotiables in CLAUDE.md.** Before surfacing the deltas, scan each one against the rules every mutating action / public route / data model change must respect. A spec that contradicts these creates a real bug at PR-review time (see retro 2026-05). Run through this checklist:
   - **Audit logging** — every mutating action calls `void logAudit({ ... })`. A spec rule that says "no audit log entry" is almost always wrong; PHIPA s. 12 needs a forensic record of destruction even for bulk/automated paths. If the new behavior writes/deletes/anonymizes, the spec must describe what it audits.
   - **Auth guards** — `verifySession()` / `verifyRole("STAFF")` / `verifyRole("ADMIN")` at the top of every Server Component and Server Action. Cron routes use `verifyCronSecret`. A spec rule that lets an action run without one of these is wrong unless the route is explicitly public.
   - **PHIPA & retention** — no PHI in logs, retention windows documented (don't say "kept indefinitely"), role hierarchy enforced for any access. Specs adding new persistent data must specify the retention rule.
   - **Public endpoints** — every public lookup/auth path uses `checkRateLimit` + `timingSafeDelay` + identical found/not-found response shape (anti-enumeration). Any new public route also adds its prefix to `PUBLIC_PATHS` or `CLIENT_PUBLIC_PATHS` in `src/middleware.ts`.
   - **Server Action contract** — actions return `{ error }` or `{ fieldErrors }`, never throw; `NEXT_REDIRECT` is re-thrown after `redirect()`.

   If a delta would create a contradiction with any of these, amend the delta (or surface the contradiction to the user with a recommended fix) before locking. This is a 30–60 second pass; skipping it costs a full PR-review iteration.

5. **Surface to user** via `AskUserQuestion`: present the identified deltas + bootstrapped specs (if any) for review.

6. **Lock the spec deltas.** They become the FIRST commits in Phase 4 (before any code), per the `Specification Discipline` rules in CLAUDE.md.

### Skip rules:

- **Drift fix** (`None — fixing drift from spec`): Phase 0 still reads the relevant spec to confirm the fix realigns code-to-spec, but no spec changes are produced. The PR template's drift-fix checkbox handles the assertion.
- **Pure docs/config** (`None — no behavior change`): Phase 0 is a no-op. Move directly to Phase 1.
- **Empty `Spec sections affected`** (template not followed): flag and ask the user to populate the field before proceeding.

**🚏 GATE 0 — STOP and confirm spec deltas.**
Show:
```
🚏 Phase 0 Complete: Spec Sync

<count> spec(s) read. <count> bootstrapped from current code. <count> deltas identified.

Spec deltas (locked, will be first commits in Phase 4):
  • docs/specs/modules/<x>.md — <change summary>
  • docs/specs/journeys/<slug>.md — <change summary>

📋 Open Items:
  - ⚠️ <any ambiguity in the deltas, missing module specs, or scope concerns>
  (or "None — all clear.")

⏭️ Next: Phase 1 — Issue Analysis (extract ACs, type, scope, visual spec)
```

Then use `AskUserQuestion`:
- Question: "Phase 0 complete — how to proceed?"
- Header: "Phase 0"
- Options:
  1. **Continue to Phase 1 (Recommended)** — "Spec deltas approved. Proceed to issue analysis."
  2. **Modify deltas** — "I want to revise the spec changes before proceeding."
  3. **Bootstrap a new spec first** — "Found a module that needs its initial spec written before deltas are clear."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

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

## Phase 2: Branch & Worktree Creation

**Goal:** Create a development branch in an isolated git worktree so multiple terminals can work on different issues simultaneously.

### Branch naming convention:
```
<type>/<issue-number>-<kebab-description>
```
- `type`: feature, fix, chore, refactor (from Phase 1)
- `description`: 3-5 words from issue title, kebab-case

### Why worktrees:
Each Claude Code terminal in VS Code shares the same filesystem. Using `git checkout` in one terminal changes the branch for ALL terminals. Worktrees create isolated directories — each terminal works independently.

### Check for existing branch:
```bash
git branch --list "*/<N>-*"
git worktree list
```

If branch exists as a worktree already, present options:
1. Use it: `cd <existing-worktree-path>` (resume work)
2. Remove and recreate: `git worktree remove <path> && git branch -D <branch> && ...`
3. Abort

If branch exists but has no worktree, present options:
1. Create a worktree for it: `git worktree add .worktrees/<branch-name> <branch-name>`
2. Delete and recreate: `git branch -D <branch> && ...`
3. Abort

### Ensure .worktrees is gitignored:
```bash
git check-ignore -q .worktrees 2>/dev/null
```
If NOT ignored, add it before proceeding:
```bash
echo ".worktrees" >> .gitignore
git add .gitignore
git commit -m "chore: add .worktrees to gitignore

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Create worktree:
```bash
# Master is already checked out and up-to-date (verified by pre-flight check)
# Create branch + worktree in one step — NEVER checkout a branch in the main repo
git worktree add .worktrees/<type>-<N>-<kebab-description> -b <type>/<N>-<kebab-description>
```

### Set working directory:
**CRITICAL:** After creating the worktree, `cd` into it. ALL subsequent commands for this issue must run from inside the worktree directory.
```bash
cd .worktrees/<type>-<N>-<kebab-description>
```

### Install dependencies:
```bash
npm install
```

### Verify clean baseline:
```bash
npm run test:run
```
If tests fail, report failures and ask user before proceeding.

**🚏 GATE 2 — STOP and confirm worktree created.**
Show:
```
🚏 Phase 2 Complete: Branch & Worktree

Branch created at <absolute-worktree-path>. Baseline: <N> tests passed.

All subsequent work for issue #<N> happens in this directory.
Other terminals remain unaffected on their own branches.

📋 Open Items:
  - ⚠️ <any baseline test warnings or dependency issues>
  (or "None — all clear.")

⏭️ Next: Phase 3 — Planning (explore codebase, map ACs to files)
```

Then use `AskUserQuestion`:
- Question: "Phase 2 complete — how to proceed?"
- Header: "Phase 2"
- Options:
  1. **Continue to Phase 3 (Recommended)** — "Start exploring the codebase and creating the implementation plan."
  2. **Verify baseline** — "Show me the test output or dependency details before proceeding."
  3. **Rename branch** — "I want a different branch name before we start planning."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

## Phase 3: Planning

**Goal:** Explore the codebase, create an implementation plan mapped to ACs.

### Enter Plan Mode

Use `EnterPlanMode` before doing any exploration or planning work. Plan mode gives you structured thinking space to reason through the architecture, weigh tradeoffs, and produce a higher-quality plan — especially important for M/L scope issues. Stay in plan mode throughout the exploration and plan formulation steps below, then exit once the plan is finalized and ready to present.

### Explore (in plan mode):
1. Read CLAUDE.md for project conventions
2. Search for files related to each AC — issue multiple `Glob` and `Grep` calls in a single turn. Read related files in parallel. Minimize round-trips.
3. Read key files to understand existing patterns
4. Check existing tests for the area being modified
5. If the domain is unfamiliar, use `WebSearch` or docs tools to research best practices before committing to an approach
6. **Read prototype source files** — If the issue references a prototype branch:
   ```bash
   git fetch origin
   git show origin/<prototype-branch>:<path-to-file>
   ```
   Read every prototype UI file listed in the "Prototype Source Reference" table. These are the visual ground truth. Study the layout, spacing, colors, and component hierarchy.
7. **Map visual specs to implementation files** — For each component in the Visual Specification:
   - Identify which production file will implement it (may be the same path or a refactored path)
   - Note if component boundaries change (one prototype file → multiple production files) — document which production file owns which visual elements
   - Verify that prototype Tailwind classes are compatible with the project's `tailwind.config.ts` and `globals.css`. Flag any classes that reference colors or tokens not in the theme.

### Formulate plan (in plan mode) with:
- **Files to create/modify** — with purpose for each
- **AC mapping** — which files satisfy which AC (both behavioral and visual)
- **Visual Fidelity Plan** (if prototype exists) — table mapping visual ACs → prototype files → production files
- **Test plan** — test file locations, what to test per AC
- **Risks** — breaking changes, migration needs, edge cases
- **Order of implementation** — which AC to tackle first

### Exit plan mode and present plan to user (structured format).

### Post Milestone Comment 1 to issue:
```bash
gh issue comment <N> --body "$(cat <<'EOF'
## 🤖 Implementation Plan

**Branch:** `<branch-name>`

### Acceptance Criteria
- [ ] AC1
- [ ] AC2
- [ ] AC3

### Files
| File | Action | Purpose |
|------|--------|---------|
| `path/file.ts` | Create | ... |
| `path/file.ts` | Modify | ... |

### Test Plan
- `src/__tests__/actions/<entity>.test.ts` — N tests covering ...

### Risks
- <risk 1>

### Visual Fidelity Plan
<!-- Include only if prototype branch exists -->
| Visual AC | Prototype File | Production File | Notes |
|-----------|---------------|-----------------|-------|
| Layout: <classes> | `src/...` | `src/...` | Same structure |
| Card: <classes> | `src/...` | `src/...` | Split into sub-components |

**Prototype branch:** `<prototype-branch>` — use `git show origin/<branch>:<file>` for visual reference.
EOF
)"
```

**🚏 GATE 3 — STOP and wait for user to approve the plan.**
Show:
```
🚏 Phase 3 Complete: Planning

Plan posted to issue #<N>. <count> files mapped across <count> ACs. <count> risks identified.

📋 Open Items:
  - ⚠️ <any risks, ambiguities, or trade-offs worth discussing>
  (or "None — all clear.")

⏭️ Next: Phase 4 — Implementation (strict TDD: RED → GREEN → REFACTOR)
```

Then use `AskUserQuestion`:
- Question: "Phase 3 complete — how to proceed?"
- Header: "Phase 3"
- Options:
  1. **Continue to Phase 4 (Recommended)** — "Plan approved. Begin TDD implementation."
  2. **Revise plan** — "I want to change the approach, file list, or implementation order."
  3. **Re-explore** — "Go back to plan mode and investigate a specific area more deeply."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

## Phase 3.5: Phasing Decision

**Goal:** Decide whether to delegate implementation to the `phased-execution` skill, or run Phase 4 (TDD) as normal.

This phase is short. It exists because some issues are large enough that running Phase 4 as a single TDD pass risks context rot, context bleed, or hallucinations. **With a 1M context window + native compaction, that bar is now high** — a single session absorbs most one-issue work without degradation, so phasing is reserved for genuinely large or cross-cutting issues. For those, `phased-execution` decomposes the plan into a master plan + per-phase specs, orchestrates dispatch (subagent default, session escalation for high-blast-radius phases), and enforces mandatory verification per phase. For everything else the overhead isn't worth it — **when in doubt, don't phase.**

### Flag handling

- `--phase` → force `phased-execution`. Skip detection.
- `--no-phase` → skip detection, go straight to Phase 4 (TDD).
- (no flag) → run conservative auto-detection.

### Detection (auto mode only)

Apply the hybrid-conservative gate from the `phased-execution` skill:
1. **Quantitative gate (any one):** the Phase 3 plan touches >8 files, OR spans >2 subsystems, OR has >12 task bullets, OR explicitly uses "phase" / "milestone" / "step 1 / step 2" language.
2. **Self-assessment (≥2 of 4 yes):** Does this work need cross-cutting decisions made early? Are there natural break points where re-grounding on the predecessor's output would help? Would the executor's context likely grow unmanageable mid-execution? Would a downstream step benefit from re-grounding?

**Both gates must fire** to propose phasing. Otherwise proceed to Phase 4 (TDD). Lean toward NOT phasing: with a 1M window + compaction, single-pass TDD is viable for the large majority of single-issue work, so only propose phasing when the issue is genuinely large or cross-cutting.

If proposing:
> "This issue's plan looks substantial (touches X files across Y subsystems). Phase the implementation? (y / n)"

User accepts → phased-execution. User declines → Phase 4 (TDD).

### Invoking phased-execution

When taking the phased path:

1. **Determine the run-id.** Format: `issue-<N>-<kebab-description>` (e.g., `issue-83-auth-refactor`). This makes it easy to find the run later.

2. **Write caller context** to `<worktree-root>/.claude/phases/<run-id>/context/issue.md`:

   ```markdown
   # Caller context: work-issue (issue #<N>)

   ## Issue
   - Number: <N>
   - Title: <title>
   - URL: https://github.com/<org>/<repo>/issues/<N>
   - Branch: <type>/<N>-<kebab-description>

   ## Description
   <issue body>

   ## Acceptance Criteria
   ### Behavioral
   - [ ] AC1
   - [ ] AC2

   ### Visual Fidelity
   - [ ] Visual AC1
   - [ ] Visual AC2

   ## Visual Specification
   <verbatim Visual Specification section if present, otherwise "(none)">

   ## Prototype Branch
   <branch name if present, otherwise "(none)">

   ## Phase 3 implementation plan
   <verbatim plan from Phase 3 — files, AC mapping, test plan, risks, etc.>
   ```

3. **Invoke `phased-execution`** with the run-id. It will:
   - Read `context/issue.md` as required reading on every phase
   - Decompose the Phase 3 plan into a master plan + per-phase specs (3–7 phases)
   - Present the master plan for user approval (with per-phase `execution_mode` override)
   - Orchestrate phase dispatch — subagent or session per recommendation
   - Enforce mandatory verification per phase (TDD `command` for code phases; `check` / `review` / `user_gate` for non-code)
   - Surface memory candidates at run completion

4. **Wait for return.** Background-poll `<worktree>/.claude/phases/<run-id>/run.json` for `overall_status: complete | failed | aborted`. While waiting, you can chat with the user about other things.

5. **On `complete`:** read the final phase's handoff and aggregate deliverables from all phase handoffs. **Resume at Phase 5 (Verification)** — the work-issue verification suite runs against the combined output.

6. **On `failed` or `aborted`:** surface in this terminal. Offer:
   - Re-run from a checkpoint via `/phase-resume <run-id>`
   - Fix the issue manually then re-run
   - Abort the entire work-issue workflow (cleanup per the Abort section at top)

### Skipping phasing

Default for small issues, when `--no-phase` is set, or when user declines the suggestion — proceed to Phase 4 (TDD) unchanged.

**🚏 GATE 3.5 — STOP and confirm path forward.**

If phasing:
```
🚏 Phase 3.5 Complete: Phasing Decision

phased-execution will run for the implementation portion.
Run-id: issue-<N>-<kebab-description>
Context written: .claude/phases/<run-id>/context/issue.md

work-issue resumes at Phase 5 (Verification) once phased-execution completes.

⏭️ Next: phased-execution master-plan generation (separate flow)
```

If skipping:
```
🚏 Phase 3.5 Complete: Phasing Decision

No phasing — proceeding with single TDD implementation.

⏭️ Next: Phase 4 — Implementation (Strict TDD)
```

Then use `AskUserQuestion`:
- Question: "Phase 3.5 complete — proceed?"
- Header: "Phase 3.5"
- Options:
  1. **Continue (Recommended)** — "Proceed with the chosen path."
  2. **Switch path** — "Flip between phased / TDD before continuing."
  3. **Abort** — "Stop the workflow. Print cleanup instructions."

---

## Phase 4: Implementation (Strict TDD)

**Note:** This phase runs only when Phase 3.5 chose the TDD path. If `phased-execution` was invoked at Phase 3.5, this phase is skipped — work-issue resumes at Phase 5 once phased-execution completes.

**Goal:** Implement each AC using strict TDD: RED → GREEN → REFACTOR.

### Pre-implementation planning

Use `EnterPlanMode` before writing any code. Think through:
- The TDD approach for each AC — what tests to write, what assertions matter
- Dependencies between ACs — which order minimizes rework
- Shared setup or mocks needed across tests
- Any tricky integration points between ACs
- **Read all prototype UI files first** (if prototype branch exists). Before writing a single line of implementation code:
  ```bash
  git show origin/<prototype-branch>:<path>
  ```
  Study the visual structure. Internalize the layout, spacing, colors, and component hierarchy. The prototype author made deliberate visual choices — your job is to reproduce them exactly while adding production quality (auth, validation, error handling, tests).

Exit plan mode once you have a clear mental model, then begin the TDD cycles.

### Rules:
1. **Process one AC at a time.** Do not start the next AC until the current one is complete.
2. **Never modify existing passing tests** to make new code work. If existing tests break, fix the implementation — not the tests.
3. **If the GREEN phase fails 3 times** for a single AC, stop and ask the user for guidance.
4. **Follow project conventions** from CLAUDE.md exactly (Server Actions return `{ error }`, Zod validation, `verifySession()`/`verifyRole()`, etc.)
5. **Visual fidelity is non-negotiable** (when prototype branch exists). For UI components:
   a. Read the prototype source (`git show origin/<prototype-branch>:<file>`) BEFORE writing any component
   b. Copy Tailwind classes from the prototype verbatim unless the Visual Specification notes a required conversion (e.g., inline style → Tailwind)
   c. If you need to change a visual detail for production reasons (responsive behavior, accessibility), document the deviation in the commit message
   d. Every component's className string must be traceable to either the prototype source or the project's established patterns in CLAUDE.md
   e. For dynamic content replacing hardcoded prototype data: the container/wrapper classes must stay identical; only the content inside changes

### For each AC:

Before each AC's first test, briefly state **why this test matters** and what could go wrong if this behavior were untested. This grounds each test in a real risk, not just coverage.

Follow the **Arrange-Act-Assert** pattern in every test. Name tests: `"should <expected behavior> when <condition>"`.

#### RED — Write Failing Test
```bash
# Write test first
# Run it to confirm it fails
npm run test:run -- --reporter=verbose <test-file>
```
Show: "🔴 RED: Test `<test-name>` fails as expected."

#### GREEN — Minimal Implementation
Write the minimum code to make the test pass. No extras, no refactoring yet.
```bash
npm run test:run -- --reporter=verbose <test-file>
```
Show: "🟢 GREEN: Test `<test-name>` passes."

If the test still fails after implementation, iterate on the **implementation** (not the test). Track attempts:
- Attempt 1: adjust implementation
- Attempt 2: adjust implementation differently
- Attempt 2 failure: Use `EnterPlanMode` to diagnose the root cause — read the error, re-examine the test expectations and implementation, reason about what's actually wrong before making a third attempt. Exit plan mode, then try again.
- Attempt 3: STOP — ask user for help

#### REFACTOR
Clean up the implementation while keeping tests green. Run tests again to confirm.

#### VISUAL CHECK (for UI ACs only, when prototype branch exists)
After GREEN + REFACTOR, before moving to the next AC, verify visual fidelity:
```bash
# Read the prototype version of this component
git show origin/<prototype-branch>:<path-to-component>
```
Compare your implementation's Tailwind classes against the prototype's:
- Layout structure matches (grid/flex, columns, direction)
- Spacing matches (padding, margin, gap values)
- Colors match (bg-*, text-*, border-* classes)
- Typography matches (text-*, font-* classes)
- Border/shadow/rounding matches
- Interactive state classes match (hover, disabled, focus)

If any differ without documented justification, fix before proceeding to the next AC.

### E2E Test Categorization

When writing new e2e tests, tag `@daily` in the `test.describe()` name if the test is read-only (no DB writes) and covers a critical user path (auth, navigation, list pages, route guards). Leave untagged for nightly-only tests (CRUD, wizards, journeys, form submissions). Every new e2e file must have a conscious tier decision documented in the PR.

### After all ACs implemented:

Show progress checklist:
```
✅ AC1: <description> — 3 tests
✅ AC2: <description> — 2 tests
✅ AC3: <description> — 4 tests
Total: 9 new tests
```

### Post Milestone Comment 2 to issue:
```bash
gh issue comment <N> --body "$(cat <<'EOF'
## 🤖 Implementation Complete

### AC Status
- ✅ AC1: <description>
- ✅ AC2: <description>
- ✅ AC3: <description>

### Design Decisions
<!-- List any non-obvious choices, or "None — straightforward implementation." -->

### Stats
- **New tests:** N
- **Files created:** N
- **Files modified:** N
EOF
)"
```

**🚏 GATE 4 — STOP and wait for user to review implementation.**
Show:
```
🚏 Phase 4 Complete: Implementation

All <count> ACs implemented. <count> new tests passing.

📋 Open Items:
  - ⚠️ <any design decisions, compromises, or areas needing extra review>
  (or "None — all clear.")

⏭️ Next: Phase 5 — Verification (tests, types, build, scope guard)
```

Then use `AskUserQuestion`:
- Question: "Phase 4 complete — how to proceed?"
- Header: "Phase 4"
- Options:
  1. **Continue to Phase 5 (Recommended)** — "Run full verification suite (tests, tsc, build, scope guard)."
  2. **Show diff** — "Show me the full diff of changes before running verification."
  3. **Revisit an AC** — "I want to change the implementation of a specific acceptance criterion."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

## Phase 5: Verification

**Goal:** Full verification suite — tests, types, build, scope guard.

### Enter Plan Mode

Use `EnterPlanMode` before running any checks. Think through:
- Which areas are most at risk from the changes made
- Whether integration points (DB, auth, APIs) need special attention
- Optimal verification order: targeted tests first (fast feedback), then full suite, then tsc, then build
- What failure modes to anticipate and how you'd diagnose them

Exit plan mode, then execute the checks below.

### Run checks (in order):
```bash
# 1. Targeted tests — fast signal on the files you changed
npm run test:run -- --reporter=verbose <test-file(s)-for-this-issue>

# 2. Full test suite (NOT test:ci — CI runs a subset for speed,
#    but before PR creation we verify everything passes)
npm run test:run

# 3. Type check
npx tsc --noEmit

# 4. Production build
npm run build
```

### Scope Guard:
```bash
# Get all changed files
git diff --name-only master..HEAD
```

For each changed file, verify it maps to at least one AC. Flag any file that doesn't with:
```
⚠️ Scope warning: <file> was modified but doesn't map to any AC. Justify or revert.
```

### Modified Test Check:
```bash
# Check if any pre-existing test files were modified
git diff --name-only master..HEAD -- 'src/__tests__/'
```

If existing test files were modified (not just new files created), flag each one:
```
⚠️ Existing test modified: <file> — verify this was necessary and didn't weaken coverage.
```

### Present results:
```
Verification Results:
  ✅ Tests: N passed, 0 failed
  ✅ TypeScript: no errors
  ✅ Build: successful
  ✅ Scope: all files map to ACs
  ⚠️ Modified tests: <list or "none">
```

### On failure:

If any check fails, use `EnterPlanMode` to analyze the root cause before attempting a fix:
- Read the error output carefully
- Trace the failure to a specific change you made
- Determine whether this is a code bug, a type error, a test environment issue, or a scope problem
- Plan the minimal fix

Exit plan mode, apply the fix, and re-run the failing check.

Stop after 3 failed fix attempts and ask the user for guidance.

**🚏 GATE 5 — STOP and show verification results.**
Show:
```
🚏 Phase 5 Complete: Verification

Tests/tsc/build/scope all passed.

📋 Open Items:
  - ⚠️ <any modified tests, scope warnings, or flaky results>
  (or "None — all clear.")

⏭️ Next: Phase 5.5 — Automated Acceptance Testing
```

Then use `AskUserQuestion`:
- Question: "Phase 5 complete — how to proceed?"
- Header: "Phase 5"
- Options:
  1. **Continue to Phase 5.5 (Recommended)** — "Run automated acceptance tests for each AC."
  2. **Show verification details** — "Show me the full test output, tsc output, or build log."
  3. **Skip to Phase 6** — "Skip acceptance testing and go straight to review prep."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

## Phase 5.5: Automated Acceptance Testing

**Goal:** Verify each acceptance criterion end-to-end using the right tool for the change type — browser testing for UI, DB queries for data/seed changes, curl for APIs.

### Classify each AC

For each AC, determine the verification type:

| Type | Signal | Tool |
|------|--------|------|
| **UI** | New/changed pages, components, visual behavior | Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_wait_for`) |
| **Visual** | Visual Fidelity ACs, layout/styling requirements | Playwright MCP (`browser_navigate`, `browser_take_screenshot`, `browser_snapshot`) + prototype source comparison via `git show` |
| **Data/Seed** | DB schema, seed scripts, migrations | `node` + `pg` queries via Bash (use project's pooler connection from MEMORY.md) |
| **API** | New/changed API routes | `curl` via Bash |
| **Logic-only** | Pure functions, utils, validations | Skip — already unit tested in Phase 5 |

### Dev server (if needed)

If any AC is UI or API type, start the dev server before testing:
```bash
npm run dev &
# Wait for server to be ready
sleep 5
```

### Execute tests

For each non-logic AC, run the appropriate verification:

**UI changes** — use Playwright MCP tools:
1. `browser_navigate` to the relevant page (use `http://localhost:3000/...`)
2. `browser_snapshot` to capture the current state
3. Interact as needed (`browser_click`, `browser_fill_form`)
4. `browser_wait_for` for async content
5. Verify expected elements/text appear in the snapshot

**Data/seed changes** — use node+pg via Bash:
```bash
node -e "
const {Pool} = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});
pool.query('<verification SQL>').then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  pool.end();
});
"
```

**API changes** — use curl via Bash:
```bash
curl -s http://localhost:3000/api/<endpoint> | jq .
```

**Visual Fidelity verification** (for Visual Fidelity ACs, when prototype branch exists):

1. Navigate to each page that has visual ACs:
   ```
   browser_navigate to http://localhost:3000/<route>
   ```
2. Take a screenshot and snapshot:
   ```
   browser_take_screenshot (full page)
   browser_snapshot
   ```
3. Read the prototype source for comparison:
   ```bash
   git show origin/<prototype-branch>:<path-to-page-or-component>
   ```
4. For each visual AC, verify in the snapshot/screenshot:
   - **Layout**: page structure matches (grid columns, flex direction, sidebar presence)
   - **Spacing**: cards/sections spaced consistently with prototype's gap/padding values
   - **Typography**: headings, body text, labels match specified text-*/font-* classes
   - **Colors**: backgrounds, text colors, borders match spec
   - **Components**: cards, badges, buttons match specified styling
   - **Icons**: correct icons from correct library at correct size
   - **Empty states**: navigate to a state with no data — verify empty state matches
5. For interactive states, test each:
   ```
   browser_click to open modals/dropdowns
   browser_snapshot after each interaction
   ```
   Compare each state against the prototype's documented interactive states.
6. **If any visual AC fails**: fix the implementation before proceeding. Read the prototype source again, identify the exact classes needed, update the production component, and re-verify.

### Report results

Present a summary table:

```
Acceptance Testing Results:
| AC | Type | Tool | Result | Visual Match |
|----|------|------|--------|-------------|
| AC1: <desc> | UI | Playwright | PASS | N/A |
| AC2: <desc> | Visual | Playwright + git show | PASS | EXACT |
| AC3: <desc> | Data | node+pg | PASS | N/A |
| AC4: <desc> | Visual | Playwright + git show | FIXED | Was missing shadow-sm |
```

### E2E Tier Check

After writing any e2e tests, verify `@daily` tests pass under `npm run test:e2e:daily` and confirm untagged tests are excluded from daily runs.

### Clean up

If you started a dev server, stop it:
```bash
kill %1 2>/dev/null
```

**🚏 GATE 5.5 — STOP and show acceptance test results.**
Show:
```
🚏 Phase 5.5 Complete: Automated Acceptance Testing

<count> ACs tested end-to-end. <count> passed, <count> skipped (logic-only).

📋 Open Items:
  - ⚠️ <any failures or unexpected behavior>
  (or "None — all clear.")

⏭️ Next: Phase 6 — Review Prep (diff summary, AC cross-ref, concerns)
```

Then use `AskUserQuestion`:
- Question: "Phase 5.5 complete — how to proceed?"
- Header: "Phase 5.5"
- Options:
  1. **Continue to Phase 6 (Recommended)** — "Prepare review summary, diff, and dev server for manual review."
  2. **Re-run a test** — "Re-run acceptance testing for a specific AC that needs another look."
  3. **Fix and re-verify** — "I see an issue — fix it and re-run verification + acceptance tests."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

## Phase 6: Review Prep

**Goal:** Prepare a review summary before creating the PR.

### Enter Plan Mode

Use `EnterPlanMode` to think holistically about the changes before generating the review. Consider:
- Are there any non-obvious side effects or edge cases the user should watch for?
- Did any design decisions deserve extra scrutiny?
- Are there cross-cutting concerns (performance, security, data integrity) worth flagging?
- Does the scope feel right, or did implementation creep in?

Exit plan mode, then generate the review artifacts below.

### Generate:
1. **Diff summary** — files changed with line counts
2. **AC cross-reference table:**

```
| AC | Status | Test File | Lines |
|----|--------|-----------|-------|
| AC1 | ✅ | actions/foo.test.ts | 45-89 |
| AC2 | ✅ | actions/foo.test.ts | 91-130 |
```

3. **Concerns list** — anything the user should pay attention to during review

### Start Dev Server for Manual Review

After generating the review artifacts, always start a dev server from the worktree so the user can manually verify the changes while reviewing:

```bash
# Ensure .env is available in the worktree
cp <main-repo-path>/.env <worktree-path>/.env 2>/dev/null

# Start dev server (background)
npm run dev &
# Wait for ready
sleep 5
```

Report the URL (note: port may differ from 3000 if it's in use).

Then present a **Manual Review Checklist** — a concrete list of things for the user to visually verify in the browser. Tailor this to the specific issue's ACs. For each item, include:
- The URL to visit (e.g., `/dashboard`, `/customers`)
- What to look for (e.g., "KPI tiles show 4 columns on desktop, 2 on mobile")
- Any interactions to test (e.g., "Click the scoreboard to cycle views")
- Auth requirements (e.g., "Login as admin to see admin-only section")

Format:
```
🖥️ Dev server running at http://localhost:<port>

Manual review checklist:
1. <URL> → <what to verify>
2. <URL> → <what to verify>
...
```

Present the diff summary, AC cross-ref, concerns, dev server URL, and review checklist together.

**🚏 GATE 6 — STOP and wait for user approval.**
Show:
```
🚏 Phase 6 Complete: Review Prep

Diff summary, AC cross-ref, and concerns generated.
Dev server running for manual review.

📋 Open Items:
  - ⚠️ <any concerns flagged above>
  (or "None — all clear.")

⏭️ Next: Phase 7 — PR Creation (commit, push, open PR, update issue)
```

Then use `AskUserQuestion`:
- Question: "Phase 6 complete — how to proceed?"
- Header: "Phase 6"
- Options:
  1. **Create PR (Recommended)** — "Everything looks good. Commit, push, and open the PR."
  2. **I need more time** — "Keep the dev server running. I'll review manually and come back."
  3. **Fix something** — "I spotted an issue during review. Fix it before creating the PR."
  4. **Abort** — "Stop the workflow. Print cleanup instructions."

---

## Phase 7: PR Creation

**Goal:** Create PR with standardized body, link to issue.

### Commit any remaining changes:
```bash
git status --porcelain
```

If the working tree has uncommitted changes, stage and commit them:
```bash
git add -A
git commit -m "$(cat <<'EOF'
<type>: <description> (#<N>)

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

If the working tree is clean, skip staging and committing.

### Spec discipline check (before pushing):

If Phase 0 identified any spec deltas (i.e. the issue's "Spec sections affected" field listed one or more `docs/specs/*.md` paths or `NEW:` sentinels), verify that the diff against master includes spec changes:

```bash
SPEC_DIFF=$(git diff master..HEAD --name-only -- docs/specs/)
if [ -z "$SPEC_DIFF" ] && [ "<phase-0-impact>" != "none" ]; then
  echo "⛔ Spec discipline violation: issue listed spec impact but diff includes no docs/specs/* changes."
  echo "   Spec changes must ship in the same PR as the code that implements them."
  echo "   Either: (a) commit the spec deltas now, or (b) revise the issue's 'Spec sections affected' field."
  exit 1
fi
```

Compute the list of modified spec files for inclusion in the PR body:
```bash
SPEC_FILES=$(git diff master..HEAD --name-only -- docs/specs/ | sed 's|^|- |')
```

### Push and create PR:
```bash
git push -u origin <branch-name>

gh pr create --title "<type>: <description>" --body "$(cat <<EOF
## Summary
<1-3 sentences>

Closes #<N>

## Acceptance Criteria
- [x] AC1
- [x] AC2
- [x] AC3

## Spec Changes

- [<x or space>] This PR updates \`docs/specs/\` to reflect new behavior, OR
- [<x or space>] This PR fixes drift from existing spec (no spec change needed), AND I've verified the spec is still accurate.

Spec files modified:
${SPEC_FILES:-(none — drift fix or no behavior change)}

## Changes
| File | Change |
|------|--------|
| \`path/file.ts\` | Created — purpose |

## Test Coverage
- <N> new tests in `src/__tests__/...`
- All existing tests pass (<total> total)

## Verification Checklist
- [x] `npm run test:run` — all tests pass
- [x] `npm run build` — no errors
- [x] Feature verification: code paths traced, auth checks confirmed
- [x] Scope guard: all changed files map to acceptance criteria

## Design Decisions
<decisions or "None — straightforward implementation.">

## Test Plan
- [ ] <manual verification step 1>
- [ ] <manual verification step 2>
EOF
)"
```

### Update issue acceptance criteria checkboxes:
After the PR is created, update the issue body to check off all acceptance criteria checkboxes. This provides visible progress tracking directly on the issue.

```bash
# Fetch current issue body, replace unchecked boxes with checked boxes
# for each AC that was verified, then update the issue
ISSUE_BODY=$(gh issue view <N> --json body --jq '.body')
UPDATED_BODY=$(echo "$ISSUE_BODY" | sed 's/- \[ \]/- [x]/g')
gh issue edit <N> --body "$UPDATED_BODY"
```

**Note:** This checks ALL `- [ ]` boxes in the Acceptance Criteria section. If the issue has other checkbox sections (e.g., a separate "Out of Scope" list), manually review after updating. If only specific ACs were completed (partial implementation), replace only the matching lines instead of using a blanket `sed`.

### Post Milestone Comment 3 to issue:
```bash
gh issue comment <N> --body "$(cat <<'EOF'
## 🤖 PR Created

**PR:** #<PR-number> — <PR-title>
**Branch:** `<branch-name>`

### Summary
- **New tests:** N
- **Files created:** N
- **Files modified:** N
- **All ACs addressed:** ✅

Ready for review and merge per [PR Merge Process](../CLAUDE.md#pr-merge-process--required-for-every-pr).
EOF
)"
```

### Auto-cleanup worktree:

After the PR is created, automatically clean up the worktree and return to the main repo:

```bash
# Store main repo path (captured during pre-flight)
MAIN_REPO=<main-repo-path>

# Return to main repo
cd $MAIN_REPO

# Remove worktree and local branch
git worktree remove .worktrees/<type>-<N>-<kebab-description>
git branch -D <type>/<N>-<kebab-description>

# Verify master is still checked out
git branch --show-current  # → master
```

Show:
```
🧹 Worktree cleaned up:
  - Removed: .worktrees/<name>
  - Deleted local branch: <branch-name>
  - Main repo: on master ✓
  - Remote branch: still exists (tracks PR)
```

**🚏 GATE 7 — STOP and present PR link.**
Show:
```
🚏 Phase 7 Complete: PR Creation

PR #<PR-number> created: <PR-URL>. Issue #<N> updated.
Worktree cleaned up. Main repo on master.

📋 Open Items:
  - ⚠️ <any post-PR actions needed, e.g. manual checkbox review>
  (or "None — all clear.")

🔍 What I verified:
  - npm run test:run — all <total> tests pass (including <new> new)
  - npx tsc --noEmit — no type errors
  - npm run build — successful
  - Scope guard — all changed files map to ACs

🤖 Automated acceptance tests (Phase 5.5):
  <summarize results table from Phase 5.5 — which ACs were tested, tool used, pass/fail>

🧪 Manual testing for you (anything not covered by automated tests):
  1. <step-by-step manual test for AC1>
  2. <step-by-step manual test for AC2>
  3. <step-by-step manual test for AC3>
  (Cover the happy path and any edge cases specific to this feature)

📦 Merge process (from CLAUDE.md):
  1. npm run test:run — all pass
  2. npm run build — no errors
  3. Feature verification per test plan above
  4. gh pr merge <number> --merge
  5. git pull origin master  (already on master — no checkout needed)
  6. Update docs per Documentation Requirements
```

Then use `AskUserQuestion`:
- Question: "Issue #<N> complete! What next?"
- Header: "Done"
- Options:
  1. **All done (Recommended)** — "PR is ready. I'll review and merge when ready."
  2. **Merge now** — "Run the merge process right now (tests + build + merge)."
  3. **Start next issue** — "Pick up another issue from the backlog."

---

## Edge Cases Summary

| Situation | Action |
|-----------|--------|
| Issue not found | Stop with error message |
| Issue closed | Stop, suggest `gh issue reopen` |
| Issue has linked branch already | Warn, ask user whether to continue |
| Branch exists with worktree | Offer: cd into existing worktree, remove+recreate, or abort |
| Branch exists without worktree | Offer: create worktree for it, delete+recreate, or abort |
| No acceptance criteria | Stop, ask user to add ACs to issue |
| TDD green fails 3x | Stop, ask user for guidance on that AC |
| Build fails 3x | Stop, ask user for help |
| Merge conflicts | Stop, ask user to resolve manually |
| Pre-existing test modified | Flag in verification, require justification |
| User says "stop"/"abort" | Halt immediately, cd to main repo, print cleanup instructions (worktree remove + branch delete) |
| Main repo not on master | Pre-flight auto-switches to master; warns user |
| Already inside a worktree | Pre-flight detects via git-common-dir; stops and asks user to cd to main repo |

## Integration with /ship

These skills are **complementary**:
- `/work-issue N` — full lifecycle from issue to PR (planned work with TDD)
- `/ship` — quick commit/push/PR for ad-hoc changes (hotfixes, docs, config)

Do not suggest `/ship` during `/work-issue` execution. The PR is created in Phase 7.
