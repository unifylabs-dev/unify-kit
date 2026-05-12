# Verification step types

**Read when**: defining verification steps in a phase spec, OR running verification (per-phase self-verify §6 of phase lifecycle, OR orchestrator post-phase §9.2 of master plan lifecycle).

The framework supports three verification step types. Every phase spec's `## Verification` section uses one or more. Code phases SHOULD include at least one `command` step. Non-code phases use `check` and/or `review`. Mix freely.

## Type: command

**What**: an exact shell command. PASS = exit code 0 AND output matches the expected pattern.

**Format in spec**:
```markdown
- command: `<exact shell command>` — exit 0
- command: `<exact shell command>` — exit 0 AND output contains "<pattern>"
```

**Examples**:
- `command: pnpm test tests/auth/ — exit 0`
- `command: curl -sf http://localhost:3000/health — exit 0 AND output contains "ok"`
- `command: cargo build --release — exit 0`

**How phase session verifies**: runs the command via Bash, captures exit code + stdout/stderr, confirms exit 0 and pattern match. Records actual output snippet in handoff verification record.

**How orchestrator post-phase verifies**: MAY re-run the command (recommended for high-stakes phases like tests, builds, migrations). The phase session's report is trusted by default; re-running is the second pair of eyes.

**Anti-patterns**:
- Vague commands: `make test` when there are 17 makefile targets — be specific.
- Commands with non-deterministic output (timestamps, random IDs) without pattern relaxation.
- Commands that depend on prior `cd` — make them self-contained (use `--cwd` flags or absolute paths).

## Type: check

**What**: a structured criterion against the deliverable that the phase confirms in writing. Used when no shell command can verify (e.g., "spec follows template", "doc covers topic X").

**Format in spec**:
```markdown
- check: <specific, observable criterion> — confirmed by phase
```

**Examples**:
- `check: src/middleware/auth.ts exists with default export of "requireAuth" function — confirmed by phase`
- `check: docs/auth-architecture.md exists at the specified path with non-empty content — confirmed by phase`
- `check: package.json has "@anthropic-ai/sdk" in dependencies at version >= 0.30.0 — confirmed by phase`

**How phase session verifies**: reads the deliverable, confirms each criterion. Records in handoff how it was confirmed (e.g., "read src/middleware/auth.ts:45 — found `export default function requireAuth(...)`").

**How orchestrator post-phase verifies**: MAY re-read the deliverable to double-check. For low-stakes checks, trusts the phase session.

**Anti-patterns**:
- Vague: "check: code looks good" — useless. Sharpen until observable.
- Subjective without anchor: "check: doc reads well" — anchor to: "check: doc covers (a) request flow, (b) middleware behavior on missing token, (c) token expiry handling".
- Composite: "check: file exists AND has content X AND function Y is exported" — split into three separate checks for clarity.

## Type: review

**What**: phase session re-reads its own work against an acceptance criterion and confirms in writing it's met. Used for criteria that need a holistic read (a single-line file existence check is `check`; a "doc reads well and covers all topics" is `review`).

**Format in spec**:
```markdown
- review: <acceptance criterion phrased as a question or statement> — confirmed by phase against deliverable
```

**Examples**:
- `review: protected routes return 401 when token missing or invalid — confirmed by phase against integration test output AND middleware code`
- `review: doc covers (a) request flow, (b) middleware behavior on missing/invalid tokens, (c) token expiry handling — confirmed by phase against doc`
- `review: latency histogram has correct bucket boundaries for the workload — confirmed by phase against metrics.ts`

**How phase session verifies**: re-reads the deliverable in full, confirms the criterion is met. Records in the handoff a one-sentence summary of how the deliverable meets the criterion.

**How orchestrator post-phase verifies**: typically trusts the phase session. May spawn a fresh review pass for high-stakes work (e.g., a security review of new auth code) — but this is rare and explicit, not the default.

**Note on "no subagents"**: the framework explicitly rejects subagents. The phase reviews its own work, not a subagent. The orchestrator's post-phase verification is the second pair of eyes — not a separate review subagent. If a critical phase needs an independent review, that's a fresh review-phase, not an inline subagent.

**Anti-patterns**:
- Lazy: "review: it's done correctly" — meaningless. Articulate the specific criterion.
- Mistakenly using `review` when `check` would do: a single-criterion file existence check is `check`, not `review`.
- Mistakenly using `review` when `command` would do: if a test can prove it, use `command`.

## DEFERRED is banned

This bears repeating because it was the old framework's failure mode: `DEFERRED` is not a result. Every verification step in every spec must resolve to PASS or surface a real failure (and the phase fails, full stop).

The temptation to write "couldn't verify X, leaving for orchestrator" survives subagent removal. Resist. The orchestrator can't actually re-do the work; deferral becomes hallucinated grounding for downstream phases. See SKILL.md phase session §7 hard rule.

## Choosing the right type

Quick guide:
- **Can a shell command prove it?** → `command`. Most code phases need ≥1.
- **Is it a single observable property of the deliverable?** → `check`.
- **Does it require a holistic read of the deliverable?** → `review`.

When in doubt, prefer `command` over `check`, and `check` over `review`. Lower-numbered types are more verifiable.
