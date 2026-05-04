# Spec Review — `unify-kit` v0.1 Specs

> Date: 2026-05-03
> Reviewers (parallel): `dhh-rails-reviewer`, `kieran-rails-reviewer`,
> `code-simplicity-reviewer`
> Specs reviewed: `specs/00` through `specs/08` plus `specs/README.md` (10 files)
> Output of: Phase A + B of the Spec Hardening Pass plan

---

## Summary

**Total raw findings:** 85 across three reviewers.
**Deduplicated unified findings:** 47.
**Severity breakdown:** 14 must-fix · 23 should-fix · 10 can-skip.

**Reviewer consensus (unanimous = 3/3 reviewers flagged the same theme):**

- ⭐⭐⭐ Project-name decision unproposed in spec 00 (now resolved by user: `unify-kit`)
- ⭐⭐⭐ Decision-fork theater across most specs (alternatives that no one would pick)
- ⭐⭐⭐ Stretch / v2 content bloating v1 specs (especially 03, 04, 05)
- ⭐⭐⭐ Untestable acceptance criteria in specs 02, 04, 06, 08
- ⭐⭐⭐ Missing specs for kit's own CI and `examples/`

**Major themes (2/3 reviewers):**

- Naming / terminology drift across specs (placeholder syntax, filename canon, command lists)
- Settings-merge semantics underspecified
- Phantom `claude-test-hook` helper with no owner
- Missing sync / upgrade flow
- Public-readiness checklist not specified
- Onboarding curriculum has untestable gates

**Net read** (from the three reviewers in their own words):

> *DHH:* "This kit is mostly composed correctly. The specs over-deliberate. There are too many *Decisions needed* forks where the right answer is already in the recommendation."
>
> *Kieran:* "A genuinely well-structured spec set: consistent shape, decisions surfaced, scope boundaries explicit. The flaws are concentrated in (a) terminology drift between specs, (b) acceptance criteria that quietly hand-wave at runtime behavior, and (c) one or two structural gaps."
>
> *Simplicity:* "The dominant smell is stretch/v2/opt-in hedging baked into v1 specs. Cutting all of it would shrink the spec set by an estimated 15–20% with zero loss to v1."

**Phase-readiness verdict:** Currently **NOT** ready for `/phase`. Resolving the
12 unanimous-or-major findings would close that gap.

---

## How to triage

Read the **Findings table** below. Reply with one of:

- **"Apply all must-fix"** — I revise specs to address every must-fix automatically.
- **"Apply must-fix + R-NNN, R-MMM"** — must-fix + selected should-fix items.
- **"Apply R-NNN, R-MMM only"** — just the items you call out.
- **Per-finding direction** — for any finding where you disagree with the proposed
  fix, write `R-NNN: <your direction>`.

Foundational decisions (project name, license, audience tier, stack flavor) **stay
deferred** to the next planning pass per the hardening plan, except where this
review resolves them automatically (e.g., R-001 closes the name fork).

---

## Findings table

