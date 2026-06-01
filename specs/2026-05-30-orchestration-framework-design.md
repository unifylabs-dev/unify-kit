# Orchestration Framework — Design

> Name: **`phasing-flow`** (decided 2026-06-01). The former `flow` shorthand was fully renamed to `phasing-flow` across this design + the impact matrix in M0; "workflow"/"Workflow" refers to the Workflow tool and is intentionally left distinct.

| | |
|---|---|
| **Status** | Draft for review (brainstorm → design) |
| **Date** | 2026-05-30 |
| **Authors** | Tomer Kurman + Claude (Opus 4.8, 1M) |
| **Eventually supersedes** | the `phasing` skill, and the within-session half of `handoff` — *after* migration |
| **Build branch** | `feature/orchestration-framework` (worktree: `/Users/tomerkurman/unify-kit-orchestration`) |
| **Restore point** | tag `pre-orchestration-framework` → `36509f2` |
| **Related** | `specs/2026-05-23-handoff-skill-design.md`, `docs/methodology.md`, `docs/philosophy.md`, the deep-dive + impact-sweep workflow outputs |

---

## 1. Why now

Opus 4.8 ships, natively, the orchestration the kit hand-rolled before it existed:

- **Workflow tool** — deterministic in-process multi-agent orchestration (`agent()`/`parallel()`/`pipeline()`/`phase()`), structured-output sub-agents, worktree isolation, journaled resume, a token budget, background execution that re-invokes the main session on completion.
- **`/goal <condition>`** — a session-scoped autonomous loop that keeps working until a *verifiable* end-state is met (a fast model checks "done?" after each turn), bounded by `… OR stop after N turns`.
- **`/effort ultracode`** — extended reasoning + automatic workflow orchestration; Claude decides when to spawn a workflow.
- **1M context + native compaction** — dramatically reduce the single-session context-rot pressure that justified fresh-session phasing.
- **Native worktrees, routines (cloud cron), agent teams/view, Stop hooks** — adjacent primitives covering isolation, scheduling, coordination, and deterministic gating.

unify-kit's `phasing` (cross-session, multi-terminal) and `handoff` (context-survival) layers re-implemented the *mechanics* of this — spawning, sequencing, state-carrying, resume, poll loops — because none of it was native. **Those mechanics are now native and better.** What remains uniquely the kit's is the **discipline layer**: human decision-gates, hallucination-free planning, rigorous verification (no DEFERRED), surfacing gaps/edge-cases, and the security floor.

## 2. Vision

Build a **brand-new orchestration framework** — *not* a refactor of `phasing`. It **learns from** phasing's hard-won foundations and **drags none of its machinery** (multi-terminal spawn, `launch-terminal.sh`, `run.json` polling, OSC-2 title pills, manual copy-paste). The end state:

- **Target execution is in-process** via the Workflow tool, **gated by a human orchestrator session**.
- `phasing` stays installed and untouched; it is **deprecated only after we migrate** live usage off it (we are using it on a real project today).
- The framework is **adopted across** `work-issue`, `spec-it`, `iterative-review`, `integrate-branch`, and any other skill it fits.
- We **dogfood the new pattern to build it** (see §9), so the friction we hit becomes the framework's own requirements.

**Guiding principle:** the kit's value migrates from *"plumbing nobody else has"* to *"human-control packaging on top of native orchestration."*

## 3. Foundational values carried forward

Every value that made `phasing`/`handoff` good is preserved — re-expressed on a native primitive:

| Foundational value (from phasing/handoff) | Mechanism in the new framework |
|---|---|
| Brainstorming / direction-setting | Human-led in the orchestrator session (`brainstorming` skill) — **decision gate** |
| Strong planning **without hallucination** | **Planning-brain Workflow**: multi-angle planners + adversarial gap/edge-case critic + judge → one synthesized plan |
| Awareness of the master plan before execution | Human **reviews & approves** the synthesized master plan — **decision gate** |
| More usable context / no bleed / no rot | **Execution Workflows**: clean-context sub-agents, structured returns; orchestrator stays lean (journal + compaction) |
| Surfacing inconsistencies, gaps, edge-cases | The **critic agent** in planning + an **adversarial diff-reviewer** post-execution |
| **Very strong verification** (no DEFERRED) | **`/goal` + Stop hooks** make "verified-done" a native, enforced loop — then human **signs off** |
| Strong handoffs | Workflow **journal/resume** for same-session continuity; the 7-section doc kept for genuine cross-session/provenance transfer |

## 4. Architecture

Three parts, one hard constraint:

