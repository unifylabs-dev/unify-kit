<!--
templates/compliance/profiles/financial-canada/claude-md-addendum.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

## Compliance footprint — Canadian financial

This project additionally operates under the **financial-canada**
compliance profile (PIPEDA + FINTRAC under PCMLTFA + applicable
provincial securities regulators). Implementation choices in this
project must respect all three frames simultaneously.

When implementing features that touch financial information or
trading activity:

- Read [`docs/compliance/fintrac-readiness.md`](docs/compliance/fintrac-readiness.md)
  before changing KYC flows, transaction-monitoring logic, sanctions
  screening, or any reporting pipeline. Reporting thresholds and
  forms evolve — verify FINTRAC's current guidance for the relevant
  report type.
- Audit-log every event listed in
  [`docs/compliance/audit-log-requirements.md`](docs/compliance/audit-log-requirements.md);
  AML-relevant events (sanctions hits, STR-filed transitions,
  PEP/HIO updates) feed regulator examinations and must be tamper-
  evident.
- Treat
  [`docs/compliance/breach-response.md`](docs/compliance/breach-response.md)
  as the multi-regulator incident runbook — PIPEDA + FINTRAC +
  provincial-securities reporting can fire in parallel.
- For registered activities, refer to
  [`docs/compliance/provincial-securities-overview.md`](docs/compliance/provincial-securities-overview.md)
  to identify the right regulator for the jurisdictions where clients
  are located.
- Vendor changes affecting the AML pipeline (KYC, sanctions screening,
  payment processing) require
  [`docs/compliance/subprocessors.md`](docs/compliance/subprocessors.md)
  updates **and** an AML-compliance-officer sign-off in the same PR.

The compliance docs in this repo are starting-point templates, not
legal advice. Counsel + a registered compliance officer review is
required before relying on any document for any regulated activity.
