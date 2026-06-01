# Orchestration Framework — Doc / CLAUDE.md / Config Impact Matrix

> Companion to `2026-05-30-orchestration-framework-design.md` (§11).
> Source: the `orchestration-impact-sweep` workflow — 5 parallel scanners (docs / CLAUDE.md+config / templates / specs / CI+evals) + a deterministic JS dedup + a completeness-critic pass. **101 deduped findings + 12 critic-caught misses + 18 count/version locations.**
> This is the execution checklist. Grouped by THEME (each maps to a milestone). `[CI]` = a CI workflow fails if not updated. `[local]` = machine-local, updated outside the repo PR.

## ⚠️ Theme 0 — Pre-existing drift + a broken CI gate (fix in M0, regardless of the framework)

The kit's own counts are already inconsistent across ~15 files, and one CI job already fails its own assertion. This blocks every initiative PR until reconciled to the **current actual** surface (**12 skills / 16 commands / 8 hooks**), *before* the framework changes add more.

- `.github/workflows/plugin-install-fixture.yml` `[CI]` — **BROKEN**: asserts `n_skills==11` (label "10 skills") & `n_cmds==10`; real = 12 & 16. Fix the count assertions, fix the label, **loosen the version regex `^2\.0\.[0-9]+$`** (blocks any bump), update the description-skill grep list.
- `CLAUDE.md` — §2/§4 say "9 skills / 10 commands / 7 hooks", list old `review-prototype`, omit `spec-it`/`integrate-branch`/`handoff`. Reconcile.
- `specs/14-marketplace.md` `[CI]` — "9 skills / 10 commands / 7 hooks @ v2.0.0" — all stale.
- `specs/03-hooks.md` `[CI]` — "Six hooks. Period." + 7th; `context-awareness.sh` (8th) already on disk, unlisted.
- `specs/README.md` `[CI]` — "14 specs (00-13)" range is itself stale (spec 14 exists); handoff design doc unindexed.
- `plugins/unifylabs-workflow/README.md` `[CI]` — *(critic-caught)* "The 9 phase commands", stale roster, version string **"2.0.0-pre.1"**. Highest-priority overlooked file.
- `README.md` `[CI]` — counts + Status "v2.0.0".
- `llms.txt` — badly stale: v0.1.0, deleted `bootstrap-claude-config.sh`, "6 hooks", "7 templates", lists `compound-engineering` as composed (it's opted out).
- `docs/onboarding/intro.md` — "10 skills / 10 commands / 7 hooks", "we're on v2.0.1".
- `onboarding/day-1.md` — "9 skills, 10 commands, 7 security hooks".
- `templates/optional/team-onboarding.md.template` `[CI]` — "six security hooks" (real 7→8).
- `docs/philosophy.md` `[CI]` — "six security hooks" in Principles 4 & 5.
- `templates/core/claude.md.template` `[CI]` — stale plugin attribution: claims `work-issue` ships in "superpowers + compound-engineering" (wrong — it's `unifylabs-workflow`; compound-engineering is opted out).

## Theme 1 — Context discipline → window-fraction (the live hook bug + all threshold copies)

- `plugins/unifylabs-workflow/hooks/context-awareness.sh` `[CI]` — **the live bug.** Rewrite to read harness-native `used_percentage`; drop the per-model pressure-baseline table + `UNIFYLABS_PRESSURE_BASELINE_TOKENS`; recalibrate tiers to generous bands. (M0 fixes the bug; the full rewrite can ride M0 or M2.)
- `plugins/unifylabs-workflow/skills/handoff/references/tier-logic.md` — replace pressure-baseline denominator with window-fraction; drop 500k/150k table; recalibrate FULL/LEAN/EMERGENCY cutoffs.
- `plugins/unifylabs-workflow/skills/handoff/SKILL.md` `[CI]` — recalibrate every context-% threshold; (also Theme 2 narrowing).
- `docs/methodology.md` `[CI]` §H — replace 50/70/90 + prompt-cache-TTL rationale with window-fraction; `/effort xhigh` → `/effort ultracode`.
- `specs/07-philosophy-and-methodology.md` `[CI]` §G — same recalibration (carries the rationale AC).
- `specs/02-templates.md` `[CI]` — cheatsheet context-threshold line.
- `templates/core/cheatsheet.md.template` `[CI]` — `## Context thresholds` table; soften "90%+ hallucinates".
- `plugins/unifylabs-workflow/statusline/statusline.sh` `[CI]` — already reads `used_percentage` (the reference impl); optionally align 70/90 color cutpoints.
- `plugins/unifylabs-workflow/hooks/test/fixtures/transcript-{35,45,55,70}pct.jsonl` — regenerate for window-fraction; **no opus-4-8 fixture exists** — add one.
- `plugins/unifylabs-workflow/hooks/test/test-context-awareness.sh` — rewrite assertions (percentages, tier thresholds, reminder-copy substrings); add opus-4-8 case.
- `plugins/unifylabs-workflow/skills/handoff/evals/handoff-evals.json` — recalibrate scenario context-% + tier-evidence bands.
- `plugins/unifylabs-workflow/skills/handoff/references/resume-protocol.md` — update the cross-ref describing the hook's "model→window mapping / token computation".
- `specs/2026-05-23-handoff-skill-design.md` — add opus-4-8/[1m] arm to the model→window table; recalibrate 40/50/60/70 + FULL/LEAN/EMERGENCY.

## Theme 2 — Handoff narrowing → cross-session / provenance only

- `plugins/unifylabs-workflow/skills/handoff/SKILL.md` `[CI]` — narrow scope; native compaction owns within-session rescue; trim "context rescue / convo getting long" framing & discretion bands.
- `specs/2026-05-23-handoff-skill-design.md` — strike within-session-rescue rows of the gap matrix.
- `plugins/unifylabs-workflow/skills/handoff/references/{core-shape,mode-detection,addendum-phasing-orch,addendum-phase-exec}.md` + `scripts/detect-mode.sh` — *(critic-caught)* mode/shape refs tied to within-session-rescue + phasing model.
- `docs/cutover-handoff-v2.0.3.md` — central premise (mid-flight handoff as rescue) obsolete; add "superseded" banner; F4's denominator fix is now subsumed by the window-fraction move.

## Theme 3 — Subagent-stance revision (native subagents under human decision-gates)

- `docs/philosophy.md` `[CI]` — Principle 2 "stay in the loop instead of dispatching subagents" framing; reference the `phasing-flow` engine.
- `templates/core/cheatsheet.md.template` `[CI]` — Appendix A reviewer-as-subagent framing (already pro-subagent-under-gate; align wording).
- `templates/core/ai-usage-charter.md.template` `[CI]` — §4 reviewer-agent invocation; verify no contradiction.
- (Engine skills in Theme 6 also dispatch subagents — reconcile there.)

## Theme 4 — Native worktrees (EnterWorktree) replace hand-rolled plumbing + "main always on master"

- `plugins/unifylabs-workflow/skills/work-issue/SKILL.md` `[CI]` — Phase 2 worktree plumbing + "main always on master" rule.
- `plugins/unifylabs-workflow/skills/integrate-branch/SKILL.md` `[CI]` — `git worktree add --detach`/remove + on-master refusal.
- `plugins/unifylabs-workflow/skills/spec-it/SKILL.md` `[CI]` — `git worktree add -b spec/...`.
- `plugins/unifylabs-workflow/skills/iterative-review/references/worktree-handling.md` — *(critic-caught)* the concrete EnterWorktree migration target (preflight/divergence/cleanup plumbing).
- `docs/methodology.md` `[CI]` §D, `specs/10-sdd-layer.md` `[CI]`, `specs/13-claude-md-enrichment.md` `[CI]`, `templates/core/claude.md.template` `[CI]` — `gh issue develop … --base main` / branch-naming worktree convention.
- `templates/claude-runtime/.claude-settings.json.template` `[CI]` — add a worktree permission entry if EnterWorktree needs one.

## Theme 5 — Workflow-engine + /goal adoption (the engine skills)

- `plugins/unifylabs-workflow/skills/work-issue/SKILL.md` `[CI]` — adopt engine + `/goal` verify; re-point Phase 3.5 `--no-phase` / phasing auto-detect at `/workflow`.
- `plugins/unifylabs-workflow/skills/spec-it/SKILL.md` `[CI]` — adopt engine + `/goal`; update phasing refs.
- `plugins/unifylabs-workflow/skills/iterative-review/SKILL.md` `[CI]` — re-implement as enforced loop-until-dry Workflow; reconcile subagent dispatch + phasing-integration.
- `plugins/unifylabs-workflow/skills/iterative-review/references/phasing-integration.md` — *(critic-caught)* re-point "phase mode" at `phasing-flow`.
- `plugins/unifylabs-workflow/skills/integrate-branch/SKILL.md` `[CI]` — 6-agent audit → typed `parallel()`; + `/goal`.
- `specs/10-sdd-layer.md` `[CI]`, `templates/core/specs/README.md.template` `[CI]`, `templates/core/issue-templates/*.yml.template` `[CI]`, `templates/core/pull-request-template.md.template` `[CI]` — `/work-issue` phase/verification references (confirm front-door command names survive).

## Theme 6 — Phasing deprecation (M5; keep installed until migration)

- `plugins/unifylabs-workflow/skills/phasing/SKILL.md` `[CI]` — add deprecation pointer to `/workflow` + EnterWorktree; do **not** remove.
- `plugins/unifylabs-workflow/skills/phasing/references/{master-plan-shape,phase-spec-shape,checkpoint-shape,handoff-shape,verification-types,archive-policy,github-mode-commands}.md` — *(critic-caught, 7 files)* run.json/fresh-session model.
- `plugins/unifylabs-workflow/commands/phase*.md` — *(critic-caught, 10 files)* per-command docs for the deprecated orchestration.
- `plugins/unifylabs-workflow/skills/phasing/scripts/{launch-terminal.sh,archive-run.sh}` + `scripts/test/test-launch-terminal.sh` — retire with phasing.
- `plugins/unifylabs-workflow/skills/phasing/evals/{orchestrator-evals,phase-executor-evals}.json` — *(critic-caught)* phasing evals.
- `.claude/phasing/2026-05-04-unify-kit-v0.1/` — *(critic-caught)* live `[local]` run-state (gitignored).
- `.gitignore` — add ignore for the new `phasing-flow` run-state dir; keep `.claude/phasing/` until migration.
- `~/.claude/CLAUDE.md` `[local]` — the "Phasing check after plan generation" gate references the phased-execution skill / "/phase it"; retarget at `phasing-flow`; recalibrate the context-rot rationale (1M + compaction weaken it); extend the tool-suggestion section with the new primitives.
- `docs/curated-plugins.md` — update the compound-engineering opt-out rationale (cites "this kit's phasing skill").
- `specs/06-onboarding-curriculum.md` `[CI]` *(critic-caught)*, `docs/onboarding/intro.md`, `onboarding/{day-1,day-30,week-1}.md` — `/phase` narrative → `phasing-flow`.
- Historical (flag-only, do **not** rewrite; annotate "superseded"): `docs/audit/{current-stack-inventory,gap-analysis,recommendations,framework-deep-dive,spec-review-2026-05-03}.md`.

## Theme 7 — New capabilities (M4)

- `specs/09-kit-ci.md` `[CI]` — confirm new skill/commands/hook fall in existing CI scopes; extend changelog/lint globs if `/workflow-library` or routines add artifact dirs.
- `.github/workflows/{lint,scrub-check}.yml` `[CI]` — new hook scripts auto-shellchecked (good); new `{{PLACEHOLDER}}` must be added to scrub-check's 20-entry vocab; skill `scripts/*.sh` are outside the shellcheck glob (pre-existing gap).
- `templates/claude-runtime/.mcp.json.template` + `.mcp.json.examples.md` — only if any primitive ships as an MCP server (confirm harness-native).

## Theme 8 — Governance (every milestone PR)

- `CHANGELOG.md` `[CI]` — `[Unreleased]` entry per PR (Added/Changed/Deprecated); changelog-check fails otherwise.
- `docs/decisions/000N-*.md` + `docs/decisions/README.md` — new ADR(s): phasing-flow adoption, subagent-stance reversal, native worktrees, major version bump. (ADR 0001 is immutable — don't edit.)
- `UPGRADING.md` — new top-level migration section if the bump is major (phasing-stays-installed, engine adoption, worktree behavior change, renamed commands).
- `BACKLOG.md` — add the phasing-flow rollout / workflow-library / routines / phasing-deprecation items; move shipped items out.
- `CONTRIBUTING.md` — reconcile stale trigger path "hooks/" (now `plugins/`).
- `specs/01-repo-structure.md` `[CI]` *(critic-caught)*, `specs/08-living-docs-and-decision-log.md` `[CI]` (governance touchpoint — deprecation needs a `### Deprecated` entry + ADR).

## Theme 9 — Counts & version (consolidated — all must move together)

`plugin.json` (version + counts + skill list) → `marketplace.json` (byte-identical mirror) → `plugin-install-fixture.yml` (assertions + regex) → `dev-symlink-skills.sh` (SKILLS/COMMANDS arrays + comments) → `CLAUDE.md` → `specs/{14,03,02,README,01}.md` → `README.md` → `docs/onboarding/intro.md` → `onboarding/day-1.md` → `llms.txt` → `templates/optional/team-onboarding.md.template` → `docs/philosophy.md` → `templates/core/cheatsheet.md.template` → `hooks.json` (the "8 hooks" source-of-truth). `scripts/{check-drift,audit-scan,init-project}.sh` are count-agnostic (enumerate dynamically) — no edit, but `check-drift` needs the symlinks re-created for any new skill.

## Theme 10 — Also flag (opportunistic)

- `github-actions/{claude-code-review.yml,README.md,prompts/code-review.md}` + `specs/04-github-actions.md` — *(critic-caught)* model pin `claude-opus-4-7`; opportunistic bump.

## Reviewed & excluded (no change — false positives)

`templates/core/mcp-policy.md.template` (generic "worktree" sandboxing), `templates/core/security-checklist.md` (kit-author provenance comment, stripped on install), `.markdownlint.json`, `scripts/test-fixtures/init-project/partial/CLAUDE.md`, `scripts/test-fixtures/settings.json.{good,bad}-fixture`, `scripts/{audit-scan,init-project}.sh`, `docs/decisions/0001-hook-bundle-licensing.md` (immutable ADR).
