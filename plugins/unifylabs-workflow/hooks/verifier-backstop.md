# `verifier-backstop` — Stop-hook verifier backstop

The deterministic, no-LLM half of the M1 verification spine. `verifier-backstop.sh`
is an **additive `Stop` hook**: when an opted-in session tries to stop, the hook
re-runs the project's **real** verifier fresh and blocks the stop on a live RED
(a non-zero verifier exit). It is the non-model enforcement counterpart to the
LLM-driven review loop — a stop is only allowed once the actual test command
exits 0, not because a model claimed it did.

## Engagement model — DEFAULT-OFF / opt-in

The hook ships to every consumer of `unifylabs-workflow` but does **nothing**
unless **both** non-model-authored signals are present:

| Signal | Where | Purpose |
|--------|-------|---------|
| `.unify-verify.json` | committed at the resolved project root | declares the project opts into the backstop (a tracked file, not a model-written one) |
| `UNIFY_VERIFY_BACKSTOP=1` | session environment | arms the backstop for this session |

If either is missing, the hook is a silent no-op (`exit 0`, the stop is
allowed). This is also unify-kit's own posture: it is a Bash/Markdown repo with
no auto-detectable verifier, so even an armed session is a no-op here (see
"Empty resolution" below).

## `.unify-verify.json` schema

All fields are optional. A bare `{}` opts in and relies entirely on
auto-detection.

```json
{
  "workingDir": "",
  "commands": [],
  "backstopCommands": []
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `workingDir` | string | Explicit directory the verifier runs in. When set and a directory, it wins over the git toplevel. When empty/absent, the hook resolves the git toplevel of the session `cwd`, then the `cwd` itself. If no git root and no explicit dir, the hook fails open (never runs in the wrong repo). |
| `commands` | string[] | Override run list, used **only when auto-detection resolves nothing**. Each entry is run via `bash -c` in `workingDir`. |
| `backstopCommands` | string[] | If **non-empty**, this **replaces** the entire run list (auto-detected and `commands` alike). Lets a project scope the backstop to a subset — e.g. tests only — even when the full verifier list is broader. |

### Command resolution precedence

1. `backstopCommands` (non-empty) → replaces everything.
2. else the auto-detected list from the canonical resolver
   (`bin/verifier-resolve.mjs`, which imports `resolveVerifier` from
   `skills/iterative-review/workflow/lib/verifier-detect.mjs` — the one
   resolver; the hook never reimplements detection).
3. else `commands` from the config.
4. else **empty** → fail-open no-op (`exit 0`, no block).

### Empty resolution = fail-open

If the resolver returns `[]` **and** there is no non-empty `commands` /
`backstopCommands` override, the hook is a silent no-op. (unify-kit's own live
case.)

## Behavior contract (invariants)

- **Fail-OPEN** on every internal/resolution error, missing toolchain
  (`node`/`git`), no git root, or empty resolution. The hook only ever exits 0
  in these paths — it never blocks defensively.
- **BLOCK only on a live non-zero verifier exit.** On the first command that
  exits non-zero the hook prints
  `{"decision":"block","reason":"verifier red: <cmd> failed ..."}` to stdout and
  exits 0 (the JSON-block form). It **never** reads a self-written
  results / `*.pass` / `*.result` / PASS-FAIL file — only a fresh live re-run
  counts.
- **`stop_hook_active=true` always allows.** A retry is never blocked (loop
  guard).
- **Cost/scope gate.** Before running, the hook fingerprints the git tree state
  (`HEAD` joined with a sha of `git status --porcelain`) and compares it to a
  per-session marker. If the tree is unchanged from the last PASS, it skips the
  re-run (`exit 0`). The marker stores **only** the scope/state fingerprint,
  never a pass/fail verdict, and is written only on all-GREEN.
- **Determinism.** The trigger + decision path uses no wall-clock
  (`date +%s` / `Date.now` / `Math.random`); the only scope signal is the
  git-derived fingerprint. Wall-clock appears solely in the optional
  `CLAUDE_HOOKS_LOG` timestamp.

## Environment variables

| Var | Effect |
|-----|--------|
| `UNIFY_VERIFY_BACKSTOP=1` | arm signal (required to engage). |
| `UNIFY_VERIFY_NODE` | optional explicit `node` binary path (fallback when PATH lookup fails). |
| `CLAUDE_HOOKS_DISABLE` | comma-separated hook names to disable; this hook is `verifier-backstop`. |
| `CLAUDE_HOOKS_LOG` | writable path; appends one-line JSON audit records. |

## Tests

`hooks/test/test-verifier-backstop.sh` is the enforcement harness (mirrors
`test-security-hooks.sh`): it builds throwaway git repos from
`hooks/test/fixtures/backstop-{green,red,empty,override}/`, arms the session,
and asserts the real Stop signal for GREEN/RED/loop-guard/empty/override/off and
the marker cost-gate. It is RED-capable: pointed at
`hooks/test/stub-verifier-backstop-allow.sh` (an always-allow stub) the block
cases must fail — proving the assertions bind to real hook behavior. CI runs
both the normal and RED self-test in the `verifier-backstop-harness` job
(`.github/workflows/plugin-install-fixture.yml`), alongside `node --check` /
`node --test` of the shim and the resolver-drift guard.
