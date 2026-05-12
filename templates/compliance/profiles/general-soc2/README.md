<!--
templates/compliance/profiles/general-soc2/README.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# `general-soc2` — SOC 2 Trust Services Criteria (independent profile)

For B2B SaaS projects that run vendor-security reviews with enterprise
customers and need SOC 2 audit-readiness scaffolding. **SOC 2 is a
framework, not a law.** This profile is not a substitute for a privacy
regulation in your jurisdiction; compose alongside `baseline-pipeda`
(or whichever Canadian profile applies) if you operate in Canada.

## When to apply

- Your customers ask for a SOC 2 Type II report as part of vendor
  security reviews.
- You are pre-audit and want documentation in place before engaging
  a CPA firm.
- You have a SOC 2 Type II in hand and want the docs in this profile
  to align your internal procedures with the controls auditors looked
  at.
- You are early-stage and want the SOC 2 control language available so
  your security posture can be described in vendor-review questionnaires
  without making claims you can't substantiate.

If you don't sell into customers who care about SOC 2, this profile
is overkill — composing it adds documentation maintenance overhead
without an external audience pulling on it.

## What this profile ships

```
docs/compliance/
├── soc2-controls-mapping.md       # Trust Service Criteria → controls map
├── security-policies-index.md     # policies an auditor expects to see
├── breach-response.md              # NIST 800-61-aligned IR (replaces baseline)
└── audit-log-requirements.md       # SOC 2-aligned logging (replaces baseline)
runbooks/
├── access-revocation.md            # SOC 2-aligned (replaces baseline)
└── vendor-management.md            # vendor risk assessment template
CLAUDE.md (addendum appended)       # SOC 2 footprint declaration
```

**This profile does not ship `privacy-policy.md` or
`pipeda-readiness.md`** — SOC 2 doesn't define a privacy policy.
If you need a privacy policy, compose with the Canadian profile that
matches your circumstances (`baseline-pipeda` at minimum).

This profile inherits `baseline-pipeda`'s
[`vendor-escape-template.md`](../baseline-pipeda/runbooks/vendor-escape-template.md);
it is not duplicated here. `vendor-management.md` (in this profile) is
the upstream risk-assessment process; `vendor-escape-template.md` (in
baseline) is the downstream migration runbook.

## Framework covered

- **SOC 2** — AICPA's System and Organization Controls 2; an audit
  framework, not a regulatory standard. Auditors evaluate the
  organization against the Trust Services Criteria (TSC). Authoritative
  reference: 2017 Trust Services Criteria (with Revised Points of Focus
  — 2022):
  <https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022>
  (accessed 2026-05-12).
- **NIST SP 800-61 (Computer Security Incident Handling Guide)** —
  cited by SOC 2 audits as a common IR-program reference; informs the
  breach-response runbook in this profile.

## What this profile does **not** cover

- HIPAA, ISO 27001, FedRAMP, PCI-DSS — distinct frameworks. SOC 2 is
  often used **alongside** ISO 27001; this profile only addresses
  SOC 2 directly.
- Privacy law for any jurisdiction — compose `baseline-pipeda` (or
  jurisdiction-equivalent).
- The auditor relationship itself (engaging a CPA firm, scoping the
  audit, evidence collection workflows). Those decisions are project-
  specific.

## Working with these templates

> **These templates are starting points, not legal advice and not
> audit advice.** SOC 2 audit-readiness requires a CPA firm's
> engagement, evidence collection across the audit period, and
> management's commitment to the controls described. The documents
> in this profile are scaffolding for that effort, not a substitute.

## TSC scope selection

A SOC 2 audit covers one or more of the five Trust Services Criteria:

- **Security** — common criteria; effectively mandatory.
- **Availability** — uptime / performance / resilience.
- **Processing Integrity** — system processes data completely,
  accurately, timely, and with authorization.
- **Confidentiality** — information designated as confidential is
  protected per commitments.
- **Privacy** — personal information is collected, used, retained,
  disclosed, and disposed of per commitments and applicable criteria.

Most early-stage B2B SaaS projects target **Security + Availability +
Confidentiality**. Add Processing Integrity if your service performs
quantitative computations customers rely on; add Privacy if your
contractual posture or jurisdiction expectations call for it.

The scope you select drives which criteria
[`docs/compliance/soc2-controls-mapping.md`](docs/compliance/soc2-controls-mapping.md)
must cover.

## Composition note

When you install `baseline-pipeda` + `general-soc2`:

1. baseline files are written first.
2. general-soc2 files overwrite where basenames collide:
   `breach-response.md`, `audit-log-requirements.md`,
   `runbooks/access-revocation.md`.
3. baseline's `privacy-policy.md`, `subprocessors.md`,
   `pipeda-readiness.md` remain.
4. general-soc2's `soc2-controls-mapping.md`,
   `security-policies-index.md`, and `runbooks/vendor-management.md`
   are added.
5. Both `claude-md-addendum.md` blocks are appended to CLAUDE.md.

For three-way composition with `financial-canada`, see the worked
example in [`../../README.md`](../../README.md).
