# GitHub mode — exact `gh` invocations

**Read when**: in GitHub mode and need exact `gh` commands for issue lifecycle (create, comment, close, label).

## Prerequisites

- `gh` CLI installed and authenticated.
- Repo has a GitHub remote: verify with `git remote get-url origin` (returns `github.com/<owner>/<repo>` or similar).
- Verify the actual login (NOT the keyring label): `gh api user --jq '.login'`. Never assume from `gh auth status` — that shows the local keyring label, not the API identity.

## Label setup (once per repo, on first run)

Create the four phasing labels if missing:
```bash
gh label create phasing --color 0E5A8A --description "Phasing framework" 2>/dev/null || true
gh label create phasing:tracking --color 0969DA --description "Master plan tracking issue" 2>/dev/null || true
gh label create phasing:phase --color A371F7 --description "Individual phase issue" 2>/dev/null || true
gh label create phasing:archived --color CCCCCC --description "Archived run" 2>/dev/null || true
```

Per-run label is created at run start:
```bash
gh label create "phasing:run-${RUN_ID}" --color EDEDED --description "Run ${RUN_ID}" 2>/dev/null || true
```

## Tracking issue (1 per run)

**Create**:
```bash
gh issue create \
  --title "[phasing] ${TASK_DESCRIPTION_TRUNCATED}" \
  --label "phasing,phasing:tracking,phasing:run-${RUN_ID}" \
  --body-file <(cat <<'EOF'
<MASTER_PLAN_BODY>
EOF
)
```
The output prints the new issue's URL. Capture the issue number from the URL or use `--json number`:
```bash
TRACKING_ISSUE=$(gh issue create ... --json number --jq '.number')
```

**Update body** (e.g., to check off a phase as it completes):
```bash
gh issue edit "${TRACKING_ISSUE}" --body-file <new-body-file>
```

**Comment** (progress logging, one comment per phase completion):
```bash
gh issue comment "${TRACKING_ISSUE}" --body "Phase 2 complete: <one-line summary>. See #<phase-2-issue-number>."
```

**Close** (run end):
```bash
gh issue close "${TRACKING_ISSUE}" --comment "Run complete. All phases verified. <closure summary>"
```

**Archive label** (per archive policy):
```bash
gh issue edit "${TRACKING_ISSUE}" --add-label "phasing:archived"
gh issue comment "${TRACKING_ISSUE}" --body "Run archived on $(date -u +%Y-%m-%d). Local state moved to archive."
```

## Phase issues (1 per phase)

**Create** (during master plan execute step, one per phase):
```bash
PHASE_ISSUE_N=$(gh issue create \
  --title "[phasing ${N}/${TOTAL_PHASES}] ${PHASE_NAME}" \
  --label "phasing,phasing:phase,phasing:run-${RUN_ID}" \
  --body-file <phase-N-spec.md> \
  --json number --jq '.number')
```

**Read body** (phase session loads its spec):
```bash
gh issue view "${PHASE_ISSUE_N}" --json body --jq '.body'
```

**Comment handoff** (phase session at completion):
```bash
gh issue comment "${PHASE_ISSUE_N}" --body-file <phase-N-handoff.md>
```

**Close** (immediately after handoff comment):
```bash
gh issue close "${PHASE_ISSUE_N}" --comment "Phase ${N} complete. Handoff above."
```

(For `failed` phases, close with `--comment "Phase ${N} failed verification. See handoff above."`)

## Cross-linking phases on the tracking issue

When updating the tracking issue's body to reflect progress, the Phases section uses GitHub's task-list syntax with cross-references:
```markdown
## Phases
- [x] #43 phase 1 — Monorepo bootstrap
- [x] #44 phase 2 — Design tokens
- [ ] #45 phase 3 — Supabase + RLS
- [ ] #46 phase 4 — Auth bootstrap
```

GitHub auto-renders the cross-references and shows the current state (open/closed) of each linked issue. Closing a phase issue automatically marks it strikethrough on the tracking issue's checklist.

## Polling for phase completion

Background poll for phase N completion (issue closed AND a handoff comment exists):
```bash
# In ~/.claude/skills/phasing/scripts/launch-terminal.sh or inline:
while true; do
  STATE=$(gh issue view "${PHASE_ISSUE_N}" --json state --jq '.state')
  if [ "${STATE}" = "CLOSED" ]; then
    LATEST_COMMENT=$(gh issue view "${PHASE_ISSUE_N}" --json comments --jq '.comments[-1].body')
    if echo "${LATEST_COMMENT}" | grep -q "^# Phase ${N} Handoff"; then
      echo "PHASE_${N}_DONE"
      break
    fi
  fi
  sleep 5
done
```

Run this via `Bash` with `run_in_background: true` so it doesn't block the orchestrator's chat.

## Listing runs

**Active runs** (not archived):
```bash
gh issue list --label phasing --label phasing:tracking --search "no:label:phasing:archived" --state all
```

**All runs** including archived:
```bash
gh issue list --label phasing --label phasing:tracking --state all
```

**Archived only**:
```bash
gh issue list --label phasing --label phasing:tracking --label phasing:archived --state all
```

## Common pitfalls

- **gh auth label vs login mismatch**: `gh auth status` shows the keyring label (local nickname), NOT the GitHub login. Always verify via `gh api user --jq '.login'` before assuming a username for issue assignment, repo paths, or `@`-mentions.
- **Label colors**: GitHub requires hex without `#`. Don't include the hash.
- **Body files via heredoc**: prefer `--body-file <(cat <<EOF ... EOF)` over `--body "$(cat ...)"` — handles special chars more cleanly.
- **Closed-with-comment is two operations**: `gh issue close --comment "..."` does both atomically, prefer it over close-then-comment.
