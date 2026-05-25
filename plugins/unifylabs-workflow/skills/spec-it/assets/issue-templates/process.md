<!--
  Process / docs issue body template — used when type = process or docs.

  This is for non-code changes: methodology updates, convention codification,
  doc reorganization, decision records, compliance posture changes, etc.

  Difference vs feature template:
    - Acceptance Criteria are doc-shaped, not code-shaped
    - Spec sections affected often references methodology.md or an ADR rather
      than module/journey specs
    - Embedded spec draft may be an ADR or a methodology delta rather than a
      module/journey spec
    - /work-issue Phase 4 (TDD) is skipped — Phase 4 becomes "apply doc edits +
      verify they render correctly"
-->

## Description

<!--
  2–3 sentences. The process gap, convention issue, or doc problem being
  addressed. Why it matters now (recent incident? recurring source of
  confusion? new external requirement?).
-->

## Acceptance Criteria

<!--
  Doc-shaped ACs. Each is a verifiable state change in the documentation.

  - [ ] `docs/methodology.md` updated under §"<Section name>" with <change summary>
  - [ ] `docs/<other>.md` cross-references updated to point at the new rule
  - [ ] `CHANGELOG.md` entry added under `[Unreleased]`
  - [ ] Existing references to old convention found and updated:
    - [ ] `docs/onboarding/<x>.md`
    - [ ] `README.md`
  - [ ] (If applicable) PR template or issue template updated to enforce
-->

- [ ] <doc edit criterion>
- [ ] <doc edit criterion>

## Spec sections affected

<!--
  For process / docs issues, this section references methodology docs or ADRs
  rather than module/journey specs.

    - `docs/methodology.md` § "<Section>": add rule "..."
    - NEW: `docs/adr/NNNN-<topic>.md` (new decision record)
-->

- `docs/methodology.md` § "<Section>": <change summary>

## Design Notes

<!--
  Why this change vs alternatives. Any process trade-offs (e.g. "this adds
  one step to every PR but eliminates the recurring X bug").

  If a parallel kit propagation was filed (Phase 5 fired), this is where to
  link it for context.
-->

## Research notes

<!--
  Often relevant for process changes — prior art from other projects, industry
  best practices, regulatory updates that motivate the change.

  **Industry standards:**
    - <standard> — <takeaway> ([source](<url>) — checked YYYY-MM-DD)

  **Prior art:**
    - <other-project> uses <similar convention> — see <link>

  **Memory hits:**
    - <feedback memory>: <summary>
-->

## Doc updates for the same PR

<!--
  For process issues, this section usually overlaps with Acceptance Criteria —
  but ACs are checkbox-trackable, while this section is the prose summary of
  what /work-issue Phase 7 should verify.

    - `docs/methodology.md`
    - `CHANGELOG.md`
    - `docs/onboarding/quickstart.md`
-->

## Kit impact

<!--
  Process / methodology changes are particularly likely to be kit-worthy. Most
  process issues SHOULD have a parallel unify-kit propagation. Phase 5 should
  have surfaced this.

    - Linked: unifylabs-dev/unify-kit#<N> — adds the same convention to kit methodology
-->

## Priority

<!-- One of: Low | Medium | High | Critical -->

Medium

<details>
<summary>📄 Proposed Doc Draft — &lt;target-doc-path.md&gt;</summary>

```markdown
<!--
  The proposed text for the doc update. Could be:
    - A new section to add to methodology.md
    - A full ADR file
    - A new section in CLAUDE.md
    - A new convention paragraph for a README

  /work-issue Phase 4 applies this content to the target path. For
  non-code issues, this draft IS the implementation — the work-issue PR
  diff should match it (with possibly minor refinements per review).
-->
```

</details>