| ID | Spec | Type | Sev | Reviewers | Description | Proposed fix |
|---|---|---|---|---|---|---|
| **R-001** | 00 | weak-rec | must-fix | DHH KIE CSR | Spec 00 lists 9 project-name options without recommending one. The kit name is the most foundational decision and gates every cross-reference. | Apply user's choice `unify-kit` as the spec 00 default; demote the rest to one-line "alternatives considered" footnote. Decision #1 closed. |
| **R-002** | 00 | weak-rec | should-fix | KIE CSR | Decision #3 (license) recommends MIT+CC0+CC BY-SA but enumerates 3 alternatives. Two are clearly wrong (all-MIT mismatched with our CC BY-SA reuses; all-CC0 unusual for code). | Drop the alternatives bullet. Keep the recommendation as the convention. Confirm-or-veto only. |
| **R-003** | 00, 01, 02, 06, 08 | scope | must-fix | CSR (KIE adjacent) | "Audience tier" (T1/T2/T3) appears in 5+ specs as an abstraction over a binary decision: "scrubbed for public release or not?" Three states are speculative generality. | Collapse to a single binary in spec 00: "v1 ships scrubbed for public adoption" (or "v1 stays internal"). Remove tier vocabulary from specs 01, 02, 06, 08 references. |
| **R-004** | 00, 02 | dep-gap | should-fix | DHH KIE | Spec 00 decision #4 ("stack flavor strategy") and spec 02 decision #2 ("one CLAUDE.md flavor or several") are the same decision in two places. Will drift. | Resolve once in spec 00. Add explicit "Depends on: spec 00 §4" header to spec 02 decision 2. Same pattern fix needed for spec 03 #2 and spec 05 #3 (cross-platform duplication). |
| **R-005** | 02 | weak-rec | should-fix | DHH KIE CSR | Decision #1 (placeholder syntax) lists 4 alternatives where `{{NAME}}` is obviously correct (greppable, Mustache convention, no shell/HTML/Python collision). Inside spec 02, `llms.txt.template` *also* uses `<N>` for prose (`/work-issue <N>`) — invites consumer confusion. | Pin `{{NAME}}` as the only placeholder syntax. Reserve `<...>` for *prose* convention only ("`<N>` means an integer issue number"). Drop alternatives. |
| **R-006** | 02, 06 | contradiction | must-fix | KIE | Filename canon drifts: spec 02 has `TEAM_ONBOARDING.md.template` / `MCP_POLICY.md.template` / `SECURITY_CHECKLIST.md` (no `.template`) / `CHEATSHEET.md.template` / `AI_USAGE_CHARTER.md.template`. Spec 06 references `templates/CHEATSHEET.md` (no suffix). Mixed SCREAMING_SNAKE casing. | Pin one rule: lowercase-hyphenated filenames (`mcp-policy.md.template`, `cheatsheet.md.template`, `security-checklist.md`) and always reference with full filename including `.template` suffix. Add a "filename canon" table to spec 01 every other spec cites verbatim. |
| **R-007** | 00, 02, 03, 05, 06, 07, 08 | contradiction | should-fix | KIE | Three different concepts share the term "CLAUDE.md": the *consumer's* project memory, the *kit's* template, and `docs/methodology.md` are all referenced as "team CLAUDE.md" or "project CLAUDE.md" in various specs. Easy to confuse cold. | Define three terms in spec 00 (or new glossary): `<consumer>/CLAUDE.md`, `templates/CLAUDE.md.template`, `docs/methodology.md`. Use exactly those terms everywhere; ban "team CLAUDE.md" / "project CLAUDE.md" as synonyms. |
| **R-008** | 02 | scope | should-fix | DHH CSR | `CLAUDE.md.template` lists 8 sections plus 4 "optional appendices commented-out by default" (Server Action anatomy, audit logging, rate limiting, middleware). This is the "framework on top of framework" smell — Next.js-specific patterns leaking into a stack-agnostic template. | Ship a minimal CLAUDE.md.template (Project Overview, Conventions, Test Strategy, Living Doc rules). Move stack-specific patterns to `templates/snippets/` (composable Lego pieces) or drop entirely until the `examples/` decision is made. |
| **R-009** | 02 | scope | can-skip | DHH CSR | `CHEATSHEET.md.template` enumerates 8 daily commands + 6 required skills + 5 reviewer agents + 5 build placeholders + 3 context thresholds + plan-mode + phasing trigger — claimed "one-page." Won't fit. Also duplicates spec 06 week-1 content. | Cut to a real one-page sheet: 6–8 slash commands, the 4 daily skills, build/test placeholders, context thresholds. Reviewer-agent mapping moves to `docs/methodology.md` §H or its own appendix. |
| **R-010** | 02, 06, 07 | contradiction | should-fix | KIE CSR | Three different command vocabularies across specs: spec 02 lists 8 daily commands, spec 06 lists 5, spec 07 §H references `/claude-review` only. The reviewer-agent list in spec 02 also differs from spec 07 §H and from spec 06 week-1. | Define canonical command list once (recommend `templates/CHEATSHEET.md.template` as source of truth). Specs 06 and 07 cite by reference, do not redefine. Same fix for reviewer-agent list. |
| **R-011** | 02 | untestable | must-fix | DHH KIE | Acceptance criterion: "A consumer following `templates/README.md` can produce a working set of project docs for a new project within 1 hour without touching the kit's source." No defined consumer profile, no test harness, "1 hour" depends on typing speed. | Replace with mechanically verifiable check: substituting placeholders for sample stack (Next.js+Postgres) produces zero unresolved `{{...}}` tokens AND zero references to `optics-management|mvo_*|Mint Vision`. Or commit to `claude-md-validator.sh` and gate on its clean exit. |
| **R-012** | 04 | untestable | must-fix | DHH KIE CSR | Acceptance criterion: `prompts/code-review.md` is "comprehensive enough that a consumer can use it without modification on a Next.js + Postgres app." "Comprehensive enough" is the textbook non-criterion. | Replace with concrete checklist: prompt covers auth guard, input validation, test coverage, error paths, convention-match, anti-hallucination. Assertion: each section header exists. Test path: lints YAML against `actionlint`/`act`; manual verification recipe in `github-actions/README.md`. |
| **R-013** | 02, 03, 04, 05 | merge-decision | should-fix | KIE | Merge decisions are consistent in intent but inconsistent in *labeling*: hooks "lifted verbatim," SECURITY_CHECKLIST "lifted ~as-is with light edits," AI_USAGE_CHARTER "based on" upstream, MCP 5-step workflow used as "pattern." Four implicit modes, none labeled. | Define 4 sourcing modes once in spec 00 or 01: `verbatim`, `verbatim-with-light-edit`, `customization`, `pattern-only`. Tag every merged artifact in specs 02 and 03 with the right mode. Phase-execution agent can then batch verbatim lifts together. |
| **R-014** | 03 | weak-rec | should-fix | DHH KIE CSR | Decision #3 (lift mode) reopens what spec 03 already proposes ("lift verbatim"). Decision #4 (disable mechanism) lists 3 options without a recommendation. Decision #5 (logging) buries the recommendation as a parenthetical. | Drop decision #3 entirely (verbatim with header attribution is the policy; rewrites need an ADR post-v1). Recommend `CLAUDE_HOOKS_DISABLE=<name>` env var for #4 (visible in shell history, scoped to one command, no settings.json mutation, logged to stderr). Recommend stderr-only for #5 with opt-in `CLAUDE_HOOKS_LOG=~/.claude/hooks.log` env var. |
| **R-015** | 03 | scope | must-fix | CSR | "Stretch hooks (v2 / opt-in)" subsection lists 5 hooks not in v1 with explicit reasons not to ship. Doesn't inform v1 design; bloats the spec. | Delete the "Stretch hooks" subsection from spec 03. If genuinely v1-adjacent, name once in `BACKLOG.md` (spec 08), not in component specs. |
| **R-016** | 03, 05 | dep-gap | must-fix | DHH KIE CSR | Spec 03 references `claude-test-hook` as a "small helper we'd write as part of `scripts/` (spec 05) or a README section for now — a stretch goal." Spec 05 doesn't mention it. The hook acceptance tests depend on a tool with no owner. | Either add `claude-test-hook` to spec 05 explicitly with its own section + acceptance criteria, OR replace acceptance examples in spec 03 with concrete manual-test recipes per hook (exact command, expected stderr/exit code, no new tooling). Recommend the latter — fewer scripts. |
| **R-017** | 03, 05 | dep-gap | must-fix | DHH KIE | Settings-merge semantics are hand-waved as "deep-merge the `hooks` key (arrays unioned by `command` field)." Spec 03's `hooks` snippet is array-of-objects with `matcher` + nested `hooks` array. Behavior undefined for: matcher already present (replace? append?), array dedup semantics, registered hook with non-existent file path, consumer's manual edits. Tilde expansion in command paths also unspecified. | Pin merge algorithm in spec 05 with three worked examples (clean install, additive install, conflict). Specify: matcher exists → append commands not duplicated; matcher missing → add new entry; manual edits → preserved unless `--force`. State whether tilde stays literal (Claude Code expands at runtime) and that script ignores `settings.local.json` (audit-scan covers it). |
| **R-018** | 03 | dep-gap | should-fix | CSR | Spec 03 says "exact matcher syntax matches Claude Code's current hook spec — verify against latest docs at implementation time." Bootstrap script (spec 05) depends on this; if matcher syntax is wrong, the snippet doesn't merge correctly. | Add explicit "Depends on: Claude Code hook schema verified at implementation time (cite docs URL)" header to specs 03 and 05. |
| **R-019** | 04 | weak-rec | can-skip | DHH KIE | Decision #5 (model pinning) recommends pinning + auto-upgrade-bot, but no upgrade-bot is specified anywhere. Decision #1 (PR review mode), #2 (security review), #3 (issue triage) all have clear recommendations buried in prose. | Drop decision #5 alternatives — pin to current model ID, manual bumps documented in CHANGELOG, no phantom auto-upgrade-bot. Promote recommendations on #1/2/3 from prose to single-line conventions. |
| **R-020** | 04 | scope | should-fix | KIE CSR | "v2 stretch" subsection in spec 04 details 3 workflows (`claude-pr-auto-review.yml`, `claude-security-review.yml`, `claude-issue-triage.yml`) with full triggers/behavior/output. Spec 04 acceptance criteria only cover the v1 workflow. Spec is doing 3× the design work for ⅓ the deliverable. | Trim v2 stretch content to one-line "deferred to v2; see BACKLOG.md." Spec 04 = v1 only. |
| **R-021** | 04 | dep-gap | should-fix | KIE | Workflow doesn't specify how `prompts/code-review.md` locates the consumer's `CLAUDE.md`. Spec implies `./CLAUDE.md` but doesn't make it configurable or graceful when missing. | Add `CLAUDE_MD_PATH` workflow input (default `./CLAUDE.md`); state how the prompt ingests the file (`cat $CLAUDE_MD_PATH`); document graceful behavior when missing (warn, proceed without project context). |
| **R-022** | 05 | weak-rec | should-fix | DHH KIE | `--no-backup` flag combined with `--force` is a footgun. The spec already says "not recommended; documented as risky" — that's a smell. | Drop `--no-backup` for v1. Backups are cheap. Less surface = fewer ways to wreck `~/.claude`. |
| **R-023** | 05 | scope | can-skip | DHH | `--hooks <list>` flag for partial install smells like premature configurability. | Drop `--hooks <list>` for v1. The kit's bundle is the bundle. Add the flag when an actual user asks for it. |
| **R-024** | 05 | untestable | should-fix | KIE CSR | Acceptance criterion: "audit-scan.sh against a known-bad `~/.claude/`...flags the credential finding." Requires fabricating the optics-management-style bad state at test time; not reproducible. | Add `scripts/test-fixtures/settings.json.bad-fixture` and `settings.json.good.fixture`. Acceptance becomes: `audit-scan.sh test-fixtures/settings.json.bad-fixture` exits non-zero with `inline-credential` flagged. |
| **R-025** | 06 | untestable | must-fix | DHH KIE CSR | Day-1 acceptance gates include "Read `CLAUDE.md` start-to-finish (no skipping)" and "Joined team's communication channel" — unverifiable. Day-30 includes "5 PRs merged independently" — depends on consumer's project flow, not the kit. | Move unverifiable items to a "guidance" subsection, not gates. Day-1 hard gates: bootstrap ran green, audit-scan green, first PR opened, `/claude-review` posted. Day-30 reframe around demonstrable competencies, not throughput counts. |
| **R-026** | 06 | scope | should-fix | DHH | Week-1 spec restates content from `CHEATSHEET.md.template` (skills to invoke, reviewer mapping). Two sources of truth — they will drift. | Make week-1 a *checklist* of activities; each item links to cheatsheet/charter for detail. Don't restate cheatsheet content. |
| **R-027** | 06 | scope | should-fix | KIE CSR | Day-30 retrospective has 5 bulleted prompts + checklist with "filed at least one improvement issue." Reads like HR ritual. Spec self-describes as "performance reviews are out of scope" while shipping retrospective ceremony. | Reduce day-30 retro to one sentence: "After 30 days, share what slowed you down with your lead." Cut the bulleted prompts and the "filed at least one improvement issue" checkbox. Day-30 should be soft (retrospective), not hard-gated. |
| **R-028** | 06 | contradiction | should-fix | KIE | Decision #5 says "hard for day-1 + day-30 (gating); soft for week-1." But day-30 is a retrospective milestone — there's nothing the kit does about a missed gate. | Reverse the day-30 gating call: day-30 soft, week-1 soft, day-1 hard. |
| **R-029** | 07 | scope | should-fix | DHH | 8 philosophy principles + 9 methodology subsections (A–I) = 17 numbered items. Sections H ("Multi-agent review") and I ("MCP discipline") are workflow prescriptions, not philosophy; I restates spec 02 §4. | Cut philosophy principles to 4–5 (verification-first, methodology amplifies, living docs, plain markdown, security-by-default). Move §H out of methodology into the cheatsheet. Drop §I (lives in spec 02 + spec 03 already). |
| **R-030** | 07 | scope | should-fix | CSR | §H lists 5 specific compound-engineering reviewer agents by name. Spec 07's own decision #4 says "describe abstractly; cite specific skill names but not versions." Naming five reviewers verbatim violates that recommendation and ties methodology.md to compound-engineering's current naming. | Cut named-reviewer list from `methodology.md`. Reference compound-engineering generically; let `CHEATSHEET.md.template` hold current names (easy to update). |
| **R-031** | 07 | weak-rec | should-fix | KIE | Decision #3 ("How to handle conflicts between this canon and Claude Code/superpowers defaults?") is a load-bearing ordering question and should be a stated rule, not a decision. | Promote to a stated rule under new §"Hierarchy of authority": project `CLAUDE.md` > kit `methodology.md` > superpowers/compound-engineering skill defaults > Claude Code defaults. Remove from Decisions. |
| **R-032** | 07 | dep-gap | should-fix | KIE | §F "Living documents on every ship" lists optics-management's exact doc set verbatim (`CHANGELOG.md`, `project_status.md`, `setup_guide.md`, `architecture.md`, `PRD.md`, `reference_docs.md`, `README.md`, "user-guide HTML"). Project-specific bleed into kit-canonical methodology. | Replace with abstract rule: "the project's living-doc set, defined in its own `CLAUDE.md` Documentation Requirements section." List specific files only as a clearly-labeled *example block*. |
| **R-033** | 07 | vague | should-fix | KIE | §G "Context discipline" copies thresholds (50/70/90) without justifying them. Spec 07's whole point is "the why behind every other component." | Add one-sentence rationale or cite Ultimate Guide section explicitly. State whether numbers are empirical or convention. |
| **R-034** | 07 | weak-rec | can-skip | CSR | Decision #5 ("ship a one-page philosophy poster?") — recommendation is "skip" with no upside. Tongue-in-cheek but doesn't earn its bullet. | Delete decision #5. |
| **R-035** | 08 | weak-rec | can-skip | DHH CSR | Decision #1 (ADR format) and #2 (CHANGELOG cadence) — recommendations are obvious and correct; alternatives are filler. Decision #5 ("ADRs forever?") — yes, that's the definition of an ADR. | Cut alternatives in #1 and #2. Drop #5 entirely. |
| **R-036** | 08 | weak-rec | can-skip | KIE | Decision #4 ("post to public aggregators on v1.0.0?") — recommendation tied to audience tier (which R-003 collapses). Half-spec'd marketing inside a release-process spec. | Move aggregator submission to a tier-3 launch checklist (or kill if R-003 makes the kit binary public). Don't half-spec marketing inside spec 08. |
| **R-037** | 08 | untestable | must-fix | DHH KIE CSR | v1.0.0 trigger criterion: "A retrospective from that experience has produced no critical kit changes for 30 days." "Critical" undefined. "No changes" is subjective ("just don't merge anything"). 5-condition v1.0.0 gate is overspec'd ceremony for a single-author kit. | Reduce to one condition: "v1 specs implemented + at least one project bootstrapped successfully." OR if soak is kept, define "critical" as "open issues with `severity:critical` label" — now `gh issue list` resolves it. |
| **R-038** | 08 | weak-rec | should-fix | KIE | Decision #2 (CHANGELOG cadence) recommends per-PR `[Unreleased]` flow but provides no enforcement mechanism. Discipline rots without a hook. | Pair recommendation with concrete enforcement: a CI check (in the kit's own CI — see R-039) that fails the build if `[Unreleased]` is unchanged on a PR touching `templates/`, `hooks/`, `scripts/`, or `github-actions/`. |
| **R-039** | missing | missing-spec | must-fix | DHH KIE CSR | No spec covers the kit's *own* CI / quality gates. Spec 05 says scripts must be "shellcheck-clean" but no workflow runs shellcheck. Spec 04 says workflow YAML must lint clean against `act` but no workflow runs that lint. Spec 02 says no template contains `optics-management|mvo_*` but no scan enforces it. The kit ships a PR-review GH Action for *consumers* but doesn't dogfood any CI for itself. Security-first kits that don't dogfood security gates is a credibility hit. | Add `09-kit-ci.md`: shellcheck on `hooks/` and `scripts/`, yamllint or actionlint on `github-actions/`, `forbidden-strings` check on `templates/` (project-specific identifiers), markdownlint, link-check on docs, JSON schema validation on `settings-snippet.json`, fixture-based bootstrap idempotency test. ~1 page spec. |
| **R-040** | missing | missing-spec | should-fix | DHH KIE CSR | No spec covers `examples/` (filled-in `CLAUDE.md.example` for Next.js+Postgres). Flagged as sub-decision in spec 01 (#3) and spec 02 (#3) but never resolved. The same question floats across specs. | Either (a) confirm examples ship: add `09-examples.md` with concrete file list, or (b) defer to v1.1: kill the two open decisions. Recommend (b) for v1 (smaller scope, fewer maintenance surfaces); revisit when public-tier audience is committed. |
| **R-041** | missing | missing-spec | should-fix | DHH KIE | No spec covers the sync/upgrade flow. Spec 05 §3 hand-waves at `update-from-upstream.sh` ("Requires versioning convention we haven't nailed down yet"). Templates are CC0 fork-and-customize, but how does a consumer who forked `CLAUDE.md.template` 6 months ago pick up new conventions in v0.4.0? Walking past this paints v2 into a corner. | Add a one-paragraph upgrade-contract sketch in spec 08 (or new `10-upgrade-flow.md`): which artifacts are fork-and-customize (templates) vs. drop-in (hooks, scripts, GH Actions); how new versions advertised (CHANGELOG + release notes); manifest file with hashes the bootstrap writes for delta detection. |
| **R-042** | missing | missing-spec | should-fix | DHH KIE | No spec covers public-readiness artifacts: `CONTRIBUTING.md` content (spec 08 mentions but doesn't detail), `CODE_OF_CONDUCT.md` (deferred), `SECURITY.md` (vuln disclosure — ironic given kit's security ethos), issue/PR templates for the kit repo itself. Tier-3-public scrub criterion is also undefined. | Add `11-public-readiness.md` (or fold into spec 08) covering: CONTRIBUTING content, CODE_OF_CONDUCT, SECURITY policy, issue templates, scrub checklist (zero `optics`, `mvo_`, `Mint Vision`, internal team names; LICENSE in place). Gate v1.0.0 release on the scrub checklist. |
| **R-043** | All | phase-readiness | must-fix | DHH KIE | Per DHH's count: ~21 unresolved Decisions-needed forks across specs. Per Kieran's count: ≥6 clarifying questions a fresh `/phase` agent would ask in a single decompose pass. Phase-readiness: NOT yet. | Before invoking `/phase`, hold a single decision-fix session and resolve every "Decisions needed" fork to a default (even if "deferred to v2"). Phase agent should have nothing to ask. The R-NNN findings in this report close most of these. |
| **R-044** | README | readability | can-skip | KIE CSR | "After approval" mapping table at bottom of README duplicates spec 01's directory layout (more detailed). Cold reader has to triangulate. The "Suggested skim order" plus numbered table plus consolidated decisions plus mapping table = 4 overlapping nav surfaces in a 100-line README. | Drop the suggested skim order ("read in order"). Drop the "After approval" mapping (link to spec 01 instead). Keep numbered table + consolidated decisions. |
| **R-045** | 02 | merge-decision | should-fix | KIE | Spec 02 §5 SECURITY_CHECKLIST says "remove items that are framework-specific (e.g., the threat-db checks if we're not adopting that yet)" without naming which OWASP items kept, which framework-specific items dropped, which Next.js example items added. "Light editing" is unbounded license. | Add a 3-bullet list to §5: (a) OWASP items kept verbatim; (b) framework-specific items dropped (threat-db); (c) Next.js example items added (HMAC session, timing-safe-delay, audit logging). |
| **R-046** | 00 | readability | can-skip | KIE | "Audience tier" introduced in spec 00 prose without a concise definition table. Other specs use "tier 1–2", "tier 3", "scrubbed-for-public" interchangeably. (Note: R-003 may make this moot if tiers collapse to binary.) | If R-003 retains tiers: add 3-row table at top of spec 00 audience section. If R-003 collapses to binary: this finding closes automatically. |
| **R-047** | 00 | readability | can-skip | DHH | Vision section says "compose existing plugins... encode mature practice" but doesn't articulate the gap clearly: Ultimate Guide is reference; this kit ships. | Add 3 sentences to spec 00 Vision: "The Ultimate Guide teaches; this kit ships. The Ultimate Guide is reference material; this kit is what you copy into a new repo on day one. We lift CC0 artifacts, leave the narrative behind, and add the bootstrap glue." |

---

## Specs that are genuinely solid (per reviewer consensus)

- **Spec 01 (Repo Structure)** — proportionate, clean alternatives table, naming
  conventions stated. Only drag is the unresolved `examples/` question (R-040).
- **Spec 03 (Hooks) core** — the six hooks are the right six, sourced correctly,
  CVE call-out is the kind of justification reviewers want. Only weakness is the
  "Stretch hooks" subsection (R-015) and decision-fork theater (R-014).
- **Spec 04 (GH Actions) core** — comment-trigger default is right, externalized
  prompt right, read-only permissions right. Issues cluster in v2 stretch (R-020)
  and the untestable AC (R-012).
- **Spec 05 (Scripts) core** — bootstrap idempotency, `--dry-run`, backup discipline
  are correct instincts. Issues: `--no-backup`/`--hooks` flag bloat (R-022, R-023)
  and merge-semantics (R-017).

---

## Reviewer-attributed raw findings (full transcripts)

For audit completeness, each reviewer's full output is preserved at the section
delimiter below. Cross-reference R-NNN ↔ DHH-NNN/KIE-NNN/CSR-NNN as needed.

### DHH (25 findings)

Full output: see Phase A run for `dhh-rails-reviewer`. Key clusters:
- Decision-fork theater (DHH-002, 006, 013, 024)
- Acceptance-criteria untestability (DHH-003, 004, 010, 014)
- Settings-merge gap (DHH-009)
- Missing kit CI (DHH-015), missing examples (DHH-016), missing public-readiness (DHH-017), missing sync flow (DHH-018)
- Spec 02 CLAUDE.md scope creep (DHH-005)
- Spec 07 over-numbered (DHH-012)
- Phase-readiness blocker (DHH-023)

### Kieran (35 findings)

Full output: see Phase A run for `kieran-rails-reviewer`. Key clusters:
- Naming/terminology drift (KIE-001, 002, 003, 017, 018)
- Untestable AC (KIE-004, 005, 014, 015, 023)
- Phantom `claude-test-hook` (KIE-006)
- Settings-merge underspec (KIE-007, 012)
- Decision-fork weakness (KIE-008, 009, 010, 013, 020, 022, 035)
- Missing kit CI (KIE-024), examples (KIE-026), sync flow (KIE-025), public-readiness (KIE-027)
- Merge-decision mode labeling (KIE-028, 029, 030)

### CSR (25 findings, 1 positive)

Full output: see Phase A run for `code-simplicity-reviewer`. Key clusters:
- Audience-tier abstraction (CSR-001) — strongest single recommendation
- Decision-fork theater (CSR-002, 003, 008, 011, 016, 018, 021)
- v2/stretch bloat in v1 specs (CSR-004, 005, 006, 007)
- v1.0.0 ceremony (CSR-017)
- Spec 07 named reviewers contradicts decision #4 (CSR-015)
- Day-30 ritual cut (CSR-014)
- Missing examples (CSR-019), kit CI (CSR-020)
- README nav surfaces (CSR-022)

---

## Recommendation cluster: minimal viable hardening

If you want to fix only the highest-ROI items and skip the rest, this is the
minimal must-fix set:

- **R-001** (project name → `unify-kit`) — already user-decided, mechanical apply
- **R-003** (collapse tier abstraction to binary) — touches 5 specs, big simplification
- **R-006** (filename canon table) — closes most cross-spec naming drift in one move
- **R-011, R-012, R-025, R-037** (untestable AC fixes) — replace 4 hand-waves with concrete checks
- **R-016** (resolve `claude-test-hook` ownership) — manual-test recipes per hook
- **R-017** (settings-merge algorithm with worked examples)
- **R-039** (add `09-kit-ci.md`) — security-first kit dogfooding its own CI
- **R-043** (resolve all Decisions-needed forks before `/phase`) — phase-readiness gate

That's 9 must-fix items — the spec set goes from "not phase-ready" to "phase-ready"
with these alone. Should-fix items polish the result; can-skip items are nice-to-have.
