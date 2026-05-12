# Severity policy

Each finding has a confidence score (0-100) and a severity tier derived from the confidence plus the finding's category.

## Tier definitions

### Critical (always gates user)

Confidence ≥ 90 AND any of:

- Bug that will break runtime behavior (logic error, null deref, race condition, off-by-one)
- Security issue (injection, auth bypass, secret leak, XSS, SSRF, broken access control)
- Broken test (currently failing or about to fail given the change)
- Contract violation (spec says X, code does Y)
- Missing required AC (phase mode: an AC checkbox is unsatisfied)
- Broken file reference (doc mode: a referenced file does not exist)
- Internal contradiction in a spec (doc mode: conflicting MUST statements)

**Behavior:** ALWAYS present via AskUserQuestion. NEVER auto-fix. User picks: Fix / Skip / Edit suggestion.

### Important (default auto-fix; user can flip to gate)

Confidence 80-89 AND any of:

- Code-quality issue from CLAUDE.md compliance
- Missing edge-case handling that could surface as a bug
- Silent failure / inadequate error logging
- Doc inaccuracy that misleads a future reader
- Type design weakness (encapsulation, invariant gaps)
- Test gap (missing behavioral coverage)
- Comment rot (comment contradicts code)

**Behavior:** Auto-fix by default. User can flip the iteration to gate via `--gate-important`, or per-finding via menu.

### Suggestion (report-only)

Confidence < 80, OR any of:

- Style nit
- Refactor opportunity with no functional benefit
- Opinion-level preference
- Polish / cosmetic

**Behavior:** Listed in the final report only. NOT fixed unless `--include-suggestions`.

## Severity assignment

Each review agent assigns its own confidence (per the existing pr-review-toolkit prompts and the doc-reviewer prompt). The iterative-review skill does NOT re-classify findings; it trusts the agent's score.

Default mapping:

- 90-100 → Critical
- 80-89 → Important
- < 80 → Suggestion

## Severity overrides

A review agent MAY emit an explicit `severity: critical` tag in its output, overriding the confidence-derived tier. This is for findings where the agent has lower textual confidence but the issue is structurally catastrophic (e.g., a security finding with confidence 75 should still gate as Critical).

The iterative-review skill respects these tags.

## Cross-cutting overrides

### Phase mode — plan-affecting findings

Any finding whose root cause is the spec (not the code) is automatically upgraded:

- To Critical (in terms of user attention)
- Routed to the Open-Questions channel (see `phasing-integration.md`) instead of the in-loop fixer

Examples of plan-affecting findings:

- "The AC for `<feature>` is unreachable given the architecture in <other-phase's-spec>"
- "Phase N's spec says X, but master plan says Y — contradiction"
- "Phase N+1 will need <input> but no upstream phase produces it"

These do NOT enter the fix loop. They DO appear in the final report.

### `--include-suggestions`

Promotes Suggestions into the loop processing flow. Even with this flag, Suggestions are NOT auto-fixed — they go through the same gate flow as Important findings.

This flag exists for power users doing thorough polish passes. Default behavior (Suggestions = report-only) is preferred.

## Aggregation across multiple agents

When multiple agents return findings for the same file:line:

1. Group by (file, line, normalized description).
2. Pick the highest severity / confidence as the canonical finding.
3. Preserve the source agent list in the finding metadata (useful for fixer routing).

Deduplication is exact-match on description. Near-duplicates (similar text, same line) are kept separate; let the user decide.
