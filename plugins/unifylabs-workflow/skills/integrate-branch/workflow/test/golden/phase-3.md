## Phase 3: Route recommendation

### Recommendation matrix

| Composite | Blocking signal (any) | Route |
|---:|---|---|
| ≥80 | None | **Salvage** (recommended) |
| 40–79 | None | **User decides** (no opinion; show audit, let user pick) |
| <40 | — | **Rebuild** (recommended) |
| Any | Build fails AND no obvious fix path | **Rebuild** |
| Any | Test suite >50% failing | **Rebuild** |
| Any | PHI-in-logs detected | **Rebuild** (PHIPA violation — code can't be salvaged in place) |
| Any | Hard-coded secrets | **Discard** |
| Any | Unprotected mutating action on a public route | **Discard** |
| Any | Foundational auth/security file (dal.ts, auth.ts, middleware.ts) broken | **Discard** |
| Any | Migration conflicts with master that can't auto-rebase | **Rebuild** |

**Always print the full audit report first** — the user must see findings before being asked to choose. The skill never silently routes.

### Audit report format

```markdown
# Integration Audit — <branch>

**Composite score:** <N>/100
**Recommended route:** <Salvage|Rebuild|Discard|User decides>
**Rationale:** <1–2 sentences explaining the recommendation>

## Branch summary
- Branch: <canonical name>
- Files changed: <N> (<+lines>/<-lines>)
- Days behind master: <N>
- Linked issue/PR: <#N or "none">
- Stale: <yes/no>
- Merge conflicts: <yes/no>

## Per-dimension scores

| Dimension | Score | Weight | Findings |
|---|---:|---:|---:|
| CLAUDE.md non-negotiables | <N>/100 | 30% | <C>/<I>/<S> |
| Test bar                  | <N>/100 | 20% | <C>/<I>/<S> |
| Spec sync                 | <N>/100 | 15% | <C>/<I>/<S> |
| Code quality              | <N>/100 | 10% | <C>/<I>/<S> |
| Cross-cutting impact      | <N>/100 | 20% | <C>/<I>/<S> |
| Visual fidelity           | <N>/100 |  5% | <C>/<I>/<S> |

## Critical findings
<bullet list of every Critical finding with file:line where applicable>

## Important findings
<grouped by dimension>

## Cross-cutting impact

| Modified file | Category | Dependents |
|---|---|---|
| src/lib/foo.ts | Foundational (14 deps) | src/app/orders/page.tsx, src/lib/bar.ts, ... |
| ...           | ...          | ... |

## Suggestions
<bullet list — may be ignored on salvage; surfaced for rebuild>
```

### Confirm the route with the user

After printing the audit, ask via `AskUserQuestion`:

```
question: "Audit complete. Composite score <N>/100. Recommended route: <X>. Proceed?"
options:
  - <Recommended route> (Recommended)
  - Salvage — fix gaps in place, produce PR from existing code
  - Rebuild — extract specs, rebuild from scratch via /work-issue
  - Discard — abort with documented rationale
  - Show me a specific finding before deciding
```

The user's choice locks in the route. Proceed to Phase 4.

