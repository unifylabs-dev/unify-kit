<!--
templates/compliance/profiles/healthcare-phipa/docs/compliance/audit-log-requirements.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")

When composed with baseline-pipeda, this file replaces baseline's
audit-log-requirements.md. PHIPA s. 10.1's electronic-audit-log
requirement is the controlling obligation for PHI; PIPEDA's
accountability framing continues to apply.
-->

# Audit Log Requirements (PHIPA + PIPEDA baseline)

> **This is a starting-point template, not legal advice.** PHIPA
> s. 10.1 requires HICs to maintain, audit, and monitor electronic
> records of accesses to PHI. The list below is a reasonable floor;
> your team should validate it against the IPC's published guidance
> for your sector (clinics, hospitals, allied health, etc.).

A consumer of this profile renders this doc into their project's
`docs/compliance/audit-log-requirements.md`. Compared to the baseline
PIPEDA list, this version adds PHI-specific access events and tighter
retention + integrity guidance.

## Authoritative reference

- PHIPA s. 10.1 (electronic audit log requirement):
  <https://www.ontario.ca/laws/statute/04p03> (accessed 2026-05-12).
- IPC published guidance for HICs on electronic records and audit:
  <https://www.ipc.on.ca/en/health-organizations> (accessed 2026-05-12).

## Events to log

### Authentication

(All events from the baseline PIPEDA list apply.)

### PHI access (PHIPA s. 10.1)

**Every** read of a record of PHI in electronic form is logged. This
is non-negotiable under PHIPA s. 10.1.

- Read of a patient/client record (chart, file).
- Read of a specific record field marked as sensitive (e.g.,
  reproductive health, mental health, substance use).
- Read of an audit log entry (logs about logs — to detect log access
  by unauthorized actors).
- Bulk export of PHI (always log + alert).
- API token use against a PHI endpoint.

### PHI write

- Create / update / delete of a PHI record.
- Finalization of a clinical document (after which it is immutable in
  the user-facing system).
- Append of a clinical note to an existing record.
- Reassignment of a record from one practitioner to another.

### Consent and lockbox

- Consent grant (purpose + version).
- Consent withdrawal.
- Lockbox instruction issued (record-level or field-level).
- Lockbox override under PHIPA s. 37(1)(a) "significant harm"
  exception — high-risk; always log with explicit reason field +
  manager approval.

### Care-context events

- Practitioner assignment / unassignment from a patient/client.
- Appointment access (read of clinical content tied to an
  appointment).
- Referral creation / completion (PHI moves between providers).

### Administrative actions

- Admin / staff impersonation of a user account (high-risk; always
  log with explicit reason field).
- Bulk action by staff.
- Subprocessor configuration change.
- Access to the breach register itself.

## Required fields per event (PHIPA-aware)

Adds to the baseline list:

| Field | Why |
|---|---|
| `actor_role` | Practitioner vs. staff vs. patient vs. admin — needed to evaluate "appropriate access" under PHIPA. |
| `patient_id` (or "n/a" for non-PHI events) | The data subject — required for PHIPA s. 52 access-log export. |
| `phi_access_reason` (free-form or enum) | Why this access happened — supports access-appropriateness review. Empty for non-PHI events. |
| `appointment_id` (or "n/a") | Care-context link. |
| `lockbox_override_reason` | Required when overriding a lockbox; empty otherwise. |

## Integrity

- Logs are append-only.
- Logs are tamper-evident (managed store with no delete API, or
  hash-chained batches with the chain head stored separately).
- Audit log tables are subject to additional database-level controls
  (e.g., `INSERT-only` policies, separate retention enforcement
  job).
- Audit-log writes that fail are themselves an incident — surfaced
  to the on-call rotation.

## Retention

- **Minimum: 10 years** to align with common Ontario College
  records-retention guidance for clinical records (verify your specific
  College's requirement). Longer where contractually or statutorily
  required.
- The PIPEDA 24-month breach-record retention floor is implicitly
  exceeded by the above.

## Review cadence

- **Continuous**: anomaly detection on high-risk event types — bulk
  exports, lockbox overrides, impersonation, after-hours PHI access,
  high-volume access by a single actor.
- **Weekly**: lightweight review by the operations lead.
- **Quarterly**: deeper review by the privacy officer; sample of raw
  events + targeted "appropriate-access" reviews.
- **Annual statistical reporting (O. Reg. 224/17)**: aggregate counts
  by category submitted to the IPC by March 1 of the following year.

## Patient/client access to their own audit log

- The IPC's interpretation of PHIPA s. 52 supports patients/clients
  having visibility into who has accessed their record.
- Build the access-log-export capability into the patient portal
  (where one exists) from the start; retrofitting is harder.

## Access to audit logs

- Read access: limited to the privacy officer, security/operations
  lead, and (per PHIPA s. 52 interpretation) the patient/client for
  their own record.
- Subpoena / regulator: response is coordinated through legal counsel.

## Related

- [`phipa-readiness.md`](phipa-readiness.md) items 7 and 8.
- [`breach-response.md`](breach-response.md) — Phase 1 (Detect) and
  Phase 2 (Triage) rely on the events above.
- [`../../runbooks/access-revocation.md`](../../runbooks/access-revocation.md) —
  PHI-access reconciliation pass uses the audit log.
- baseline:
  [`../../baseline-pipeda/docs/compliance/audit-log-requirements.md`](../../baseline-pipeda/docs/compliance/audit-log-requirements.md).