- **Orchestrator session = the human-control spine.** You live here. It brainstorms with you, launches workflows, holds every decision gate, and re-grounds between bursts.
- **Workflows = the autonomous engine.** Planning brain and execution fan-out. Sub-agents run in clean context and return only distilled, structured results, so the orchestrator's own context stays lean.
- **`/goal` + Stop hooks = the verification spine.** Work continues until a *measurable, verified* end-state is reached, bounded against runaway.

**HARD CONSTRAINT (platform fact):** a running Workflow takes **no human input mid-run** — it only pauses for permission prompts. **Therefore every human decision-gate lives in the orchestrator session, _between_ workflow runs.** This is not a preference; it is what makes the control model unambiguous: workflows are autonomous bursts that start, run dark, and return; you decide in the gaps.

**The loop** (gates are the only places you are involved):

```
Brainstorm ──[GATE: direction]──▶ Planning-brain Workflow (multi-angle + critic + judge)
   ──[GATE: approve master plan]──▶   ← you see exactly what is about to run
   Execution Workflow(s)  (autonomous fan-out; clean-context sub-agents; worktree isolation where parallel writes)
   ──▶ /goal verify loop + adversarial diff-review  (deterministic checks are the source of truth)
   ──[GATE: verification sign-off]──▶ next unit
```

**Context partitioning:** sub-agents get fresh windows (the "more context, no bleed/rot" property phasing chased via terminals); the orchestrator stays lean by accepting only structured returns and leaning on the Workflow journal + native compaction. This is phasing's file-based state discipline, made native.

## 5. The primitives and their roles

| Primitive | Role in the framework |
|---|---|
| **`/effort ultracode`** | Default operating mode of the orchestrator — auto-reach for workflows on substantive sub-tasks at xhigh reasoning. *The framework is designed assuming ultracode is on.* |
| **Workflow tool** | The engine: planning brain + execution fan-out; structured output; worktree isolation; journaled resume; token budget. |
| **`/goal`** | The verification spine: keep working until a measurable, verified end-state — always bounded (`… OR stop after N turns`). |
| **Stop hooks** (adjacent) | Deterministic, scriptable verification gate (exit 0 = continue) — the no-LLM cousin of `/goal` for hard checks. |
| **Native worktrees** (adjacent) | Per-unit filesystem isolation; replaces hand-rolled `git worktree` plumbing + "main always on master". |
| **Routines** (adjacent) | The scheduled, **detect-and-report-only** maintenance tier (never autonomous mutation). |
| **Agent teams / agent view** (adjacent) | **Parked (2026-06-01)** — superseded for our needs by in-process Workflow + orchestrator session; revisit only for live mid-run inter-agent debate. |
| **`ultraplan`** (adjacent) | **Parked (2026-06-01)** — optional cloud plan-review surface; cloud + GitHub dependency not justified yet. |

## 6. Gating philosophy

**Gate on the decisions that need your input — not on mechanics.**

- **Gate (your judgment):** direction/brainstorm, design decisions that drive the work, approval of created artifacts (plans, specs, PRs), and verification sign-off.
- **No gate (autonomous):** spawning units, executing already-approved work, polling/waiting, mechanical transitions.

Two objections this design answers head-on (both were *why* phasing existed):

- **"Subagents make poor plans" (the reason for the plan-mode gate).** A *single* autonomous planner still does. The **planning brain** fans out several planners, runs an adversarial critic that hunts for what they missed, has a judge synthesize the best — *and hands it to you to approve.* You approve a plan produced by a stronger process than a single human-driven plan-mode pass, and you remain the final authority. The plan gate is kept; what's behind it is upgraded.
- **"Subagents go rogue and make misaligned decisions."** Structurally impossible here: sub-agents only ever *execute work against a plan you already approved* and *report*; they never make direction-level decisions, because every decision point is a gate in the orchestrator session, outside any workflow. Autonomy handles execution and detection; you handle decisions.

## 7. Context model

- **Unit = window-fraction:** `% = tokens ÷ full context window`. Read the **harness-native `context_window.used_percentage`** (the statusline already uses it). **Drop** the per-model "pressure baseline" table and the re-summing of transcript tokens — that kills an entire staleness class (no per-model arm to maintain; the `opus-4-8`-missing bug never recurs).
- **Generous thresholds.** With 1M + compaction, real pressure is far out; you consider ~30% (300K) comfortable. Suggested triggers (tunable): *warn* ~60%, *suggest handoff* ~75%, *urgent* ~85%. These replace the old early-firing 40/50/60/70.
- The live bug (`context-awareness.sh` has no `opus-4-8` arm → computes against 150K → fires ~3.3× too early) is fixed by this switch, in M0.

## 8. Scope of change across the kit

