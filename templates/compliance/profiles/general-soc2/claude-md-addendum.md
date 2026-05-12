<!--
templates/compliance/profiles/general-soc2/claude-md-addendum.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

## Compliance footprint — SOC 2 (framework, not law)

This project additionally operates under the **general-soc2** compliance
profile (SOC 2 Trust Services Criteria audit-readiness scaffolding). SOC 2
is an audit framework administered by independent CPA firms — it is not a
regulatory standard and does not replace privacy law that applies to your
jurisdiction.

When implementing features:

- Read [`docs/compliance/soc2-controls-mapping.md`](docs/compliance/soc2-controls-mapping.md)
  to understand which Trust Service Criterion governs a given change.
  Features that affect access control, change management, monitoring,
  or vendor relationships have explicit TSC controls auditors sample.
- Maintain audit evidence in the same PR that lands the change —
  PR-merge audit logs, deploy-success records, and access-grant
  tickets are all sampled artifacts.
- Audit-log every event listed in
  [`docs/compliance/audit-log-requirements.md`](docs/compliance/audit-log-requirements.md);
  for SOC 2, retention of 12 months (audit period + look-back) is the
  floor.
- Treat the incident-response runbook
  [`docs/compliance/breach-response.md`](docs/compliance/breach-response.md)
  as the IR program — tabletop exercise cadence is a sampled control.
- Vendor additions / changes flow through
  [`runbooks/vendor-management.md`](runbooks/vendor-management.md)
  before integration begins; the tier classification drives the depth
  of evidence collection.
- Policy artifacts in
  [`docs/compliance/security-policies-index.md`](docs/compliance/security-policies-index.md)
  are audit-sampled — owner + last-reviewed dates must stay current.

If your project also operates in Canada, this profile is composed with
`baseline-pipeda` (or a more specific Canadian profile). SOC 2 does not
substitute for PIPEDA / PHIPA / FINTRAC obligations.

The compliance docs in this repo are starting-point templates, not
audit advice and not legal advice. A CPA firm engagement is required to
actually pursue a SOC 2 report; counsel review is appropriate for any
externally-facing artifact.
