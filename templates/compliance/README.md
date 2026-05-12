<!--
templates/compliance/README.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Index for the per-project compliance subsystem. Phase 2 of run
2026-05-12-unify-kit-v2 seeded the framing; phase 3 filled the four
profiles and the /compliance-research skill body.
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

Profiles compose by extension, not inheritance. `healthcare-phipa` extends
`baseline-pipeda` — meaning a PHIPA-bound project installs both profiles'
docs (PIPEDA covers the Canadian privacy floor; PHIPA adds the Ontario-
health-information specifics on top).

> **Status (2026-05-12, phase 3 of v2 reshape)**: profile content is
> authored and lives under `profiles/<slug>/`. The `--compliance=<profile>`
> flag wiring in `scripts/init-project.sh` is phase 4 of the v2 reshape;
> until phase 4 lands, manual `cp` from a profile directory into a project
> is the install path.

## When to use each profile

| Profile | Regulators / standards | When to use |
|---|---|---|
| `baseline-pipeda` | PIPEDA + provincial privacy law (Canada) | Any Canadian-based project handling personal information. The default floor. |
| `healthcare-phipa` | PHIPA (Ontario) + PIPEDA baseline | Health-information custodians or agents handling personal health information in Ontario (clinics, allied-health practices, EHR/EMR platforms). Extends baseline. |
| `financial-canada` | PIPEDA + FINTRAC + provincial securities | Canadian financial-services projects (wealth management, KYC, AML-adjacent flows, lending). Extends baseline. |
| `general-soc2` | SOC 2 Trust Services Criteria (AICPA, 2017 + 2022 revision) | B2B SaaS targeting enterprise customers running vendor-security reviews. Framework not law. Compose alongside `baseline-pipeda` if Canadian. |

Profiles beyond these four (GDPR, HIPAA-US, CCPA, FERPA, PCI-DSS) are
deferred — added when a project actually needs them.

## Profile structure

Each profile directory is self-contained:

```
profiles/<slug>/
├── README.md                                # when to use; regulators covered
├── docs/compliance/
│   ├── <regulator>-readiness.md.template   # gap analysis + status checklist
│   ├── breach-response.md.template          # notification rules + timelines
│   ├── privacy-policy.md.template           # public-facing notice (Canadian profiles only)
│   ├── subprocessors.md.template            # vendor list + scope (Canadian profiles only)
│   └── audit-log-requirements.md            # events that MUST be logged (no placeholders)
├── runbooks/
│   ├── access-revocation.md.template
│   └── vendor-escape-template.md            # baseline-pipeda only; others inherit
└── claude-md-addendum.md                    # block appended to project CLAUDE.md
```

Files with the `.md.template` suffix carry `{{...}}` placeholders that
`init-project.sh` substitutes at install time. Plain `.md` files are
copied as-is (they are reference docs without per-project fields).

The exact file list varies by profile. PHIPA adds the PHIPA-readiness
checklist; `financial-canada` adds `fintrac-readiness.md.template` and
the `provincial-securities-overview.md` reference; `general-soc2` adds
`soc2-controls-mapping.md.template`, `security-policies-index.md`, and
the `vendor-management.md.template` runbook.

## Composition (extends mechanism)

When you install multiple profiles, files are written in order:

1. The Canadian baseline (`baseline-pipeda`) — if applicable — writes
   first.
2. Extending profiles (`healthcare-phipa`, `financial-canada`) overwrite
   where basenames collide. The extender's version of
   `breach-response.md`, `privacy-policy.md`, `subprocessors.md`,
   `audit-log-requirements.md`, and `runbooks/access-revocation.md`
   replaces baseline's.
3. `general-soc2` is independent (not Canadian privacy law) but composes
   with a Canadian profile when appropriate. If composed last, its
   versions of `breach-response.md`, `audit-log-requirements.md`, and
   `runbooks/access-revocation.md` win. `general-soc2` adds its own
   non-conflicting files (`soc2-controls-mapping.md.template`,
   `security-policies-index.md`, `runbooks/vendor-management.md.template`).
4. Each profile's `claude-md-addendum.md` is appended to the project's
   `CLAUDE.md` in install order.

This phase ships the profile content; the actual install + overwrite
logic is phase 4's job (`scripts/init-project.sh`).

## Worked examples

### Example 1 — Default Canadian project

