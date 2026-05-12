# Phasing integration — Open-Questions write contract

When iterative-review runs in `phase` mode, plan-affecting findings flow back through the phasing skill's existing handoff Open-Questions channel. This preserves the "master plan is locked post-approval" invariant.

## What counts as plan-affecting

A finding is plan-affecting if it implies any of:

- The phase spec contradicts the master plan
- The master plan missed a dependency that the phase needs
- An AC in the phase spec is unreachable as written
- A downstream phase spec needs new inputs based on this phase's discovery
- The phase's "Decisions baked in" should change

What is NOT plan-affecting (fix in-loop instead):

- A code-quality issue in the deliverable
- A doc clarity issue in the handoff itself
- A test gap that doesn't change the AC
- A style nit or comment rot

## Write target

### File mode (`run.json.mode == "file"`)

Append to `.claude/phasing/<run-id>/phase-N-handoff.md`'s existing `## Open questions for you (founder) or downstream` section.

Algorithm:

1. Read the file in full.
2. Locate the section header by exact match: `## Open questions for you (founder) or downstream`.
3. Compose the new content: existing content + new findings (formatted per the block below) inserted immediately below the header.
4. Atomic write: write to `<file>.tmp`, then `mv -f <file>.tmp <file>`.
5. If any step fails (file missing, header missing, write error), leave the original untouched and surface an error.

### GitHub mode (`run.json.mode == "github"`)

Post a NEW comment on the phase issue. Do NOT edit the existing handoff comment.

```bash
gh issue comment <phase-issue> --body-file <findings.md>
```

Where `<phase-issue>` is `run.json.phases[N-1].issue_number`.

The comment body uses the structure below. Prefix the comment with `[phasing:open-question]` so the orchestrator's text-grep can find it (label-on-comment is not universally supported).

## Findings block format

```markdown
# Iterative-review findings — plan-affecting

Source: `/iterative-review phase <run-id> <N>`
Run timestamp: <ISO 8601>
Loop exit reason: <clean | fixed-point | cap | circuit-breaker | aborted>

## Findings

### [Critical] <one-line title>
**Source agent:** <which review agent produced this>
**File / context:** <path or "phase spec — section X" or "master plan — Decisions baked in">
**Rationale:** <why this implies the spec / plan is wrong, not the code>
**Suggested change:** <what to update — be concrete>

### [Critical] <next one-line title>
...

---
```

## Idempotency

If iterative-review runs twice on the same phase:

1. Read the existing handoff content (file mode) or fetch existing comments (GitHub mode).
2. Hash each existing plan-affecting finding: `sha1(severity + first 80 chars of description)`.
3. Skip findings whose hash is already present.
4. Append only new findings.

This prevents duplicate Open Questions across re-runs. The hashing is intentionally loose (first 80 chars) so minor wording differences from a re-review don't cause duplicates.

## Orchestrator handoff

The phasing orchestrator's post-phase gate (§9.2 of `phasing/SKILL.md`) reads the handoff's Open Questions section and surfaces findings via its self-healing flow:

- Trivial → fix in this session
- Load-bearing → insert a fix-phase
- Abort

iterative-review does NOT take any action on the orchestrator's behalf. It just writes the findings; the orchestrator's existing flow handles dispatch.

## Atomicity safety

Multiple iterative-review runs MUST NOT corrupt the handoff:

1. Read full file content.
2. Verify section header exists (case-exact match).
3. Compose new content (existing + new findings).
4. Write to `<file>.tmp` next to the original.
5. `mv -f <file>.tmp <file>` (atomic on POSIX).
6. If any step fails, leave the original untouched.

For GitHub mode, comment creation is atomic on the GitHub API side; no special handling needed beyond rate-limit awareness.

## Anti-patterns

- ❌ Do NOT edit `master-plan.md`. Even with user approval. Use Open Questions.
- ❌ Do NOT edit `phase-N-spec.md` retroactively. If the spec is wrong, that's an Open Question.
- ❌ Do NOT create new files in the phasing run directory. Use the existing artifacts.
- ❌ Do NOT close phase issues (GitHub mode). Only the phasing orchestrator closes them.
- ❌ Do NOT modify `run.json`. It's the phasing skill's state, not ours.
- ❌ Do NOT post findings as a reply to an existing comment — post as a new top-level issue comment so the orchestrator's polling picks it up.

## Reading phasing state (read-only)

When entering phase mode, iterative-review needs to read these artifacts. All are read-only:

| Artifact | File-mode path | GitHub-mode source |
|----------|----------------|---------------------|
| Run state | `<run-id>/run.json` | `<run-id>/run.json` (mirrored locally even in github mode) |
| Master plan | `<run-id>/master-plan.md` | Body of issue `run.json.tracking_issue` |
| Phase spec | `<run-id>/phase-N-spec.md` | Body of issue `run.json.phases[N-1].issue_number` |
| Phase handoff | `<run-id>/phase-N-handoff.md` | Comments on issue `run.json.phases[N-1].issue_number`, find the one with `# Phase N Handoff` heading |
| Deliverable files | Paths listed in handoff's `## Deliverables` section | Same — handoff lists them |
