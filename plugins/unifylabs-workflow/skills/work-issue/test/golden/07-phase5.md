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