```
init-project.sh --compliance=baseline-pipeda
```

Result: PIPEDA principles + breach response + privacy policy +
subprocessors + audit-log requirements + access-revocation + vendor-
escape runbook. The default floor; anything from a hobby project up to
an early-stage B2B starts here.

### Example 2 — Ontario clinic / allied-health platform

```
init-project.sh --compliance=baseline-pipeda --compliance=healthcare-phipa
```

Result: PIPEDA framing + PHIPA-specific readiness, breach response
(stricter threshold, "at the first reasonable opportunity"), privacy
policy with PHI sections, audit log requirements with PHIPA s. 10.1
specifics, PHIPA-flavored access-revocation runbook. Use for projects
like a Toronto allied-health clinic, an Ontario EMR vendor, a telemedicine
platform serving Ontario practices.

### Example 3 — Canadian fintech doing enterprise sales

```
init-project.sh --compliance=baseline-pipeda --compliance=financial-canada --compliance=general-soc2
```

Result: PIPEDA framing + FINTRAC + provincial-securities-overview +
SOC 2 controls mapping + SOC 2 security-policies index + SOC 2 IR
runbook (replaces baseline's breach response) + SOC 2 audit-log
requirements (replaces baseline's) + SOC 2 access-revocation
(replaces baseline's). Privacy policy and subprocessors come from
`financial-canada`. The `general-soc2` vendor-management runbook is
added; the baseline `vendor-escape-template.md` remains.

Conflict resolution in this three-way composition: SOC 2 docs are
installed last and win on overlapping basenames (`breach-response.md`,
`audit-log-requirements.md`, `runbooks/access-revocation.md`). Each
profile's claude-md-addendum is appended in install order, so the
final `CLAUDE.md` carries PIPEDA + financial + SOC 2 footprint blocks.

## The `claude-md-addendum.md` pattern

Each profile ships a `claude-md-addendum.md` block that `init-project.sh`
appends to the project's `CLAUDE.md`. The block declares the active
profile, lists the relevant docs/runbooks, and reminds Claude sessions
of the compliance commitments. See each profile's `claude-md-addendum.md`
for the actual content; the `{{COMPLIANCE_PROFILE}}` placeholder is
substituted by `init-project.sh` with the literal profile slug.

## The `/compliance-research` skill

For projects where the right profile isn't obvious (multiple
jurisdictions, mixed data classes, evolving regulatory landscape),
invoke the `/compliance-research` skill from the `unifylabs-workflow`
plugin. It walks through industry / geography / data classes / customer
geography questions, recommends a profile (or composition), gap-
analyzes existing docs, and uses `context7` + WebSearch to ground
recommendations on current regulations (training data goes stale fast
for compliance — verify before you ship).

The skill writes its output to
`docs/compliance/research-notes/<date>-<topic>.md` so the rationale
for a profile pick stays in the repo.

## Adding a profile

Profiles live under `templates/compliance/profiles/<slug>/`. To propose
a new one, open an issue with the regulator + jurisdiction + project
shape the profile would serve. Profile content lands when at least one
real project needs it; speculative additions get deferred.

Profile-author checklist (when contributing a new profile):

- [ ] `README.md` — when to use; regulators covered; composition
      notes; "not legal advice" framing.
- [ ] One `<regulator>-readiness.md.template` per primary regulator.
- [ ] `breach-response.md.template` — incident runbook aligned to the
      profile's reporting obligations.
- [ ] `privacy-policy.md.template` — if the regulator implies one
      (skip for framework-only profiles like SOC 2).
- [ ] `subprocessors.md.template` — vendor scope.
- [ ] `audit-log-requirements.md` — events + retention + integrity.
- [ ] `runbooks/access-revocation.md.template` — joiner / mover /
      leaver flow.
- [ ] `claude-md-addendum.md` — CLAUDE.md block.
- [ ] Each customer-facing `.md.template` opens with the "not legal
      advice" disclaimer.
- [ ] Each regulatory claim links to an authoritative source URL with
      access date.
- [ ] Composition documented in this README's "Worked examples".

## Disclaimer (applies to every profile)

The compliance docs in this directory are starting-point templates,
not legal advice and not audit advice. Counsel review is required
before relying on any document in any profile for any compliance
purpose. Regulator pages and statutory text evolve; the access dates
on regulatory citations indicate when the relevant page was last
checked — verify before relying on summaries.
