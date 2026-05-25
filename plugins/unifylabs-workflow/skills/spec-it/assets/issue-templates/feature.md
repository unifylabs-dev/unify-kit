<!--
  Feature issue body template — used when type = feature (or refactor / chore).

  /spec-it Phase 6 fills every placeholder. Sections must stay in this order
  because /work-issue Phase 0 reads them positionally for "Spec sections affected".
-->

## Description

<!--
  2–3 sentences. The problem this feature solves. Why it matters.
  Not the implementation approach.
-->

## Acceptance Criteria

### Behavioral

<!--
  Checkbox list. One AC per checkbox. Testable statements.
  Avoid implementation language ("use bcrypt") — that goes in Design Notes.
-->

- [ ] <criterion>
- [ ] <criterion>

<!--
  If the feature has visual requirements (UI / prototype-derived), include the
  Visual Fidelity subsection below. Otherwise delete it.
-->

### Visual Fidelity

- [ ] <visual criterion>
- [ ] <visual criterion>

## Spec sections affected

<!--
  /work-issue Phase 0 parses this section. Format:
    - <path-to-spec>.md
        § <Section>: <change summary>
        § <Section>: <change summary>

  For new specs that don't exist yet:
    - NEW: <path-to-new-spec>.md (bootstrap on first touch)

  For drift fixes (no behavior change):
    None — fixing drift from spec.

  For pure docs/config/typo:
    None — no behavior change.
-->

- `<path-to-spec>.md`
    § <Section>: <change summary>

## Design Notes

<!--
  Free-form. Anything non-obvious surfaced in research or clarifications:
    - Library version constraints
    - Compliance trade-offs
    - UX precedent decisions
    - Alternatives considered and why they were rejected

  If nothing notable, write: "None — straightforward implementation."
-->

## Research notes

<!--
  Grounded research from Phase 2. Include only the categories that have findings.

  **Library docs (context7):**
    - `<library>@<version>` — <takeaway> ([source](<url>) — checked YYYY-MM-DD)

  **Industry standards:**
    - <standard> — <takeaway> ([source](<url>) — checked YYYY-MM-DD)

  **Compliance:**
    - <regulation> — <takeaway> (via compliance-research profile <name>)

  **Prior art:**
    - <repo>: `<path>` — <pattern>

  **Memory hits:**
    - <type> memory: <summary>

  If no external research was needed, write: "None — pure project work, no external grounding required."
-->

## Doc updates for the same PR

<!--
  Guide docs that should be updated in the /work-issue PR (not in this issue).
  /work-issue Phase 7 verifies these survive into the final PR diff.

    - `docs/methodology.md` — <one-line summary>
    - `CHANGELOG.md` — entry under `[Unreleased]`

  If no doc updates needed, write: "None."
-->

## Kit impact

<!--
  Only if Phase 5 fired. Either a link to a filed unify-kit issue/PR, or a
  deferred note. If Phase 5 declined, delete this section.

    - Linked: unifylabs-dev/unify-kit#<N> — <one-line>
    OR
    - Note: <pattern description>. Deferred to future kit update.
-->

## Priority

<!-- One of: Low | Medium | High | Critical -->

Medium

<details>
<summary>📄 Proposed Spec Draft — &lt;target-spec-path.md&gt;</summary>

```markdown
<!--
  Full spec content here, ready for /work-issue Phase 0 to write to disk as
  the first commit on the work branch.

  The spec should be complete:
    - Frontmatter (name, type, last_reviewed, related_issues, related_journeys
      or related_modules, code_anchors)
    - All required sections per the matching spec template
    - Behavior-focused, not implementation-focused

  /work-issue Phase 0 parses the target path from the summary above (between
  &lt;...&gt; brackets) and writes the content of THIS code block to that file.
-->
```

</details>