- **New `phasing-flow` framework skill** + a single `/phasing-flow` command with verb subcommands (`start`/`plan`/`run`/`verify`/`status`/`resume`) — see §14 #5.
- **Hook fix (M0):** `context-awareness.sh` → window-fraction / native signal.
- **Native worktrees (M0):** replace hand-rolled `git worktree` plumbing in `work-issue` Phase 2 and `iterative-review` PR mode; drop "main always on master".
- **`iterative-review` (M1):** re-implement as a real `loop-until-dry` Workflow with *enforced* cap / fixed-point / budget — the reference implementation that proves "gates survive on Workflow."
- **Planning brain (M1):** prototype the multi-angle + critic + judge planning workflow.
- **`phasing-flow` engine (M2):** execution-workflow pattern + `/goal` verification + adversarial diff-review.
- **Adoption (M3):** `work-issue`, `spec-it`, `integrate-branch` onto the engine; `integrate-branch`'s 6-agent audit → typed `parallel()` workflow.
- **`handoff` (M0 docs / ongoing):** narrowed to cross-session/provenance; within-session rescue → compaction.
- **New capabilities (M4):** one reference `/workflow-library` recipe; detect-only routine pilots — drift-check + doc-freshness as kit routines, dep-CVE shipped as a consumer-template routine (see §14 #4).
- **Migration + deprecation (M5):** move live usage off `phasing`; deprecate `phasing`.
- **Keep verbatim:** the 7 security/integrity hooks (durable moat). **M0 verified** they fire *and enforce* on Workflow-spawned in-process agents (file-guard hard-blocked a credential-file write from inside a workflow agent; output-secrets-scanner fires on main-session tool use) — no coverage gap over the new substrate.

## 9. Build method

- **Dogfood the new pattern**: this orchestrator session (the human-gated spine) + workflow bursts for research/audit/review/parallel-edits + `/goal` for "make it green" loops + ultracode on + you gating at decisions.
- **`phasing` / single-session as fallback** only if a milestone genuinely cannot fit one orchestrator session. We do not burn that bridge.
- **Stabilize-first**: M0 is small and needs no orchestration — done carefully and verified.
- Honest caveat: Workflows/routines are *research preview*; expect rough edges. Mitigation = the discipline we already have (decision gates, verifiable-only autonomous work, adversarial review, deterministic checks).

## 10. Revert / rollback strategy

Four layers, exactly as requested:

1. **`main` is never touched** until you merge a PR you have reviewed.
2. **All work in the `feature/orchestration-framework` worktree.** Your `main` checkout stays on `main`, so your **live symlinked skills keep running the current version** throughout — the build cannot affect your running sessions or your other project.
3. **Additive build.** Old `phasing`/`handoff`/etc. stay in place; "revert" mostly means "don't adopt the new files."
4. **Per-milestone PRs.** Accept the small M0 stabilization independently of the big framework. Dislike it → close the PR, `git worktree remove`, delete the branch → zero residue. Already merged and changed your mind → `git revert` the merge (it's all in history). Named restore anchor: tag `pre-orchestration-framework`.

## 11. Doc-, CLAUDE.md-, & config-impact matrix

Verified by the `orchestration-impact-sweep` workflow (5 scanners + completeness critic): **101 impacted files + 12 critic-caught misses + 18 count/version locations.** The full execution checklist — grouped into themes (context-discipline, handoff-narrowing, subagent-stance, native-worktrees, engine-adoption, phasing-deprecation, new-caps, governance, counts, opportunistic, reviewed-excluded) — lives in the companion **`2026-05-30-orchestration-framework-impact-matrix.md`**.

Three headlines from the sweep:

1. **Pre-existing drift blocks us until M0 fixes it.** The kit's own counts are inconsistent across ~15 files (variously 9/10/7, 10/10/7, 12/16/8; plugin README still says `2.0.0-pre.1`; `llms.txt` is back at v0.1.0). **M0 must reconcile every count to the current actual (12 skills / 16 commands / 8 hooks) before layering framework changes on top.**
2. **A CI gate is already broken.** `plugin-install-fixture.yml` asserts `n_skills==11` / `n_cmds==10` (real: 12 / 16) — it currently fails its own check — and its version regex `^2\.0\.[0-9]+$` would reject any bump. Fix in M0 or every initiative PR fails.
3. **`statusline.sh` already reads the harness-native `used_percentage`** — it is the reference implementation the context hook should converge to (Theme 1), confirming window-fraction is the right, already-present signal.

**Definition-of-done (every milestone PR):** tests/lint/structural-validation pass; affected docs + CLAUDE.md + configs updated *in the same PR*; `CHANGELOG [Unreleased]` entry (CI-enforced); human verification sign-off. (Mirrors CLAUDE.md §7 PR Merge Process.) Machine-local files (`~/.claude/CLAUDE.md`) are updated separately from the PR.

## 12. Milestones

| # | Name | Deliverables | Exit / proof |
|---|------|--------------|--------------|
| **M0** | Stabilize on 4.8 | **fix the broken `plugin-install-fixture` count assertions + version regex**; **reconcile count drift (→ 12/16/8) across ~15 files**; hook → window-fraction; handoff doc reframe; recalibrate over-eager offer gates; security-hook-over-Workflow check | own PR; CI green (incl. the previously-failing fixture); docs updated |
| **M1** | Reference impl + planning brain | `iterative-review` as enforced `loop-until-dry` Workflow; planning-brain prototype | **proves gates-survive-on-Workflow + verification ≥ human-gated baseline** (no-regression eval — the M1→M2 trust gate, §14 #3) |
| **M2** | `phasing-flow` engine | execution-workflow pattern + `/goal` verify + adversarial diff-review; `phasing-flow` skill core | end-to-end gated run on a real task |
| **M3** | Adoption | `work-issue`, `spec-it`, `integrate-branch` onto the engine | each migrated skill passes its own acceptance |
| **M4** | New capabilities | one `/workflow-library` reference recipe; one detect-only routine pilot | recipe runs; routine reports (never mutates) |
| **M5** | Migrate + deprecate | move live usage off `phasing`; deprecate `phasing` | live project running on `phasing-flow`; `phasing` marked deprecated |

M1 is the trust gate: we do not tackle the flagship engine until the reference implementation empirically shows native sub-agents don't regress to the performative-DEFERRED-verification failure that killed the old subagent-based skill.

## 13. Risks & mitigations

- **Workflow swallows the gates** → autonomous fan-out, product value lost. *Mitigation:* gates always live *between* workflow runs (platform-enforced — no mid-run input anyway).
- **Trust regression** (subagents fake verification again). *Mitigation:* prove on M1 (single gate) before M2/flagship; deterministic checks as source of truth; adversarial diff-review.
- **Prose-vs-enforced illusion** (iterative-review's caps were instructions). *Mitigation:* real JS ceilings; communicate as a correctness upgrade (some runs that "passed" now hard-stop).
- **Determinism** (Workflow disables wall-clock/RNG). *Mitigation:* run-ids/timestamps from `args`, never generated in-script.
- **Security-coverage gap** over Workflow-spawned agents. *Mitigation:* M0 verification before any autonomy ships.
- **Over-offer regression** (global + work-issue + auto-offer all gate on context-pressure 1M weakened). *Mitigation:* recalibrate offer gates in M0.
- **Maintenance-drift** (rules duplicated across files). *Mitigation:* the re-implementation collapses duplicated prose into the deterministic script.

## 14. Open decisions (for review)

1. **Framework name.** ✅ RESOLVED — **`phasing-flow`** (decided 2026-06-01; it carries the phasing lineage, re-platformed on workflows). Full rename of the former `flow` shorthand to `phasing-flow` across the design + matrix docs — completed in M0 ("workflow"/"Workflow" preserved as the distinct Workflow-tool term).
2. **`ultraplan` + agent-teams** — ✅ RESOLVED (2026-06-01) — **park both for now; revisit post-M2.** Agent-teams (multi-session coordination with mid-run inter-agent messaging) adds little over the in-process Workflow + orchestrator-session spine, which already gives coordination + dependent tasks at higher scale (16–1000 vs ~5 agents), lower token cost, repeatability, and gate-enforcing "no mid-run input." Its one differentiator — live mid-execution debate — is exactly what the gates-between-runs model deliberately avoids. `ultraplan` adds a cloud + GitHub dependency not justified yet. Revisit either only if a concrete need appears.
3. **Trust bar** — ✅ RESOLVED (2026-06-01) — **no-regression eval vs. baseline.** Before building the M2 engine, M1's verification quality on a fixed benchmark task must be ≥ the current human-gated baseline. (Maps to the M1 exit proof in §12.)
4. **Routines scope** — ✅ RESOLVED (2026-06-01) — **drift-check + doc-freshness as kit routines; dep-CVE as a consumer-template routine only** (the kit's own dependency surface is thin — Bash + Markdown + Actions; consumers' scaffolded projects have real trees worth scanning). Cloud scheduling accepted for detect-only (never-mutate) routines.
5. **Command surface for `phasing-flow`** — ✅ RESOLVED (2026-06-01) — **single `/phasing-flow` + verb subcommands** (`start` / `plan` / `run` / `verify` / `status` / `resume`). Smaller, more discoverable surface than a `phase-*`-style family; avoids re-introducing the count-drift class M0 is fixing.

## 15. Out of scope

- **Managed Agents API** (separate from the CLI; not a kit concern now).
- **Rewriting the security/integrity hooks** (kept verbatim).
- **Forcing consumer migration** — the framework is additive and opt-in; consumers on pinned plugin versions are never force-upgraded.
