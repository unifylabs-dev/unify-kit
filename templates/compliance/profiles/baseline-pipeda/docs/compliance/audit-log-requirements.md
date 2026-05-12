<!--
templates/compliance/profiles/baseline-pipeda/docs/compliance/audit-log-requirements.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Audit Log Requirements (PIPEDA baseline)

> **This is a starting-point template, not legal advice.** PIPEDA does
> not prescribe a specific audit-log schema, but accountability
> (Principle 1) and safeguards (Principle 7) require records adequate to
> detect, investigate, and respond to security events. The list below is
> a reasonable floor for a Canadian SaaS project; your team should adapt
> it to your stack.

A consumer of this profile renders this doc into their project's
`docs/compliance/audit-log-requirements.md`. The events listed below are
the minimum a Canadian project handling personal information should log;
profile compositions extend the list (e.g., `healthcare-phipa` adds PHI
read events; `financial-canada` adds transaction events).

## Events to log

### Authentication

- Successful login — actor, timestamp, IP, user-agent, auth method.
- Failed login — same, plus failure reason (bad-credentials, locked,
  MFA-failed). Log the *attempt*, not the credential.
- Logout (explicit + session expiry).
- Account lockout (threshold reached).
- Password change / reset request / reset completion.
- MFA enrolment / removal.
- New-device or new-location sign-in.

### Account lifecycle

- Account creation.
- Account deletion (request + completion).
- Account role grant / revoke.
- Email or other identifier change.
- Subscription / billing change that affects access scope.

### Data access (where applicable)

- Bulk export of personal data (always log).
- Access to a sensitive resource (e.g., another user's profile, audit
  log review).
- API token use against scoped resources.

### Consent

- Consent grant (purpose + version of policy).
- Consent withdrawal.
- Marketing-email opt-in (CASL evidence).
- Marketing-email opt-out (CASL evidence).

### Administrative actions

- Admin / staff impersonation of a user account (high-risk; always log
  with explicit reason field).
- Bulk action by staff (e.g., mass-update, mass-delete).
- Subprocessor configuration change.

## Required fields per event

| Field | Why |
|---|---|
| `actor_id` (or "anonymous" / "system") | Who. |
| `event_type` | What kind of event. |
| `event_outcome` (`success` / `failure` / `denied`) | Result. |
| `resource_type` + `resource_id` | What was acted upon, if applicable. |
| `timestamp` (UTC, ISO-8601 with ms precision) | When. |
| `ip_address` + `user_agent` | Source context. |
| `metadata` (JSON) | Free-form, schema-evolvable extras. |

**Do not log** the secret values being audited — log the *attempt*, not
the *credential*. Hashes are fine; raw tokens or passwords never.

## Integrity

- Logs are append-only. No update or delete from application code.
- Logs are tamper-evident. Options:
  - Write to a managed log store the application cannot delete (most
    cloud providers offer this).
  - Periodic hash-chaining of log batches with the chain head stored
    separately.
  - Database-level `INSERT-only` policies + a separate retention
    enforcement job.

## Retention

- Minimum: **24 months** to align with the PIPEDA breach-record-keeping
  requirement (PIPEDA Breach of Security Safeguards Regulations s. 6).
- Longer if other regulations apply (financial, health). Profile
  composition raises the floor where needed.
- Retention end-of-life is also logged (purge events are themselves
  audit events).

## Review cadence

- **Continuous**: anomaly detection on high-risk event types
  (impersonation, bulk delete, failed-login spikes).
- **Weekly**: lightweight review of summary metrics by the security or
  operations lead.
- **Quarterly**: deeper review by the accountable officer; sample of
  raw events, plus completeness check (did every system that should be
  logging actually log?).

## Access to audit logs

- Read access: limited to the security / operations team and the
  accountable officer.
- Self-service: where applicable, individuals should be able to see
  their own auth events (sign-in history) — supports PIPEDA Principle
  9 (Individual Access).
- Subpoena / regulator: response is coordinated through legal counsel.

## Related

- [`pipeda-readiness.md`](pipeda-readiness.md) Principle 7 (Safeguards) +
  Principle 1 (Accountability).
- [`breach-response.md`](breach-response.md) — Phase 1 (Detect) and Phase
  2 (Triage) rely on the events above.
- [`../../runbooks/access-revocation.md`](../../runbooks/access-revocation.md) —
  audit-log entries for role-grant / revoke / staff-impersonation events
  are part of this runbook's evidence trail.
