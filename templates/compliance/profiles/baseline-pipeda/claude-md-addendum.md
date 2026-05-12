<!--
templates/compliance/profiles/baseline-pipeda/claude-md-addendum.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")

This file is appended to the project's CLAUDE.md by init-project.sh when
the consumer applies --compliance=baseline-pipeda. It declares the active
compliance footprint so every Claude Code session inherits the context.
-->

## Compliance footprint

This project operates under the **{{COMPLIANCE_PROFILE}}** compliance
profile (PIPEDA — Canadian federal privacy law + general provincial
principles).

When implementing features that touch personal information:

- Read [`docs/compliance/pipeda-readiness.md`](docs/compliance/pipeda-readiness.md)
  before changing data-collection scope, consent flows, retention windows,
  or subprocessor configuration.
- Audit-log every event listed in
  [`docs/compliance/audit-log-requirements.md`](docs/compliance/audit-log-requirements.md);
  if a new feature collects or exposes a new data class, extend the
  list in the same PR.
- Treat [`docs/compliance/breach-response.md`](docs/compliance/breach-response.md)
  as the authoritative incident runbook — keep it accurate; stale
  contacts and templates are worse than none.
- Vendor changes touching personal information require
  [`docs/compliance/subprocessors.md`](docs/compliance/subprocessors.md)
  updates in the same PR.

The compliance docs in this repo are starting-point templates, not legal
advice. Counsel review is required before any externally-facing artifact
(privacy policy, ToS, DPA, breach notification) is finalized.
