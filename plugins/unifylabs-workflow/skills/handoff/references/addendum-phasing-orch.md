# §8.A — Phasing-orchestrator addendum (the load-bearing one)

**Read when**: `detect-mode.sh` returns `mode: phasing-orchestrator`. This addendum stacks on the 7-section core (per `references/core-shape.md`) as §8 of the resulting handoff.

This is the **load-bearing addendum**. The fields here capture conversational nuance that `/phase-resume` alone cannot recover — the mid-conversation locks, direction changes pending application, and continuous-improvement queue that exist only in the orchestrator session's working memory until a handoff bakes them into a document. A `/phase-resume` without one of these handoffs reconstructs `run.json` state correctly but loses every decision the user made mid-conversation between phase boundaries. That loss is the difference between a clean resume and a hallucination-laden one.

The sub-section structure is fixed. Tier (FULL / LEAN / EMERGENCY) compresses prose density within each sub-section but does not drop sub-sections. Two sub-sections — **Mid-conversation locks** and **Direction changes pending application** — are **NEVER trimmed at any tier**.

---

## 8.A.1 Run state pointers

Concrete pointers to the run's artifacts. Drives `freshness-check.sh`'s `run_json_check` sub-block validation.

**Template:**

```markdown
### 8.A.1 Run state pointers

- **run_id:** <run-id>
- **run.json path:** <abs-path>
- **Master plan:** <abs-path or tracking-issue URL>
- **Mode:** github | file
- **Tracking issue:** <#N or "—" if file mode>
- **Orchestrator session name:** <name; e.g., `orchestrator-<topic>`>
```

---

## 8.A.2 Phase progress (lifted verbatim from run.json)

Snapshot of the `phases[]` array at handoff time. Resume session compares against current `run.json` to detect drift.

**Template:**

```markdown
### 8.A.2 Phase progress

| N | Name | Status | Handoff |
|---|---|---|---|
| 0 | <name> | complete | <URL or path or "—"> |
| 1 | <name> | complete | <URL or path or "—"> |
| 2 | <name> | in_progress | — |
| 3 | <name> | pending | — |
| 4 | <name> | pending | — |
```

Lift the phase list verbatim from `run.json.phases[]`. Don't paraphrase status values — `pending` / `in_progress` / `complete` / `failed` / `checkpoint` (last added in P5+P6 of run `2026-05-24-handoff-skill-build`).

---

## 8.A.3 Orchestrator state at handoff

What the orchestrator was *doing* when context pressure forced the handoff. The enum disambiguates: a "between phases waiting for approval" handoff is very different from a "mid-self-healing for a failing phase" handoff, even though both render as `phases[N].status: complete` and `phases[N+1].status: pending` in `run.json`.

**Template:**

```markdown
### 8.A.3 Orchestrator state at handoff

- **Currently doing:** between-phases | mid-brainstorm-for-P<N+1> | in-self-healing | polling | other:<one-line>
- **Background poll state:** active polling phase <N> | not polling | polling crashed
- **Last status block rendered:** <variant name, e.g., post-phase | run-start | resume | aborted | checkpoint>
- **Pending AskUserQuestion (if any):** <one-line — what menu is in flight, what user input is awaited>
```

Field discipline: name the actual state, not the desired state. If the orchestrator was about to spawn P5 but hadn't yet, that's `between-phases`. If the orchestrator had spawned P5 and was polling, that's `polling`. If the orchestrator had picked up P5's handoff and was rendering the post-phase card, but hadn't yet fired the approval AskUserQuestion, the pending question is `null` and the state is the moment after the card render.

---

## 8.A.4 Mid-conversation locks not yet in any file (LOAD-BEARING — NEVER trimmed at any tier)

**The load-bearing sub-section.** Decisions made during conversation since the last phase wrapped — not yet baked into specs, master plan, or any other artifact. If this section is dropped or paraphrased, the resume session will see `run.json` and the master plan, and have no idea that the user already decided things mid-conversation that bind future phases.

**Field discipline (lift exactly):**

```markdown
### 8.A.4 Mid-conversation locks not yet in any file

- **<decision>** — <why> · <where it should land: master plan §X | phase-<N+1> spec | new ADR | inline in next phase's plan>
- **<decision>** — <why> · <where it should land>
- **<decision>** — <why> · <where it should land>
```

