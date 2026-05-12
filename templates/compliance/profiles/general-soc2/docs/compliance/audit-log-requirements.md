<!--
templates/compliance/profiles/general-soc2/docs/compliance/audit-log-requirements.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")

When composed with baseline-pipeda, this file replaces baseline's
audit-log-requirements.md. SOC 2 CC4 (Monitoring) and CC6 (Access)
controls draw on the events documented here.
-->

# Audit Log Requirements (SOC 2-aligned)

> **This is a starting-point template, not audit advice.** SOC 2
> auditors evaluate whether logging supports detection (CC4) and
> access-control monitoring (CC6). Logs that are voluminous but
> unsearchable, or unsigned and modifiable, can be a control gap even
> when they technically exist.

A consumer of this profile renders this doc into their project's
`docs/compliance/audit-log-requirements.md`.

## Authoritative reference

- AICPA TSC CC4 + CC6 (Monitoring and Logical Access):
  <https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022>
  (accessed 2026-05-12).

## Events to log

### Authentication

(All events from the baseline PIPEDA list apply, plus:)

- SSO assertion (success / failure).
- MFA challenge (issued, completed, failed).
- API token creation, rotation, revocation.
- Service account / machine-identity authentication.

### Account lifecycle (joiner / mover / leaver)

- Account provisioning (with role grant on Day 1).
- Role grant / revoke.
- Account deactivation (separating the timestamp of "no longer
  active" from "deleted").
- Account deletion.
- Quarterly access-review attestation events.

### Data access and modification

- Read of customer data (where applicable to your TSC scope).
- Bulk export of customer data.
- Modification of customer data via support / staff tooling.
- Read of an audit log (logs about logs).
- Configuration change to security-critical systems.

### Change management (CC8)

- Code merge to production-bound branch.
- Production deploy initiated / succeeded / failed.
- Emergency change (bypass of normal review) — always logged with the
  reason and the post-hoc review record.
- Configuration change in production (security groups, IAM roles,
  feature flags affecting access control).

### Vulnerability + supply chain

- Vulnerability-scan run (with summary findings).
- Patch applied to a production component.
- Dependency upgrade to a production component.
- Security-policy exception granted (with expiration date).

### Vendor + subprocessor

- Subprocessor added / changed / removed.
- Vendor credential rotation.
- Vendor-incident notification received.

### Privacy operations (when P TSC in scope; otherwise inherited
from privacy profile)

- DSAR received / fulfilled / extended / denied.
- Consent grant / withdrawal.
- Data-export to a customer.
- Data-deletion executed.

## Required fields per event (SOC 2-aware)

Baseline fields plus:

| Field | Why |
|---|---|
| `system` | Which system emitted the log — auditors will sample by system. |
| `severity` | Triage hint for monitoring. |
| `policy_reference` (optional) | The policy / control this event evidences. |
| `change_ticket` (or "n/a") | Required for change-management events. |

## Integrity (SOC 2-relevant)

- **Append-only**: enforce at the storage layer, not just by
  application convention.
- **Tamper-evident**: managed store with no delete API, or hash-
  chained batches with the chain head stored separately.
- **Independent retention**: the system that emits the log must not
  be able to delete or modify the log retroactively.
- **Time integrity**: NTP-synced timestamps; log the source of
  timestamp drift if it occurs.

## Retention

- **12-month minimum** to cover a SOC 2 Type II audit period plus
  evidence look-back.
- **Longer where other regulations apply** — composed privacy profiles
  may push retention to 24 months (PIPEDA), 5 years (FINTRAC), or
  10+ years (PHIPA).
- **Auditor-sample-window protection**: do not delete logs from
  windows the auditor is likely to sample (typically the entire
  audit period plus a buffer).

## Review and monitoring (CC4)

- **Continuous alerting** on high-risk events (privileged-account
  use, emergency change, security-policy exception, large data
  export, MFA-fail spikes, after-hours admin actions).
- **Daily / weekly review** of alert dispositions by the security
  / operations team.
- **Monthly review** of access-control logs by the system owner.
- **Quarterly access review** — see
  [`../../runbooks/access-revocation.md`](../../runbooks/access-revocation.md)
  for the offboarding side; quarterly access reviews validate the
  joiner / mover side.

## Audit evidence

For each TSC criterion this logging supports, the audit will sample:

- Log samples from random times in the audit period.
- Evidence that alerts fired and were dispositioned (not just that
  alerts existed).
- Evidence that the review cadence operated (review tickets, sign-
  offs).
- Evidence that a vulnerability or incident detected here was
  routed to the IR program in
  [`breach-response.md`](breach-response.md).

## Related

- [`soc2-controls-mapping.md`](soc2-controls-mapping.md) — CC4, CC6,
  CC7, CC8 references this doc.
- [`breach-response.md`](breach-response.md) — detection flows.
- [`../../runbooks/access-revocation.md`](../../runbooks/access-revocation.md) —
  joiner / mover / leaver evidence.
- [`security-policies-index.md`](security-policies-index.md) —
  Logging policy lives here.
- baseline:
  [`../../baseline-pipeda/docs/compliance/audit-log-requirements.md`](../../baseline-pipeda/docs/compliance/audit-log-requirements.md).
