<!--
templates/compliance/profiles/healthcare-phipa/claude-md-addendum.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")

This file is appended to the project's CLAUDE.md by init-project.sh when
--compliance=healthcare-phipa is applied. It follows the baseline-pipeda
addendum (which appends first).
-->

## Compliance footprint — PHIPA (Ontario)

This project additionally operates under the **healthcare-phipa**
compliance profile (Ontario PHIPA + IPC supervisory authority). PHIPA
applies alongside PIPEDA where personal health information (PHI) is
involved.

When implementing features that touch PHI:

- Read [`docs/compliance/phipa-readiness.md`](docs/compliance/phipa-readiness.md)
  before changing PHI-collection scope, consent flows, lockbox
  behaviour, audit-log writes, or breach paths.
- **Audit-log every PHI read AND write** per
  [`docs/compliance/audit-log-requirements.md`](docs/compliance/audit-log-requirements.md).
  PHIPA s. 10.1 makes this non-negotiable; missing audit writes are
  themselves a compliance gap.
- Treat lockbox markers (PHIPA s. 19, s. 37) as a hard constraint
  in any feature that reads or surfaces PHI — the override path is
  exceptional, audited, and approval-gated.
- A breach involving PHI follows
  [`docs/compliance/breach-response.md`](docs/compliance/breach-response.md);
  notification timing under PHIPA s. 12.2 is "at the first reasonable
  opportunity" and is independent of any harm-threshold test.
- When this project is acting as an Agent of a HIC, the HIC drives
  notifications and external communications during an incident —
  do not bypass them.

The compliance docs in this repo are starting-point templates, not
legal advice. Counsel review is required before any externally-facing
artifact (privacy policy, ToS, DPA, breach notification, Information
Manager Agreement) is finalized.
