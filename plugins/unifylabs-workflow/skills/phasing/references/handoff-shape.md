# Handoff shape

**Read when**: a phase session is about to write its handoff (phase session lifecycle §8 in SKILL.md). The same shape goes into the GitHub phase issue's final comment OR `<run-dir>/phase-N-handoff.md`.

## Skeleton

```markdown
# Phase N Handoff — <name>

**Session**: `⚡ phase-<N>-<phase-name-slug>`  <!-- display form with emoji prefix (e.g., ⚡ phase-2-hooks-audit-fixtures); matches the Claude Code title pill. run.json#phases[N].session_name stores the plain slug (no emoji) per the data/display rule in SKILL.md. -->

## Status
<"complete" | "failed">

## What I did
<2–4 sentences, plain language. What changed in the world. A successor (or you, in 6 months)
should be able to read this and understand the new state without reading every file.>

## Decisions I made (downstream must respect)
- **<decision>**: <why> — <constraint imposed on future work>
- **<decision>**: <why> — <constraint>

(Only list decisions made DURING this phase that bind future phases. Don't re-list decisions from
the master plan or from predecessors — those are already binding.)

## Deliverables
- `<path>` (new file) — <what it is>
- `<path>` (lines <a>–<b>) — <what changed>
- `<path>` (test file) — <what it covers>

(Every spec deliverable should appear here. If a deliverable was dropped, raise it under "Open
questions" — don't silently omit.)

## Verification (results)
- command `<cmd>`: PASS — <key output line, e.g., "24 tests passed">
- check `<criterion>`: PASS — <how confirmed>
- review `<criterion>`: PASS — <one sentence: how the deliverable meets it>

(Every spec verification step appears here with PASS or a real failure. NO DEFERRED. NO defer-to-
orchestrator. If a step couldn't be verified, the phase fails — full stop. See SKILL.md phase
session §7 hard rule.)

## Open questions for you (founder) or downstream
- <thing I noticed but couldn't resolve in scope>
- <ambiguity that surfaced during execution>

(Only real, encountered issues. Not speculation. Not "what if we add Y feature later." Things
that came up during THIS phase and need attention before downstream phases proceed or before
the run ends.)

## What the next phase needs to know
<2–3 sentences priming the successor on world-state. Examples: "The auth middleware is now
required on all /api/* routes. The token TTL is 1 hour, configured in src/config.ts."

This isn't a recap of what you did — it's the practical heads-up the successor needs to not
trip over your work.>
```

## On `failed` handoffs

When a verification step doesn't pass and you can't fix it inside this phase's scope, write the handoff with `Status: failed`. Example:

```markdown
# Phase 5 Handoff — Add prometheus metrics

**Session**: `⚡ phase-5-add-prometheus-metrics`

## Status
failed

## What I did
Implemented /metrics endpoint with prom-client and request-counter middleware. Server fails to
start due to a missing import in src/server.ts that originates from phase 3's work — out of scope
for this phase to fix. Verification step `curl localhost:3000/metrics | grep http_requests_total`
could not be run because the server doesn't start.

## Decisions I made
- **Used `prom-client` v15.x** — current stable, smallest bundle. Constraint: future metric
  additions should use this library, not raw HTTP responses.

## Deliverables
- `src/metrics.ts` (new file) — registers Counter + Histogram, exports `metricsHandler`
- `src/server.ts` (lines 12–18) — wired the metrics endpoint

## Verification (results)
- command `curl -s localhost:3000/metrics | grep http_requests_total`: FAIL — server didn't
  start. Error: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'foo' imported from src/server.ts`.
- check `src/metrics.ts exists`: PASS — confirmed.
- review `latency histogram has correct bucket boundaries`: PASS — buckets are [0.005, 0.01,
  0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] which match prom-client defaults.

## Open questions
- The missing import in src/server.ts (`'foo'`) is out of scope for this phase. Phase 3 owned
  that file. Orchestrator should surface this and decide: fix-phase, accept-as-is + manual fix
  later, or abort.

## What the next phase needs to know
The /metrics endpoint code is in place but unreachable until the import problem is fixed.
```

The phase didn't loop. Didn't auto-fix the out-of-scope problem. Didn't defer to the orchestrator with "please fix this for me." It surfaced the issue cleanly and let the orchestrator's self-healing flow take over.

## Length

Soft target: ~200 lines. Quality > completeness. If you're approaching 200 lines, ask: am I padding? Am I rehashing the spec? The handoff should be the minimum a successor (or future-you) needs.

## Anti-patterns

- "DEFERRED" anywhere in the handoff → BANNED. Phase fails instead.
- "Orchestrator will handle this" / "leaving for orchestrator" → BANNED. Phase fails instead.
- Handoff > 300 lines → padding. Trim.
- "What I did" that just lists files modified → useless. Describe the new state of the world.
- Empty "Open questions" when the spec was ambiguous → the ambiguity was real; surface it.
- "Open questions" that's speculation about future features → not real, drop.
