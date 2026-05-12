<!--
templates/compliance/profiles/general-soc2/docs/compliance/security-policies-index.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Security Policies Index (SOC 2)

> **This is a starting-point template, not audit advice.** A SOC 2
> audit will sample policy artifacts the organization has committed to
> in its TSC controls mapping. This index tracks which policies exist,
> where they live, who owns them, and when they were last reviewed.

A consumer of this profile renders this doc into their project's
`docs/compliance/security-policies-index.md`. The minimum policy set
below covers the Common Criteria; specific TSC categories may require
additional artifacts (e.g., a documented BCP/DR plan if Availability is
in scope).

## How to use this index

When an auditor asks "do you have a policy that addresses access
control?" the answer they want is "yes — here's where it lives, when
we last reviewed it, and who's responsible." This index makes that
answer immediate.

## Minimum policy set

| Policy | Lives at | Owner | Last reviewed | Cadence |
|---|---|---|---|---|
| Code of Conduct / Ethics | `[fill in: path or doc URL]` | `[fill in: role]` | `[fill in: YYYY-MM-DD]` | annual |
| Acceptable Use | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Information Security | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Access Control | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Password / Authentication | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Data Classification | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Encryption / Cryptography | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Change Management | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Secure Development | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Incident Response | breach-response.md | `[fill in]` | `[fill in]` | annual (+ post-incident) |
| Vendor / Third-Party Management | `[fill in: vendor-management policy + runbooks/vendor-management.md]` | `[fill in]` | `[fill in]` | annual |
| Business Continuity + Disaster Recovery | `[fill in]` | `[fill in]` | `[fill in]` | annual (+ exercise) |
| Backup + Restoration | `[fill in]` | `[fill in]` | `[fill in]` | annual (+ restore test) |
| Risk Assessment | `[fill in]` | `[fill in]` | `[fill in]` | annual |
| Security Awareness + Training | `[fill in]` | `[fill in]` | `[fill in]` | annual + onboarding |
| Logging + Monitoring | audit-log-requirements.md | `[fill in]` | `[fill in]` | annual |
| Asset Inventory | `[fill in]` | `[fill in]` | `[fill in]` | quarterly |
| Vulnerability Management | `[fill in]` | `[fill in]` | `[fill in]` | annual (+ scan cadence) |
| Physical / Workplace Security | `[fill in or "n/a — cloud-only operations"]` | `[fill in]` | `[fill in]` | annual |
| HR Security (onboarding / offboarding) | runbooks/access-revocation.md (offboarding) + `[fill in: onboarding doc]` | `[fill in]` | `[fill in]` | annual |
| Customer Data Handling / Retention | `[fill in: relates to data-classification + privacy profile]` | `[fill in]` | `[fill in]` | annual |
| Mobile Device / BYOD | `[fill in or "n/a"]` | `[fill in]` | `[fill in]` | annual |

## Optional policies (TSC-dependent)

Add when relevant scope is in audit:

- **Privacy Policy** (P TSC in scope) — see composed privacy
  profile's `privacy-policy.md`.
- **Availability SLA Policy** (A TSC in scope).
- **Processing Integrity Policy** (PI TSC in scope).
- **Code-Signing / Software Supply Chain Policy** (where you ship
  signed artifacts).

## Review cadence

- **Annual review** — every policy reviewed and signed by its
  owner at least once per audit period.
- **Triggered review** — material change to the underlying control
  (new system, new vendor category, incident lessons-learned)
  triggers an out-of-cadence review.
- **Pre-audit refresh** — within 60 days of the audit start, every
  policy is reviewed and dates are current.

## Storage

Policy documents live in `[fill in: e.g., a "compliance/" folder in
the repo with read access controls; a Notion / Confluence space; a
GRC tool]`. Wherever they live, three properties must hold:

1. **Versioned** — older versions retrievable so the auditor can see
   the policy that was in effect during the audit period.
2. **Acknowledged** — for policies that bind staff (acceptable use,
   code of conduct, etc.), acknowledgement records are kept.
3. **Linked** — controls in
   [`soc2-controls-mapping.md`](soc2-controls-mapping.md) reference
   the policy by path / URL, not by name only.

## Related

- [`soc2-controls-mapping.md`](soc2-controls-mapping.md)
- [`breach-response.md`](breach-response.md) (Incident Response policy)
- [`audit-log-requirements.md`](audit-log-requirements.md) (Logging
  policy)
- [`../../runbooks/vendor-management.md`](../../runbooks/vendor-management.md)
  (Vendor Management policy)
- [`../../runbooks/access-revocation.md`](../../runbooks/access-revocation.md)
  (HR Security offboarding)
