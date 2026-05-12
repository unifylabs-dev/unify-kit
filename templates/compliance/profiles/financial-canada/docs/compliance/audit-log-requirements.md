<!--
templates/compliance/profiles/financial-canada/docs/compliance/audit-log-requirements.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")

When composed with baseline-pipeda, this file replaces baseline's
audit-log-requirements.md.
-->

# Audit Log Requirements (Canadian financial)

> **This is a starting-point template, not legal advice.** Financial-
> services audit logging must satisfy PIPEDA, PCMLTFA record-keeping,
> securities-regulator record-keeping, and operational fiduciary
> diligence. The list below is a reasonable floor; specific record
> categories may require additional fields or longer retention.

A consumer of this profile renders this doc into their project's
`docs/compliance/audit-log-requirements.md`.

## Authoritative references

- PCMLTFA record-keeping:
  <https://fintrac-canafe.canada.ca/guidance-directives/guidance-directives-eng>
  (accessed 2026-05-12).
- Provincial-securities-regulator recordkeeping (jurisdiction-dependent):
  see [`provincial-securities-overview.md`](provincial-securities-overview.md).

## Events to log

### Authentication

(All events from the baseline PIPEDA list apply.)

### Account lifecycle

- Account creation (with KYC outcome captured separately).
- Account activation (post-KYC).
- Account suspension / hold (reason field required).
- Account closure.
- Beneficial-ownership update.
- Tax-residency update (FATCA / CRS implications).

### KYC and screening

- KYC verification submitted (with vendor name, outcome, timestamp).
- KYC re-verification.
- Sanctions screen hit (alert level, list source, disposition).
- PEP / HIO status change.
- Risk-rating reassessment (with prior and new rating).

### Transaction events

- Transaction created (initiated by client or staff).
- Transaction approved / executed.
- Transaction rejected (reason).
- Trade order placed / amended / cancelled.
- Trade execution.
- Settlement event.
- Failed-trade notification.
- Inbound / outbound EFT.
- Reportable cash transaction (LCTR data captured).
- Reportable virtual-currency transaction (LVCTR data captured).

### Advisory + suitability

- Suitability assessment recorded.
- Recommendation made to a client (with the rationale captured).
- Material change in client circumstances captured.

### Administrative actions

- Staff impersonation of a user account (high-risk; always log with
  explicit reason field).
- Bulk staff action.
- Subprocessor configuration change.
- Sanctions-list update applied.
- Risk-model parameter change.

### Document access

- Read of a client document (statements, tax forms, KYC documents).
- Bulk document export.

## Required fields per event (financial-aware)

Adds to the baseline list:

| Field | Why |
|---|---|
| `client_id` (or "n/a") | The data subject — required for client-facing audit. |
| `transaction_id` (or "n/a") | Links events to a transaction record. |
| `aml_flag` (`none` / `monitoring` / `escalated` / `STR_filed`) | AML pipeline status. |
| `sanctions_screen_result` (`pass` / `hit` / `cleared`) | Sanctions outcome. |
| `staff_acting_for_client_id` (or "n/a") | For staff actions on behalf of a client. |
| `regulator_relevance` (free-form or enum) | Flag events that should be available in a regulator examination. |

## Integrity

- Append-only.
- Tamper-evident (managed store or hash-chained).
- Sanctions and AML events are subject to a stricter integrity guarantee
  (separate write path + independent retention) to support regulator
  examinations.

## Retention

- **Minimum: 5 years** to align with PCMLTFA record-keeping.
- **Provincial securities minimums**: jurisdiction-dependent —
  commonly 7 years. The longer minimum controls.
- The PIPEDA 24-month breach-record floor is implicitly exceeded.

## Review cadence

- **Continuous** — anomaly detection on transaction patterns, sanctions
  hits, after-hours trading, large transfers, structuring-pattern
  detection.
- **Weekly** — review of pending STR queue + sanctions alerts.
- **Quarterly** — risk-rating recalibration; sample of high-risk
  client transactions.
- **Annual** — full compliance-program review (feeds the two-year
  effectiveness review under PCMLTFA).

## Access to audit logs

- Read access: AML compliance officer, security/operations, legal
  counsel, internal auditors.
- Regulator (FINTRAC, securities commission, OBSI investigations):
  coordinated through legal counsel.
- Client self-service for their own transaction history: yes (separate
  from the full audit-log dataset).

## Related

- [`fintrac-readiness.md`](fintrac-readiness.md) — STR / LCTR /
  LVCTR / EFTR reporting pipelines.
- [`provincial-securities-overview.md`](provincial-securities-overview.md) —
  registrant record-keeping.
- [`breach-response.md`](breach-response.md) — incident evidence.
- [`../../runbooks/access-revocation.md`](../../runbooks/access-revocation.md) —
  AML-pipeline access revocation.
- baseline:
  [`../../baseline-pipeda/docs/compliance/audit-log-requirements.md`](../../baseline-pipeda/docs/compliance/audit-log-requirements.md).