Each entry is one bullet, three parts. The "where it should land" suffix is the action item — the resume session knows to apply the lock to that destination before continuing.

**NEVER trimmed at any tier.** This is the differentiator. EMERGENCY tier still carries this sub-section in full.

If no mid-conversation locks exist (e.g., the orchestrator wrote the handoff immediately after the last phase's approval, no conversation since), write:

```markdown
### 8.A.4 Mid-conversation locks not yet in any file

_No mid-conversation locks. Last activity was approving phase <N>; nothing since._
```

But never omit the section header — its presence is what the resume session looks for.

---

## 8.A.5 Direction changes pending application (NEVER trimmed at any tier)

Cousin of §8.A.4: decisions the user articulated mid-conversation that are *changes* to existing spec or master-plan content, not new locks. Distinction: a lock is "we will do X"; a direction change is "the spec says X but the user said Y; the spec needs updating before the next phase reads it".

**Field discipline:**

```markdown
### 8.A.5 Direction changes pending application

- **user-said-X-about-phase-<N+1>** — <quote or paraphrase of what the user said> · <what currently says-otherwise, e.g., `phase-<N+1>-spec.md` step 3 still says X> · <edit needed before P<N+1> spawn: <specific edit>>
- **user-said-Y-about-run-end-verification** — <quote> · <master plan's run-end verification still lists Y> · <edit needed>
```

**NEVER trimmed at any tier.** Same reasoning as §8.A.4 — losing a direction change at resume time means the resume session reads a stale spec and proceeds on the wrong basis.

If no direction changes pending, write:

```markdown
### 8.A.5 Direction changes pending application

_No direction changes pending. Specs and master plan reflect current user intent._
```

---

## 8.A.6 Continuous-improvement queue

Candidates for the run-end continuous-improvement surface (per `phasing/SKILL.md` "Continuous improvement" section). Collected during the run as friction or wins worth flagging back to the user at run-end.

**Template:**

```markdown
### 8.A.6 Continuous-improvement queue

- **<candidate>** — <friction or win observed> · <proposed fix: e.g., edit to phasing SKILL.md, new skill, new hook>
- **<candidate>** — <observation> · <proposed fix>
```

Without this sub-section, the queue is lost when the orchestrator session ends — `/phase-resume` cannot recover it (it's not in `run.json`). Carrying it through the handoff preserves the run-end surface.

LEAN: same shape, prose trimmed. EMERGENCY: drop "proposed fix" half if needed; keep "candidate" identifiers so the user can ask about each one explicitly.

---

## 8.A.7 Self-healing state (conditional)

Only included if the orchestrator was in the middle of `phasing/SKILL.md` §9.3 self-healing flow when context pressure hit. Otherwise the sub-section header is included with an "n/a" body.

**Template (when self-healing is in flight):**

```markdown
### 8.A.7 Self-healing state

- **Failing step:** <verification step that did not pass; lifted from phase handoff>
- **Investigation status:** <what's been checked so far, what's left>
- **Proposed fix surfaced yet:** yes (one-line: <fix>) | no
- **Self-healing menu state:** <which option is the current default, what the user has indicated>
```

**Template (when no self-healing):**

```markdown
### 8.A.7 Self-healing state

_n/a — no self-healing flow in progress._
```

---

## 9. Tier notes (cross-cutting)

| Sub-section | FULL | LEAN | EMERGENCY |
|---|---|---|---|
| 8.A.1 Run state pointers | Full | Full | Full |
| 8.A.2 Phase progress | Full table | Full table | Full table |
| 8.A.3 Orchestrator state at handoff | Full prose | Bullets only | Bullets only |
| 8.A.4 Mid-conversation locks | Full | Full (**NEVER trimmed**) | Full (**NEVER trimmed**) |
| 8.A.5 Direction changes pending | Full | Full (**NEVER trimmed**) | Full (**NEVER trimmed**) |
| 8.A.6 Continuous-improvement queue | Full | Compress proposed-fix half | Identifiers only |
| 8.A.7 Self-healing state | Full | Full | Full |

The two **NEVER trimmed** sub-sections (8.A.4 and 8.A.5) are the load-bearing differentiator. The wealth-portal session-handoff masterclass (referenced in the design spec inputs) demonstrated that resumes which lost these two sub-sections produced hallucination-laden continuations; resumes that carried them produced clean continuations. Honor this rule in every tier.
