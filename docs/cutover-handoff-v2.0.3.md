# Cutover playbook — handoff v2.0.3

> **Superseded (2026-06-01).** This playbook's central premise — mid-flight `/handoff` as a *within-session* RESCUE for context pressure — is obsolete. Native compaction now owns within-session rescue, so the handoff skill is narrowing to cross-session / provenance transfer rather than in-session pressure relief. F4's per-model denominator fix below is also subsumed by the window-fraction move (context % is now the harness-native fraction of the full window, not a transcript-token sum against a 200K/1M denominator). Retained as a historical record of the v2.0.3 cutover; do not action the within-session-rescue framing.

**Audience**: kit author (Tomer) + future readers performing per-orchestrator cutover on an in-flight phasing run from pre-v2.0.3 (≤ 2.0.1) to post-v2.0.3 of `unifylabs-workflow`.

**When to cut over**: at a natural break — between phases, no phase `in_progress`. NOT mid-execute. Cutover at the wrong moment risks losing executor state.

**What v2.0.3 unlocks for an orchestrator**: mid-flight `/handoff` (so context-pressure rescue no longer means re-entering everything), the `context-awareness.sh` hook that injects threshold-aware reminders on `UserPromptSubmit` + `SessionStart`, the `⏸ CHECKPOINT` status block variant, and the `/phase-continue` command for the phase-executor mid-flight gap.

---

## 0. Prerequisites — one-time machine setup (NOT per-orchestrator)

Cutover assumes the new skill, hook, and slash commands are reachable from a fresh Claude session. Today (post-v2.0.3 commit, pre-marketplace-refresh) they may not be. Walk this checklist once before your first cutover; skip on subsequent ones.

### 0a. Refresh the `unifylabs-workflow` plugin install source (HIGH IMPACT)

The legacy install source `unifylabs-claude-marketplace@0.1.0` is cached at `~/.claude/plugins/cache/unifylabs-claude-marketplace/unifylabs-workflow/0.1.0/` and does **not** contain `context-awareness.sh`, the 5 `/handoff*` commands, or `/phase-continue`. Refresh by re-pointing at the live `unify-kit` marketplace:

```bash
# In a Claude session (slash commands):
/plugin uninstall unifylabs-workflow
/plugin marketplace add github.com/unifylabs-dev/unify-kit
/plugin install unifylabs-workflow
```

Verify in a fresh session: `/help` lists `/handoff`, `/handoff-resume`, `/handoff-list`, `/handoff-done`, `/handoff-revive`, `/phase-continue`. If they appear, 0a is done.

### 0b. Per-skill symlink reconciliation (MEDIUM IMPACT, optional for first cutover)

`~/.claude/skills/handoff` already resolves to `~/Projects/unify-kit/...` (P9 created the targeted symlink). Six other skills (`analyze-comms`, `iterative-review`, `phasing`, `promote-to-marketplace`, `ship`, `work-issue`) may still resolve to the legacy `~/Projects/claude-marketplace/...` clone. Confirm with:

```bash
for s in analyze-comms iterative-review phasing promote-to-marketplace ship work-issue handoff; do
  printf '%-25s → %s\n' "$s" "$(readlink ~/.claude/skills/$s 2>/dev/null || echo 'MISSING')"
done
```

If `phasing` still resolves to `claude-marketplace`, the post-cutover orchestrator will load the **pre-v2.0.3 phasing skill** — `/handoff` itself still works (handoff is its own skill, separately symlinked), but the `⏸ CHECKPOINT` variant + checkpoint polling won't render. Two paths to fix:

- **Targeted swap**: `ln -sfn ~/Projects/unify-kit/plugins/unifylabs-workflow/skills/phasing ~/.claude/skills/phasing`
- **Full migration**: `~/Projects/unify-kit/scripts/dev-symlink-skills.sh` (kit-author script, swaps all `~/.claude/skills/*` to unify-kit). Out of scope for any single cutover.

---

## 1. Pre-cutover checklist (per orchestrator)

Run for **each** orchestrator you intend to cut over. The non-empty case means an executor is mid-flight — wait.

```bash
RUN_DIR=~/Projects/<project>/.claude/phasing/<run-id>
jq '.phases[] | select(.status == "in_progress")' $RUN_DIR/run.json
# Should be empty. If non-empty, wait until that phase lands its handoff;
# do NOT proceed. (See §3 for the in-flight-executor handling.)
```

Enumerate all candidate runs on this machine in one shot:

```bash
find ~/Projects -path '*/.claude/phasing/*/run.json' -not -path '*/archive/*' -exec sh -c '
  s=$(jq -r .overall_status "$1")
  p=$(jq -r ".phases[] | select(.status == \"in_progress\") | .n // \"none\"" "$1" | head -1)
  [ "$s" = "in_progress" ] && echo "$(jq -r .run_id "$1") | in_progress phase: ${p:-none}"
' sh {} \;
```

A row with `in_progress phase: none` is cutover-eligible **now**.

