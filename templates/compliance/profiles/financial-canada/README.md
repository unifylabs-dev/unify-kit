<!--
templates/compliance/profiles/financial-canada/README.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# `financial-canada` — PIPEDA + FINTRAC + provincial securities (extends `baseline-pipeda`)

For Canadian financial-services projects: wealth management, advisory
platforms, KYC/AML-adjacent flows, lending products, and similar.
Extends `baseline-pipeda`. Adds FINTRAC AML/ATF obligations and a
provincial-securities-overview reference. Securities registration
itself is jurisdiction-specific and counsel-led; this profile gives
your team the scaffolding, not the registration.

## When to apply

- The project operates within (or alongside) a federally regulated
  reporting entity under the *Proceeds of Crime (Money Laundering)
  and Terrorist Financing Act* (PCMLTFA) — financial institutions,
  money services businesses, securities dealers, life insurance, real
  estate, accountants, BC notaries, casinos, dealers in precious
  metals/stones, mortgage brokers/lenders/administrators (effective
  Oct 2024), armoured car services (effective 2025), or any other
  reporting-entity sector defined by FINTRAC.
- The project handles client financial information that may attract
  provincial securities regulation (investment advice, portfolio
  management, exempt-market dealing, securities trading platform).
- The project handles personal information of customers receiving
  financial services in Canada.

If your project is purely a payments processor or PCI-scoped retail
service, this profile is **not** the right fit — those need PCI-DSS-
focused docs not included in v2 of the kit. Use this profile as
structural inspiration but expect to author additional documents.

## What this profile ships

```
docs/compliance/
├── fintrac-readiness.md           # PCMLTFA obligations checklist
├── provincial-securities-overview.md  # navigation to provincial regulators
├── breach-response.md              # PIPEDA + financial overlays (replaces baseline)
├── privacy-policy.md               # financial-flavored (replaces baseline)
├── subprocessors.md                # financial-vendor scope (replaces baseline)
└── audit-log-requirements.md       # financial-event logging (replaces baseline)
runbooks/
└── access-revocation.md            # financial-flavored (replaces baseline)
CLAUDE.md (addendum appended)       # PIPEDA + FINTRAC + securities footprint
```

This profile inherits `baseline-pipeda`'s
[`vendor-escape-template.md`](../baseline-pipeda/runbooks/vendor-escape-template.md);
it is not duplicated here.

## Regulators covered

- **PIPEDA** — inherited from `baseline-pipeda`.
- **FINTRAC** — Financial Transactions and Reports Analysis Centre of
  Canada; AML/ATF supervisor under the PCMLTFA. Authoritative guidance:
  <https://fintrac-canafe.canada.ca/guidance-directives/guidance-directives-eng>
  (accessed 2026-05-12).
- **Provincial securities commissions** — Canadian Securities
  Administrators (CSA) members: OSC (Ontario), BCSC (BC), ASC
  (Alberta), AMF (Quebec), FCAA (Saskatchewan), MSC (Manitoba), and
  others. See [`docs/compliance/provincial-securities-overview.md`](docs/compliance/provincial-securities-overview.md)
  for the full set.
- **OBSI** — Ombudsman for Banking Services and Investments;
  external complaints handling: <https://www.obsi.ca/> (accessed
  2026-05-12).
- **OSFI** — Office of the Superintendent of Financial Institutions
  (federally regulated financial institutions only — banks,
  federally regulated trust + loan, federally regulated insurance).

## What this profile does **not** cover

- US securities law (SEC, FINRA) — out of scope for v2.
- PCI-DSS payment card processing — out of scope for v2.
- Specific Canadian sector frameworks (insurance distribution under
  provincial regulators, mortgage broker licensing rules per
  province) — adapt this profile or author project-specific docs.

## Working with these templates

> **These templates are starting points, not legal advice.** Financial
> compliance in Canada is fragmented across federal (FINTRAC, OSFI),
> provincial (securities commissions, insurance regulators), and
> sector-specific bodies. Counsel review and a current registration
> assessment are required before relying on this profile for any
> regulated activity.

## Composition note

When you install `baseline-pipeda` + `financial-canada`:

1. baseline files are written first.
2. financial-canada files overwrite where basenames collide:
   `breach-response.md`, `privacy-policy.md`, `subprocessors.md`,
   `audit-log-requirements.md`, `runbooks/access-revocation.md`.
3. `pipeda-readiness.md` from baseline remains; `fintrac-readiness.md`
   and `provincial-securities-overview.md` from this profile are
   added.
4. Both `claude-md-addendum.md` blocks are appended to CLAUDE.md.

If you further add `general-soc2` (common for fintechs doing
enterprise sales), SOC 2 docs that share basenames with this profile
(`breach-response.md`, `audit-log-requirements.md`) will overwrite the
financial-canada versions in install order. Review
[`../../README.md`](../../README.md) §"Composition" for the worked
example.
