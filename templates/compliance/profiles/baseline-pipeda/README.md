<!--
templates/compliance/profiles/baseline-pipeda/README.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12 (phase 3 of v2 reshape run 2026-05-12-unify-kit-v2)
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# `baseline-pipeda` — Canadian privacy floor

The default compliance profile for any Canadian project that handles personal
information. Implements PIPEDA (federal) plus the general provincial
principles that mirror it (BC PIPA, Alberta PIPA, Quebec Law 25 alignment).
Other profiles (`healthcare-phipa`, `financial-canada`) build on this one.

## When to apply

- The project is operated by or for an organization with a Canadian
  customer base.
- The project collects, uses, or discloses personal information in the
  course of commercial activity.
- Your team has not opted into a more specific profile that fully supersedes
  PIPEDA (none of the v2 profiles do — they all compose on top).

If you're unsure, run `/compliance-research` from the `unifylabs-workflow`
plugin. It walks the industry / geography / data-class questions and
recommends a composition.

## What this profile ships

```
docs/compliance/
├── pipeda-readiness.md       # 10 fair-information-principles checklist
├── breach-response.md         # PIPEDA breach reporting flow
├── privacy-policy.md          # public-facing privacy notice
├── subprocessors.md           # vendor list + scope of data sharing
└── audit-log-requirements.md  # events that MUST be logged
runbooks/
├── access-revocation.md       # offboarding + role-change flow
└── vendor-escape-template.md  # ADR-driven vendor migration runbook
CLAUDE.md (addendum appended)  # footprint declaration
```

## Regulators covered

- **PIPEDA** — Personal Information Protection and Electronic Documents Act
  (federal, Canada-wide). Office of the Privacy Commissioner of Canada
  (OPC) is the supervisory authority.
- **General provincial-privacy alignment** — BC PIPA, Alberta PIPA, Quebec
  Law 25, and the privacy provisions of common-law provincial statutes
  share PIPEDA's 10-principles structure. This profile's docs are written
  to satisfy that shared core; provinces with substantially-different
  regimes (e.g., Quebec Law 25's stricter consent and AI-decision
  requirements) deserve a counsel-led pass.

## What this profile does **not** cover

- Health-sector specifics (PHIPA, PIPA-BC health regs) — compose with
  `healthcare-phipa`.
- AML/ATF obligations (FINTRAC) and provincial securities — compose with
  `financial-canada`.
- US frameworks (HIPAA, CCPA, GLBA) — out of scope for v2 of the kit.
- SOC 2 audit-readiness — compose with `general-soc2` if doing enterprise
  sales.

## Working with these templates

> **These templates are starting points, not legal advice.** Consult
> qualified Canadian privacy counsel before relying on any document in
> this profile for compliance purposes — privacy law evolves and your
> project's facts are not in these files.

Every `.md.template` file in this profile carries a status block at the
top. Replace the `[fill in: ...]` prose pointers with your project's
specifics, then have counsel review before any of these documents leaves
the repo (privacy policy posted publicly, breach response runbook used
during an actual incident, subprocessors list shared with customers).
