<!--
templates/compliance/README.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Index for the per-project compliance subsystem. Profile content (the actual
regulator-specific docs + runbooks + claude-md addendum) is filled by
phase 3 of run 2026-05-12-unify-kit-v2; this README ships the framing.
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Compliance profiles

A **compliance profile** is a curated set of jurisdiction- and industry-
specific docs that get installed into a project's `docs/compliance/` and
`runbooks/` directories when the user runs `init-project.sh` with
`--compliance=<profile>`. Each profile also ships a `claude-md-addendum.md`
that gets appended to the project's `CLAUDE.md` so every Claude Code session
knows which regulator footprint the project is operating under.

Profiles compose by extension, not by inheritance. `healthcare-phipa` extends
`baseline-pipeda` — meaning a PHIPA-bound project installs both profiles' docs
(PIPEDA covers the Canadian privacy floor; PHIPA adds the Ontario-health-
information specifics on top).

## When to use each profile

| Profile | Regulators / standards | When to use |
|---|---|---|
| `baseline-pipeda` | PIPEDA + provincial privacy law (Canada) | Any Canadian-based project handling personal information. The default floor. |
| `healthcare-phipa` | PHIPA (Ontario) + PIPEDA baseline | Health-information custodians or agents handling personal health information in Ontario (clinics, allied-health practices, medical-record platforms). |
| `financial-canada` | PIPEDA + FINTRAC + provincial securities | Canadian financial-services projects (wealth management, KYC, AML-adjacent flows). |
| `general-soc2` | SOC 2 Trust Services Criteria | B2B SaaS targeting enterprise customers who run vendor security reviews. Not jurisdiction-bound. |

Profiles beyond these four (GDPR, HIPAA-US, CCPA, FERPA, PCI-DSS) are
deferred — added when a project actually needs them. The set above covers the
shapes currently in active use; expanding speculatively bloats the kit
without earning adoption.

## What each profile installs

```
docs/compliance/<regulator>-readiness.md   # gap analysis + status checklist
docs/compliance/breach-response.md         # notification rules + timelines
docs/compliance/privacy-policy.md          # user-facing privacy notice template
docs/compliance/subprocessors.md           # vendor list + scope of data sharing
docs/compliance/audit-log-requirements.md  # events that MUST be logged
runbooks/access-revocation.md              # offboarding / lost-device flow
CLAUDE.md (addendum appended)              # one-paragraph footprint declaration
```

The exact file list varies by profile. PHIPA adds a 24-hour breach-
notification runbook; financial-Canada adds FINTRAC reporting; SOC 2 adds
control-mapping artifacts.

## The `claude-md-addendum.md` pattern

When `init-project.sh` applies a profile, it appends a block to the project's
`CLAUDE.md` declaring the active profile. The shipped addendum looks like:

```markdown
## Compliance footprint

This project is operating under the **{{COMPLIANCE_PROFILE}}** compliance
profile. See `docs/compliance/` for the full set of policies and
`runbooks/` for response procedures. When implementing features that
touch personal data, the Claude session should read the relevant profile
doc before proposing changes.
```

`{{COMPLIANCE_PROFILE}}` is substituted by `init-project.sh` with the literal
profile slug (e.g. `healthcare-phipa`).

## The `/compliance-research` skill

For projects where the right profile isn't obvious (multiple jurisdictions,
mixed data classes, evolving regulatory landscape), invoke the
`/compliance-research` skill from the `unifylabs-workflow` plugin. It walks
through industry / geography / data classes / customer geography questions,
recommends a profile (or composition), gap-analyzes existing docs, and uses
`context7` + WebSearch to ground recommendations on current regulations
(training data goes stale fast for compliance — verify before you ship).

The skill writes its output to `docs/compliance/research-notes/<date>-<topic>.md`
so the rationale for a profile pick stays in the repo.

## Adding a profile

Profiles live under `templates/compliance/profiles/<slug>/`. To propose a new
one, open an issue with the regulator + jurisdiction + project shape the
profile would serve. Profile content lands when at least one real project
needs it; speculative additions get deferred.
