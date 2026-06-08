# doc-freshness — a detect-only ROUTINE recipe (M4 pilot)

The kit's first **routine**: the scheduled, **detect-and-report-only** maintenance
tier (never autonomous mutation). It catches *accumulated* drift between the code
and the living-doc set — the gap the per-PR `changelog-check` cannot see (that gate
is a single-PR tripwire and is `[skip-changelog]`-bypassable; it never
cross-references code-vs-docs over time).

A **routine is a cloud agent** (claude.ai) that runs your prompt on a cron and
reports to a human channel. It is per-repo and authenticated, so **the kit cannot
pre-install it** — you register it in your own repo. This dir IS the recipe: a
read-only detect script + the scheduled prompt + these registration instructions.

## What it detects

**Mechanical (deterministic, `scripts/doc-freshness-scan.sh`):** count drift
(skills/commands/hooks claims vs the tree), ADR-index gaps, an empty `[Unreleased]`,
skills with no doc entry, living-docs lagging recent code churn.

**Judgment (the routine's LLM layer — see `routine-prompt.md`):** suspicious
doc→code citations that look like real drift (telling them apart from
plugin-relative shorthand / aspirational / historical refs needs judgment — which
is exactly why this is a *routine* and not a plain `schedule:`-cron GitHub Action),
and whether the architecture narrative lags a recent structural change.

## Never-mutate guarantee

Three layers, stated honestly:

1. **The detect script is provably read-only** — `scripts/doc-freshness-scan.sh`
   performs only `grep`/`find`/`test`/`git log` reads + prints. It contains no
   write/commit/push of any kind. (Stronger than a prompt constraint.)
2. **Prompt posture** — `routine-prompt.md` forbids any repo mutation and limits the
   routine to one report emit.
3. **The only state change is the report** — a single canonical `gh issue`
   find-or-update (create / comment / close — all GitHub-issue state, NOT the repo
   tree). Repo-tree never-mutate is verifiable by origin-log inspection: no
   routine-authored commit, branch, or PR.

> **Note (ADR 0008):** whether the `RemoteTrigger`/`schedule` API also accepts a
> read-only *tool-allowlist* (an API-level enforcement layer) could not be verified
> when this recipe was built — the claude.ai trigger API was unauthenticated in the
> build env (HTTP 401). If your environment exposes such a field, bind a toolset
> that denies `git push`/write-Bash while permitting `gh issue`; otherwise the
> guarantee rests on layers 1–3 above.

## Register it (consumer step — needs claude.ai auth)

Routines are cloud agents, so register from an environment authenticated to
claude.ai (the `schedule` skill, or the `RemoteTrigger` tool):

```text
/schedule  "Run the doc-freshness routine for this repo: <paste routine-prompt.md>"
           cron: "17 13 * * 1"   # weekly, Mon ~13:17 local (off the :00 mark)
```

or via the `RemoteTrigger` tool (`action: create`) with the prompt body =
`routine-prompt.md` and a weekly cron. The create response returns the routine's
**claude.ai URL** (the native report sink) + the server-parsed run time — confirm
both. Recurring routines auto-expire after a bounded window; re-register as needed.

## Proven live (the detect substance)

The exit-proof for "routine reports (never mutates)" was run on the detector
locally (the cloud registration is the consumer step above; the build env's
claude.ai API was unauthenticated):

- **Baseline:** `scripts/doc-freshness-scan.sh` → `✓ FRESH` (exit 0), zero false
  positives on the current tree.
- **True-positive:** with a stub 14th skill staged (no count ripple), the scan fired
  exactly 3 correct signals (count drift in `CLAUDE.md` + `README.md`, skill without
  a doc entry) → exit 1 — then reverted clean.
- **Never-mutate:** the script made zero writes; the working tree was unchanged
  across both runs.

## Files

| File | Role |
| --- | --- |
| `routine-prompt.md` | The scheduled prompt: run the script → add judgment → one idempotent `gh issue` report. Detect-and-report-only. |
| `README.md` | This file — what it detects, the never-mutate guarantee, and how to register it. |
| `../../../../../scripts/doc-freshness-scan.sh` | The repo-intrinsic, `$HOME`-free, read-only detector (shellcheck-gated in CI). |

## Deferred to BACKLOG (out of this pilot)

A second `drift-check` routine (a new *repo-intrinsic* variant — `check-drift.sh` is
entirely machine-local: its clone-sync + `~/.claude` symlink checks are meaningless
in a cloud routine), and the consumer-template `dep-CVE` routine.
