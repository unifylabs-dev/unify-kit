# Decomposition heuristics — Phase 4

Phase 4 decides whether the feature should be one issue or several. Bad calls in both directions:
- **Under-splitting** — one giant issue burns through `/work-issue` Phase 3.5's phasing gate; user loses the granularity of separate PRs; review is harder.
- **Over-splitting** — three tiny linked issues add overhead without benefit; reviewers context-switch between PRs unnecessarily.

This file is the trigger catalog + split strategies.

---

## The default

**Default is one issue.** Splitting is the exception, not the rule. If no trigger fires, keep it as one.

---

## Triggers (any one fires → propose a split)

### Trigger 1 — L-scope across >2 modules with significant work each

**Signal:** Phase 3 records scope = L AND Phase 2's impact map names ≥3 modules where each has meaningful changes (not just a single field added).

**Why this trips:** large + cross-module = high risk of merge conflicts, hard-to-review PR, slow CI, fragile rollback.

**Example:**
> Feature: "Add a billing module with subscription lifecycle, customer billing page, and admin billing dashboard"
> Modules: billing (new), customers (subscription field), admin (new dashboard route), audit (new actions)
> → Split into: (1) billing module data layer, (2) customer-facing billing page, (3) admin billing dashboard

### Trigger 2 — >12 acceptance criteria

**Signal:** Phase 3's auto-proposed AC list has >12 items.

**Why this trips:** TDD cycles in `/work-issue` Phase 4 grind through ACs one at a time. >12 means a Phase 4 session likely overflows context; phasing gets invoked inside it anyway. Better to split before phasing decides for us.

**Example:**
> 14 ACs covering: data model, server actions, validation, UI list, UI detail, UI form, auth guards, audit logging, e2e tests, navigation, sidebar entry, notifications, search integration, performance budget
> → Split into: (1) data + server actions + validation, (2) UI list + detail + form, (3) navigation + notifications + search integration

### Trigger 3 — Cross-system language in brainstorm

**Signal:** Brainstorm output uses "rebuild", "refactor X to support Y", "add Z across modules A and B", "migrate from X to Y", or similar cross-system phrasings.

**Why this trips:** these phrasings signal scope beyond a single bounded change. Even if the AC count looks small, the work crosses natural seams.

**Example:**
> Idea: "Migrate the orders state machine to support a new VERIFIED stage and update all dependent reports"
> → Split into: (1) state machine + audit + tests, (2) dependent report updates (per report)

### Trigger 4 — Orthogonal AC partition

**Signal:** Phase 3's ACs can be cleanly partitioned along orthogonal axes — data model / UI / API / integration / docs.

**Why this trips:** if a clean partition exists, each axis ships as its own focused PR with its own reviewer expertise (DB person on data PR, frontend on UI PR, etc.). Reviewability + parallel review > monolithic PR.

**Example:**
> ACs include data model changes, 3 new UI pages, 2 new API routes, 1 cron integration, 1 doc update
> Orthogonal partition: (data + cron) / (UI) / (docs)
> → Split into: (1) data model + cron integration, (2) UI pages + supporting client code, (3) doc updates

---

## When NOT to split (anti-triggers)

Even if a trigger fires, **keep as one issue** if:

- **Tight coupling between proposed children.** If child (2) can't be reviewed without child (1) being merged first, and child (1) is small, just merge them.
- **All work in a single file.** If the entire change is in one file (e.g. a config rewrite, a single component refactor), splitting fragments the diff and makes review harder.
- **Dependencies are circular.** If (1) needs (2) needs (1), the split is wrong. Re-shape, or keep as one.
- **Total scope < S+M.** If the "big" feature is actually 3 small features that each fit in one PR, the overhead of three issues + three branches + three PRs outweighs the focus gain. One issue with clear AC grouping is fine for small total scope.

---

## Split strategies

When splitting, prefer **one of these shapes**. Mixing them produces hard-to-track dependency graphs.

### Strategy A — Layered (data → API → UI)

Classic web-app split. Bottom-up dependency:

```
(1) Data model + migrations + server actions          ← merges first
(2) API surface + validations + auth guards           ← depends on (1)
(3) UI pages + components + e2e tests                 ← depends on (2)
```

Each child is independently mergeable in order. Reviewers can focus per layer.

### Strategy B — Modular (one module per child)

Split by which module each chunk lives in:

```
(1) Module X changes (data + behavior + tests)         ← parallel-mergeable
(2) Module Y changes (data + behavior + tests)         ← parallel-mergeable
(3) Cross-module integration (wires X+Y together)      ← depends on (1) and (2)
```

Children (1) and (2) can be reviewed in parallel; (3) is the integration.

### Strategy C — Tracking-parent + child PRs

When the split is messier (5+ children, or unclear dependencies), use a tracking parent:

```
Parent: #N — "Tracking: <feature>"
  Body lists all children as a checkbox list
  Closes when all children close (via gh issue close <N>)

Children: #M, #O, #P, #Q, #R
  Each carries its own ACs + spec impact
  Each links to the parent
```

The parent isn't worked directly via `/work-issue` — `/work-issue` runs on children.

---

## Output format for the gate prompt

When proposing a split, present this shape via `AskUserQuestion`:

```
Phase 4 detected: <trigger that fired>

Proposed split:
  (1) <title> — S/M/L — <one-line scope>
       ACs: <count> — covers <AC subset>
       Depends on: none
  (2) <title> — S/M/L — <one-line scope>
       ACs: <count> — covers <AC subset>
       Depends on: (1)
  (3) <title> — S/M/L — <one-line scope>
       ACs: <count> — covers <AC subset>
       Depends on: (1)

Tracking parent: <Yes — title "Tracking: <feature>" | No>

Options:
  1. Accept this split (Recommended)
  2. Keep as one issue (override the trigger)
  3. Propose a different split
  4. Add/remove tracking parent
  5. Abort
```

---

## After splitting

Phase 6 produces a draft spec **per child issue**. Each child has its own spec impact + its own embedded spec draft. The parent (if any) has no spec — it's purely a tracking issue.

Phase 9 files children first, captures their issue numbers, then files the parent with cross-references to children. Children are updated post-creation to include `> Parent: #<P>` in their body via `gh issue edit`.
