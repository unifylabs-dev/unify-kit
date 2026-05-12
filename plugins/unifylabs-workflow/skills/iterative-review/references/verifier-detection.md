# Verifier auto-detection

Probe the project root in this order. Multiple matches = multiple verifier commands run sequentially.

## Detection table

| File present | Commands |
|--------------|----------|
| `package.json` with `"test"` script | `npm test --silent` |
| `package.json` with `"typecheck"` script | `npm run typecheck` |
| `package.json` with `"build"` script | `npm run build` |
| `package.json` with `"lint"` script | `npm run lint` |
| `pnpm-lock.yaml` present | swap `npm` for `pnpm` in above |
| `bun.lockb` or `bun.lock` present | swap `npm` for `bun` |
| `yarn.lock` present | swap `npm` for `yarn` |
| `pyproject.toml` with `[tool.pytest]` | `pytest -x --tb=short` |
| `pyproject.toml` with `[tool.mypy]` | `mypy .` |
| `pyproject.toml` with `[tool.ruff]` | `ruff check` |
| `setup.cfg` or `requirements.txt` (legacy Python) | `pytest -x` if `tests/` exists |
| `Cargo.toml` | `cargo test --quiet`, `cargo check` |
| `go.mod` | `go test ./...`, `go vet ./...` |
| `Gemfile` | `bundle exec rspec` if `spec/` exists |
| `Makefile` with `test:` target | `make test` |
| `Makefile` with `check:` target | `make check` |

## Resolution flow

1. Walk the project root (cwd, or git root via `git rev-parse --show-toplevel`).
2. Apply every matching row above.
3. Surface the assembled list via AskUserQuestion: "Detected verifier commands: <list>. Use these, edit, or skip?"
4. Cache the chosen list for the loop's lifetime (in-memory session state, not persisted).
5. Execute sequentially via Bash; halt on first non-zero exit.

## Doc-mode verifier

Doc mode has no project test suite. Instead, dispatch a `doc-consistency-check` subagent (general-purpose Agent with a focused prompt) that:

- Re-reads the target doc.
- Validates every file path referenced in the doc exists on disk.
- Validates every `- [ ]` AC checkbox is mentioned in Deliverables / Test plan / Verification.
- Checks for internal contradictions: search for "MUST" / "MUST NOT" statements and flag conflicts.
- Returns PASS / FAIL with structured details.

This subagent is the doc-mode verifier between iterations.

## Phase-mode verifier

Use whatever the phase spec's `## Verification` section lists. Those are the contract. Run them all; halt on first failure.

If the phase spec has no Verification section:

1. Fall back to code-mode auto-detect for the cwd.
2. If the cwd is not a valid project root (e.g., the orchestrator's home dir), use the project root listed in `run.json` if present.
3. If still no verifier: AskUserQuestion to ask the user for the right commands.

## Halt-on-failure protocol

If any verifier command exits non-zero:

1. Capture stderr + stdout (last 50 lines).
2. Dispatch a root-cause-fixer subagent (general-purpose Agent) with:
   - The full failure output
   - The list of files modified in the current iteration
   - Instructions: "Identify what broke; apply the minimal fix; do not refactor; do not change scope."
3. Re-run the failed verifier command (just that one, not the whole sequence) ONCE.
4. Still failing: AskUserQuestion — "Verifier still failing after one auto-fix attempt. Options: continue iterating, abort with residual report, escalate to manual fix."

## Caching

Cached verifier commands persist for the loop's lifetime only. They are NOT written to disk. A new `/iterative-review` invocation re-detects.

If the user explicitly edits the list at the AskUserQuestion prompt, the edited list is what's cached.
