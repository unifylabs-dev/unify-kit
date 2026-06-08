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

