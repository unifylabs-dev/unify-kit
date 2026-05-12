<!--
templates/compliance/profiles/healthcare-phipa/README.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# `healthcare-phipa` — Ontario PHIPA (extends `baseline-pipeda`)

For projects that handle personal health information (PHI) in Ontario.
Extends `baseline-pipeda`: install both. PHIPA-specific docs in this
profile replace the baseline's privacy policy / breach response / audit
requirements where both define a file with the same basename.

## When to apply

- The project is operated by or for a Health Information Custodian (HIC)
  in Ontario (clinics, allied-health practices, hospitals, EHR/EMR
  platforms, medical-record management platforms).
- The project is acting as an Agent of a HIC under PHIPA s. 17 (e.g., a
  SaaS that processes PHI on behalf of a HIC tenant).
- The project handles "personal health information" as defined in
  PHIPA s. 4(1): identifying information about an individual relating
  to their physical or mental health, the provision of health care, a
  health card number, a substitute-decision-maker, etc.

If your project is not in Ontario but is in another province with a
distinct health-privacy statute (Alberta HIA, BC PIPA health regulations,
Quebec Law 25 health sections), use this profile as a structural model
but consult the applicable provincial law — `healthcare-phipa` is
Ontario-specific.

## What this profile ships

```
docs/compliance/
├── phipa-readiness.md         # PHIPA-specific readiness checklist (15 items)
├── breach-response.md          # PHIPA breach reporting (replaces baseline's)
├── privacy-policy.md           # PHIPA-flavored (replaces baseline's)
├── subprocessors.md            # health-sector vendor scope (replaces baseline's)
└── audit-log-requirements.md   # PHI access logging (replaces baseline's)
runbooks/
└── access-revocation.md        # PHIPA-flavored (replaces baseline's)
CLAUDE.md (addendum appended)   # PHIPA + PIPEDA footprint declaration
```

This profile inherits `baseline-pipeda`'s
[`vendor-escape-template.md`](../baseline-pipeda/runbooks/vendor-escape-template.md);
it is not duplicated here.

## Regulators covered

- **PHIPA** — Personal Health Information Protection Act, 2004, S.O.
  2004, c. 3, Sched. A. Authoritative text:
  <https://www.ontario.ca/laws/statute/04p03> (accessed 2026-05-12).
- **Information and Privacy Commissioner of Ontario (IPC)** —
  supervisory authority; <https://www.ipc.on.ca/> (accessed 2026-05-12).
- **PIPEDA baseline** — inherited from `baseline-pipeda` for any
  non-health personal information your project handles.

## What this profile does **not** cover

- US HIPAA — distinct framework; out of scope for v2.
- Other-province health privacy statutes (Alberta HIA, BC PIPA health
  regs, Quebec Law 25 health sections, Manitoba PHIA, etc.) — adapt
  this profile or compose a new one.
- HIC-to-HIC information-sharing agreements — content-rich enough to
  warrant a separate `[fill in: information-sharing-agreement.md]` doc
  in your project's repo.

## Working with these templates

> **These templates are starting points, not legal advice.** PHIPA
> obligations vary by HIC role (custodian vs. agent), data category, and
> the specifics of your services. Consult qualified Ontario health-
> privacy counsel before any of these documents leaves your repository.

## Composition note

When you install `baseline-pipeda` + `healthcare-phipa`:

1. baseline files are written first.
2. healthcare-phipa files overwrite where basenames collide:
   `breach-response.md`, `privacy-policy.md`, `subprocessors.md`,
   `audit-log-requirements.md`, `runbooks/access-revocation.md`.
3. `pipeda-readiness.md` from baseline remains (no PHIPA conflict).
4. `phipa-readiness.md` from this profile is added.
5. Both `claude-md-addendum.md` blocks are appended to CLAUDE.md
   (PIPEDA block first, then PHIPA block).

This composition order matches the "extends" mechanism documented in
[`../../README.md`](../../README.md).
