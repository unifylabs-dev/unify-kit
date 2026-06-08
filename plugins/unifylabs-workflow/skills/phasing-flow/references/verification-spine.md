# The verification spine

phasing-flow's verification is **deterministic-first** (decision J4): a measurable,
re-runnable check is the source of truth; the LLM layers can only *raise* a gate,
never lower the deterministic verdict. This is what keeps the framework clear of
the performative-DEFERRED-verification failure that the M1 trust gate ruled out.

Three layers, in authority order:

## Layer 1 — In-run deterministic verify (AUTHORITATIVE)

Inside the engine, after a unit executes, the glue runs the
`scout → resolveVerifier → runner` chain: a scout agent reads the project's
build/test config, the **tested** `resolveVerifier` (the same canonical resolver
the iterative-review loop uses) turns it into the ordered command list
(`npm test`, `pytest`, `cargo test`, `make test`, …), and a runner agent runs each
and reports `pass` / `fail` / `fail-permanent`.

- `fail` (a RED verifier) → the unit is **blocked** → `criticals-pending-gate`.
- `fail-permanent` (the command is missing / unrunnable) or a throw or an
  unrecognized verdict → **aborted** (fail-CLOSED — never silently passes).
- `pass` → continue to Layer 2.

This is the gate. It is **live-proven**: smoke `wf_ddbd2cbb-581` (clean path) and
`wf_2cc8aa35-512` (a RED `make test` → `criticals-pending-gate`).

## Layer 2 — Adversarial diff-review (can only RAISE; fail-OPEN)

For a unit that executed + verified `pass`, the glue fans out **≥2** adversarial
reviewers over the unit's captured diff (runtime-safety + security lenses),
consensus-aggregates them (ADR 0002: a Critical survives only if **≥2** reviewers
raise it within ±3 lines), and returns the consensus-Critical **count**. A
consensus-Critical → `criticals-pending-gate`.

- **Fail-OPEN:** a reviewer that throws or returns a non-finite value is coerced to
  0 and **never blocks** — Layer 1 is the real gate. (≥2 reviewers is enforced so a
  single-reviewer fan-out cannot silently make consensus inert.)
- **Skip-if-clean:** a unit that changed no files is not reviewed.

The adversarial layer adds defense-in-depth (catches a defect the project's own
verifier does not), but it can only escalate to the human gate — it never
overrides a deterministic `pass` into a block on its own authority beyond raising
`criticals-pending-gate` for the user to judge.

## Layer 3 — `verifier-backstop.sh` Stop hook (no-LLM backstop)

The deterministic net for the orchestrator SESSION (zero new hook code — it ships
in the plugin). On a Stop event it re-runs the project's REAL verifier fresh and
**blocks the stop on a live RED**. Arm it for the session before `run`:

1. A committed **`.unify-verify.json`** at the project root (it may carry an
   explicit `"workingDir"`). Its presence is the opt-in.
2. Export **`UNIFY_VERIFY_BACKSTOP=1`** in the session — the arm signal (must be
   exactly `1`).

When both hold, the hook engages; otherwise it fails-open (allows the stop) and
logs `not-engaged-no-config` / `not-engaged-not-armed`. It is the final
deterministic catch if a session tries to stop on a RED tree.

## `/goal` — the OPTIONAL outer wrapper (never the gate)

`/goal <condition>` is a native session-scoped loop that keeps working until a
*verifiable* end-state, bounded by `… OR stop after N turns`. In phasing-flow it
is an **optional outer wrapper** the user may invoke BETWEEN runs for a "keep going
until the verifier is green" loop — e.g. wrapping repeated `run` + fix cycles. It
is **never** the in-run gate: it cannot run mid-Workflow (no mid-run input), and a
soft model "done?" check is exactly the performative-verification failure we avoid.
Deterministic-first is locked; `/goal` only sequences gated runs, it does not
replace the deterministic verify or the human sign-off.
