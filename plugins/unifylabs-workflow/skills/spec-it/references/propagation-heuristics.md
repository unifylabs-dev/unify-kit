# Convention-propagation heuristics — Phase 5

Phase 5 detects whether a feature introduces a generalizable pattern worth absorbing into `unify-kit`. Most features don't — they're project-specific. But a small fraction do, and capturing them at the moment they're being spec'd is cheaper than re-discovering them later.

This file is the trigger catalog. Each trigger has: a signal to detect, what to propagate, and the recommended target file in unify-kit.

---

## Trigger 1 — New env-var category

**Signal:** Phase 3 clarifications include a new env var that doesn't match existing patterns in the target repo's `.env.example`.

**Examples:**
- A new `OBSERVABILITY_*` namespace for logging/tracing setup
- A new `PAYMENTS_*` namespace for a payment provider
- A new `AI_*` namespace for LLM-related keys

**Propagate to:** `unify-kit/templates/snippets/<topic>.env.example` (snippet that opt-in projects can adopt) AND a one-paragraph note in `unify-kit/specs/02-templates.md` about the new snippet.

**Skip if:** the env var is project-specific (`MVO_SPECIFIC_THING=`, single-feature secret with no reuse potential).

---

## Trigger 2 — New hook pattern

**Signal:** Phase 3 surfaces a new Claude Code hook (pre-commit, post-edit, session-start, etc.) that's worth running across projects.

**Examples:**
- A hook that blocks commits containing PHI keywords
- A hook that auto-runs `prisma generate` after schema edits
- A hook that warns when a file exceeds a length cap

**Propagate to:** `unify-kit/plugins/unifylabs-workflow/hooks/<name>.sh` plus registration in `plugin.json`. Mention in `unify-kit/specs/03-hooks.md`.

**Skip if:** the hook is project-specific (e.g. enforces a naming convention only the target repo uses).

---

## Trigger 3 — New CI step

**Signal:** Phase 3 introduces a CI check worth running across projects.

**Examples:**
- A typecheck-on-PR step for TypeScript projects
- A secrets-scan step
- A bundle-size budget check

**Propagate to:** `unify-kit/templates/.github/workflows/<name>.yml` snippet. Mention in `unify-kit/specs/04-github-actions.md` or `specs/09-kit-ci.md` depending on whether it's a consumer-facing or kit-internal CI step.

**Skip if:** project-specific (uses the project's exact stack with no generalization).

---

## Trigger 4 — New methodology rule

**Signal:** Phase 3 (or research notes from Phase 2e) surfaces a process rule the team has decided to adopt — "always do X before Y", "every Z must include W".

**Examples:**
- "Every mutating Server Action must call `logAudit()` fire-and-forget"
- "Every public lookup must `checkRateLimit` + `timingSafeDelay` + identical found/not-found response"
- "Every spec change ships in the same PR as the code"

**Propagate to:** `unify-kit/specs/07-philosophy-and-methodology.md` — add to the methodology canon (A–G + pointers structure).

**Skip if:** the rule is project-specific or about a specific module's behavior (those belong in module specs, not the kit methodology).

---

## Trigger 5 — New plugin requirement / MCP server

**Signal:** Phase 3 reveals the feature depends on a Claude Code plugin or MCP server not currently in `RECOMMENDED_PLUGINS.md` (or equivalent).

**Examples:**
- A new `playwright` MCP server requirement for a visual-testing feature
- A new `context7` requirement for library-doc grounding (already standard, but illustrates)
- A new `supabase` MCP for backend integrations

**Propagate to:** `unify-kit/templates/RECOMMENDED_PLUGINS.md` template + mention in `unify-kit/specs/02-templates.md`.

**Skip if:** the plugin is project-specific.

---

## Trigger 6 — New security / privacy rule

**Signal:** Phase 2e (industry standards research) surfaces a rule the project SHOULD adopt that isn't in current templates.

**Examples:**
- A new password-complexity rule from updated NIST guidance
- A new session-timeout default
- A new rate-limit pattern for public endpoints

**Propagate to:** `unify-kit/templates/security-checklist.md.template` + mention in `unify-kit/specs/02-templates.md`. If it's a hook-enforceable rule, also propose Trigger 2.

**Skip if:** the rule is industry-specific (e.g. PHIPA-only) and the target repo is the only consumer in that industry.

---

## Trigger 7 — New convention worth documenting

**Signal:** Phase 3 surfaces a coding convention, file-organization pattern, or interaction pattern that's worth standardizing.

**Examples:**
- "Worktrees in `.worktrees/`, main repo stays on master"
- "Server Actions return `{ error }` or `{ fieldErrors }`, never throw"
- "Branch naming: `<type>/<issue-number>-<kebab-description>`"

**Propagate to:** `unify-kit/templates/claude.md.template` (the consumer-facing CLAUDE.md template) OR `unify-kit/specs/07-philosophy-and-methodology.md` depending on whether it's a consumer convention or a kit methodology rule.

**Skip if:** project-specific.

---

## How to decide skip vs propagate

The cleanest test:

> "Would another `unifylabs-dev` project benefit from this rule, snippet, or hook AS-IS, without modification?"

- **Yes** → propagate
- **Yes with adaptation** → propagate as a pattern hint, not as a verbatim lift (use sourcing mode `pattern-only` per `unify-kit/specs/00-vision-and-license.md`)
- **No** → skip; note in target-repo issue body for posterity

---

## Output format when a trigger fires

Phase 5 drafts a **kit-impact analysis** that becomes the body of a parallel unify-kit issue (or PR). Shape:

```markdown
# Kit propagation — <feature title>

## Source
- Target repo: <repo>
- Issue: #<N> — <title>
- Trigger: <which trigger fired>

## What to absorb

<1–3 sentences describing the pattern>

## Proposed changes

| File | Change |
|------|--------|
| `templates/snippets/<x>.env.example` | Add `<VAR>` example |
| `specs/02-templates.md` | One-paragraph note about the new snippet |

## Sourcing mode

`<verbatim | verbatim-with-light-edit | customization | pattern-only>`

## Acceptance criteria

- [ ] Snippet exists at the proposed path
- [ ] Spec entry mentions the new snippet
- [ ] CHANGELOG `[Unreleased]` updated

## Source rationale

<why this is worth absorbing — what's the cross-project value?>
```

This shape lets the kit-side `/work-issue` invocation pick it up cleanly.

---

## When in doubt

Default to **propose, decline-able**. The skill should fire the trigger, draft the analysis, and let the user say "no, not worth it". A false-positive trigger costs 30 seconds of user time at Gate 5; a missed trigger costs months until the pattern is rediscovered. Asymmetric — prefer false positives.