---

## 2. Step-by-step cutover (the 13-step procedure)

Mirrors design spec §10.2 with the v2.0.3-specific behaviour folded in.

1. **In the OLD orchestrator session**, type `/handoff`. The handoff skill loads from disk on invocation, so it works in pre-v2.0.3 sessions as long as `~/.claude/skills/handoff` already resolves to unify-kit (see §0b).
2. The skill's `detect-mode.sh` returns `mode: phasing-orchestrator` (the cwd has a `.claude/phasing/<run-id>/run.json` and the session has been polling for handoffs). It writes the 7-section universal core + the `phasing-orchestrator` addendum (§6.1 of the handoff skill) to `<run-dir>/session-handoff-<YYYY-MM-DD>.md`. This addendum captures the load-bearing context that `/phase-resume` alone cannot recover: mid-conversation locks, direction changes during the run, self-healing-menu decisions, recent founder-input deltas.
3. The skill appends a `Pending handoff` pointer to `MEMORY.md` at the project root (creates `MEMORY.md` if missing).
4. Kill the OLD orchestrator terminal (`exit` or Cmd-W). It is now safe to do so — the run state is on disk, the handoff is on disk, the MEMORY.md pointer is in place.
5. Open a FRESH terminal in the same project: `cd <project-root> && claude`.
6. The `SessionStart` hook (`context-awareness.sh`) scans `MEMORY.md`, detects the pending pointer, and injects an ask-to-resume reminder into Claude's initial context.
7. Claude responds by calling `AskUserQuestion`: *"Pending handoff detected: \<topic\>. Created \<ago\>. Mode: phasing-orchestrator · Tier: \<tier\>. Resume?"* with 3 options (Resume now / Not this session / Mark consumed). Pick **Resume now**.
8. The skill runs `freshness-check.sh` against §4 World state in the handoff. Expected outcome: `clean` (no git changes since handoff write). If `drift_detected`, the diff is surfaced for your decision. If `fatal` (the working tree has diverged unrecoverably), the skill refuses auto-resume — see §4 Safety net.
9. The skill runs `recreate-tasklist.sh`, which emits TaskCreate lines that Claude executes to rebuild the TaskList spinner state to what the OLD session had.
10. The skill flips the handoff's frontmatter atomically: `status: pending → consumed`. The MEMORY.md pointer is dropped on the next idempotent SessionStart scan.
11. Claude reads §7 (*Resume instructions*) of the handoff and continues the session — picking up the `[in_progress]` task from §5, respecting every §2 lock and §6 do-not-re-open entry.
12. Type `/phase-resume <run-id>`. This re-renders the Resume status-block variant of the phasing skill and re-establishes the background polling loop for phase handoffs. (`/handoff` captured the conversational context; `/phase-resume` re-grounds the orchestrator's poll-and-wait infrastructure.)
13. The cut-over orchestrator now has full v2.0.3 functionality: `/handoff` works mid-orchestrator at any future context-pressure moment, the `⏸ CHECKPOINT` card variant renders if any phase executor produces a `phase-N-checkpoint.md`, and the 4-option menu fires on checkpoint detection.

---

## 3. In-flight executor handling

If a phase is currently `in_progress` when you want to cut over, do **not** kill the orchestrator. Wait for the executor to land its handoff (the orchestrator's poll will pick it up; the post-phase card will render). Then cut over BEFORE spawning the next phase. Spawning new phases under the OLD orchestrator after deciding to cut over is wasted work — the next phase will run under whichever orchestrator dispatched it.

If the executor is genuinely stuck (no handoff after `~20 min` of the long-running warning), use `/phase-retry <N>` from the OLD orchestrator first, OR `/phase-abort` if the run as a whole should stop. Cutover is the wrong tool for a stuck executor.

---

## 4. Safety net

If cutover fails partway through — most commonly `freshness-check.sh` returning `fatal` with no recovery path — restore prior phasing skill behaviour:

```bash
cd ~/Projects/unify-kit
git checkout HEAD~1 -- plugins/unifylabs-workflow/skills/phasing/SKILL.md
```

(Or `git checkout v2.0.1 -- plugins/unifylabs-workflow/skills/phasing/SKILL.md` if the v2.0.3 commit isn't the immediate predecessor.)

The `session-handoff-<date>.md` written in step 2 stays on disk regardless — nothing destructive happens. You can retry cutover later by re-opening a fresh terminal; the MEMORY.md pointer is still live (or by `/handoff-revive <path>` if it was accidentally marked consumed).

---

## 5. Verification of successful cutover

In the new orchestrator session, confirm:

- Typing `/handoff` auto-completes (the slash command is in `/help`). No need to actually invoke.
- Typing `/phase-continue` auto-completes.
- Above 40% context, Claude surfaces the discretion-table reminders from the context-awareness hook (per the SKILL.md §"Discretion rules" table). Below 40% the hook is silent — that's correct, not broken.
- `/phase-status <run-id>` renders the standard Resume / post-phase variant for your run.

---

## 6. Lessons learned

Populated from real cutover walkthroughs. Append to this section after each one with the date + observations + any deviation from the procedure above.

### 2026-05-25 — P11 attempted cutover of `wealth-portal/2026-05-16-icon-portal-discovery`

Partial cutover. Step 1 (`/handoff` write) succeeded; steps 2–13 blocked at infrastructure layer. 5 distinct findings — each is a candidate for a follow-up fix-phase.

**F1 — v2.0.3 was never published to the install source.** The most load-bearing finding. `/plugin install unifylabs-workflow@unify-kit` clones from `origin/main`, which was still at v2.0.1 (`docs/onboarding-intro` carrying v2.0.3 was unpushed AND diverged from main). The freshly-installed cache thus shipped v2.0.0/v2.0.1 content with NO `context-awareness.sh` and NO new hooks.json entry. The SessionStart hook chain could not fire the resume prompt because the hook itself was never installed. **Playbook gap**: §0a (refresh plugin install) presupposed v2.0.3 was reachable from origin/main. Add a §0c prerequisite: "merge the v2.0.3 release branch to main and push origin/main BEFORE running §0a." Without it, §0a is a no-op.

**F2 — README's documented `/plugin marketplace add` syntax is malformed.** `README.md` shows `/plugin marketplace add github.com/unifylabs-dev/unify-kit`, but Claude Code's CLI prepends `github.com/` to any non-URL input, so the value becomes `https://github.com/github.com/unifylabs-dev/unify-kit.git/` → 404. Correct syntax: `/plugin marketplace add unifylabs-dev/unify-kit` (owner/repo, no protocol). **Fix-phase**: update README.md install instructions; same for any other consumer-facing docs that quote the wrong form.

**F3 — `/plugin uninstall <name>` doesn't reach user-scope installs.** With the plugin installed at user scope (`installed_plugins.json` key `unifylabs-workflow@unifylabs-claude-marketplace`), `/plugin uninstall unifylabs-workflow` errors with "not installed in this project." The slash command appears scoped to project-level installs. Workaround for the playbook: install the new source side-by-side using the source qualifier (`/plugin install unifylabs-workflow@unify-kit`), let the new entry coexist with or supersede the legacy entry. Add to playbook §0a.

**F4 — handoff skill's context-% reading diverges from Claude Code UI by ~22pts.** On a session the UI showed at 38%, the skill computed ~60% and selected LEAN tier (50–64% band). Most likely cause: Opus 4.7 [1m] (1M context window variant) is not accounted for in `tier-logic.md`'s denominator — the transcript-token-sum logic probably assumes a 200K window. The LEAN handoff at 137 lines was still functionally correct (7-section core present at every tier), but the calibration is wrong. **Fix-phase**: extend `detect-mode.sh` and/or the inline tier computation to read `model` from `transcript_path` records and adjust the denominator. Cross-reference design spec §7.1.

**F5 — handoff skill claims to add MEMORY.md pointer when target file is missing.** On a project with no existing `MEMORY.md`, the skill returned `MEMORY.md pointer | added at top` in its confirmation table, but `MEMORY.md` was never created. SKILL.md's edge-case table explicitly contracts: "MEMORY.md doesn't exist yet | Skill creates with index header on first handoff write" — that contract is unmet. The pending handoff doc was on disk and structurally correct, but the resume-detection chain (which depends on the MEMORY.md pointer being scanned by `context-awareness.sh`) had no entry to find even if the hook had been installed. **Fix-phase**: audit the skill's MEMORY.md write step; ensure the `create-if-missing` branch actually executes the write.

**Procedural takeaways for the playbook itself.**
- §0 needs a §0c "publish v2.0.3 to origin/main first" before §0a/§0b are meaningful. Without v2.0.3 actually being installable, the rest of the procedure is theater.
- The `/handoff` slash-command-vs-skill-trigger distinction matters: in this cutover, `/handoff` autocompleted via the skill-trigger path (`~/.claude/skills/handoff` symlink) even though the plugin slash command was uninstalled. That made it look like the cutover was further along than it actually was. Add a step-1 verification: "after writing the handoff, confirm MEMORY.md actually exists and contains the pointer line. If not — STOP."
- Cutover is more brittle in the first-ever-cutover state (new project, no prior MEMORY.md, no prior handoff infra) than in the steady-state. A first-cutover prereq sub-section may be worth adding.

**Recovery state at handoff write.** Branch `docs/onboarding-intro` pushed to origin at HEAD `ff341b3`. wealth-portal `MEMORY.md` was manually created during the attempt with a single pending-handoff pointer to `session-handoff-2026-05-25.md` (kept for the next cutover attempt; the pointer was real, MEMORY.md was the missing piece). wealth-portal's pre-v2.0.3 orchestrator is still the source of truth for that run; cutover should be retried after F1 is resolved (merge to main + push origin/main).

