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

