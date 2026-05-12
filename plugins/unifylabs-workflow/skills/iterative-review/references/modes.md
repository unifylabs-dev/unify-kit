# Mode detection — decision tree

Run in order. First match wins.

## Detection rules

1. **Arg starts with `phase`** (e.g., `/iterative-review phase 2026-05-12-foo 2`)
   - mode = `phase`
   - Parse `run-id` (token 2) and phase number N (token 3)
   - Verify `run.json` exists at one of:
     - `~/Projects/*/.claude/phasing/<run-id>/run.json`
     - `./.claude/phasing/<run-id>/run.json`
     - User-provided absolute path

2. **Arg is a number or PR URL** (e.g., `47`, `#47`, `https://github.com/x/y/pull/47`)
   - mode = `code` (PR variant)
   - Target = the PR (use `gh pr view <num>`)

3. **Arg is a file or directory path**
   - If path ends in `.md` / `.txt` / `.rst` / `.mdx` → mode = `doc`
   - If path is under `specs/` / `docs/` / `plans/` → mode = `doc`
   - Else if path is a code file → mode = `code` (single-file variant)
   - Else if path is a directory → AskUserQuestion to choose mode

4. **No arg + cwd contains `.claude/phasing/<run-id>/run.json`** with `overall_status == "in_progress"`
   - mode = `phase`
   - Target = latest completed phase (highest `n` with `status == "complete"`)

5. **No arg + git repo with diff** (`git diff --quiet` returns non-zero)
   - mode = `code` (local diff variant)
   - Target = `git diff` output

6. **No arg, nothing else matches**
   - AskUserQuestion: "What do you want to review?"
   - Options: PR number / file path / phasing run / abort

## Per-mode entry points

### Code mode — PR variant

**Setup (in this order):**

1. **Inspect PR metadata:**
   ```
   gh pr view <num> --json files,baseRefName,headRefName,title,body,labels,closingIssuesReferences
   ```

2. **Phase-association detection** — try each path, first match wins:
   - **Branch name regex** on `headRefName`: match `^phase/(<run-id>)/(<N>)(-.*)?$` or `^phasing/(<run-id>)/(<N>)(-.*)?$`
   - **PR body markers**: regex `body` for `(?:phasing-run|run-id):\s*([\w-]+)` AND `(?:Phase|phase):\s*(\d+)`
   - **Issue label cross-reference**: for each entry in `closingIssuesReferences`, fetch labels via `gh issue view <#> --json labels`; look for `phasing:run-<run-id>` and `phasing:phase`
   - **Run.json deliverable match (fallback)**: scan `~/Projects/*/.claude/phasing/*/run.json` where `overall_status == "in_progress"`; for each completed phase's handoff, parse the `## Deliverables` section; if the PR's changed-files list is a subset of one phase's deliverables, suggest that phase

3. **If association detected** → AskUserQuestion:
   - Question: "This PR appears to be the output of phase N of run `<run-id>`. Run in phase-aware mode (loads master plan + phase spec + handoff context)?"
   - Options: **Phase-aware (Recommended)** / **Code-only** / **Show evidence**
   - If phase-aware: load phase artifacts and merge with PR review context. Plan-affecting findings flow to the associated phase's handoff Open Questions per `phasing-integration.md`.
   - If code-only: skip phase context; pure PR review.
   - If show evidence: print the matched signal (branch name, body excerpt, label set, or deliverable overlap) and re-ask.

4. **Create isolated worktree** — see `worktree-handling.md` for the full contract:
   ```
   git worktree add ~/.claude/iterative-review-worktrees/<num> origin/<headRefName>
   ```
   The loop runs INSIDE this worktree. Your main checkout is untouched.

5. **Diff source**: from within the worktree, `git diff origin/<baseRefName>...HEAD`. All Edit operations target files in the worktree.

6. **After the loop exits**: the push-back gate (SKILL.md §6.5) decides what happens to the fixes (push to PR / open follow-up PR / leave / discard).

### Code mode — local diff variant

- `git diff HEAD` for staged + unstaged
- `git diff origin/main..HEAD` for branch-wide review (only if on a non-main branch)
- Identify changed file paths via `git diff --name-only`

### Code mode — single-file variant

- Read the file in full
- Review as-is (no diff context)

### Doc mode

- Read the target file
- If the doc has a `references:` frontmatter or inline references, also read referenced files (for accuracy checks)
- If the doc has `- [ ]` checkbox AC, parse them out for completeness checks

### Phase mode

- Read `<run-id>/run.json` — identify target phase N (from arg, or latest complete)
- Read `<run-id>/master-plan.md` (for cross-phase consistency context)
- Read `<run-id>/phase-N-spec.md` (the contract this phase executed against)
- Read `<run-id>/phase-N-handoff.md` if phase status is `complete` or `failed`
- Read all deliverable files listed in the handoff's `## Deliverables` section
- For GitHub mode (`run.json.mode == "github"`):
  - Use `gh issue view <tracking_issue>` for the master plan
  - Use `gh issue view <phases[N-1].issue_number>` for the phase spec
  - Use `gh issue view <phases[N-1].issue_number> --comments` for the handoff (it's the last comment with the structured handoff body)
