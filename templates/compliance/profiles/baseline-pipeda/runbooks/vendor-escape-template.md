<!--
templates/compliance/profiles/baseline-pipeda/runbooks/vendor-escape-template.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern reference: vendor-escape-template lifted structurally from a real
  project's compliance set; prose authored independently for the kit.
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Runbook — Vendor Escape

> **This is a starting-point template, not legal advice.** Each vendor
> migration has unique technical and contractual factors; counsel
> involvement is appropriate where the vendor handled personal
> information.

Use this template when a trigger condition forces migration off a vendor
(pricing change, vendor shutdown, ToS change, security incident,
performance regression, or compliance posture change). Clone this file
to `vendor-escape-<vendor-slug>.md` in the project's `runbooks/` folder,
fill the placeholders, and follow the steps.

---

## Vendor Escape — `<VENDOR_NAME>`

**Trigger**: `<what happened that forced this>`
**Linked ADR / decision doc**: `<path/to/decision-doc>`
**Started**: `<YYYY-MM-DD>`
**Lead**: `<person>`

---

## Pre-flight

- **Access required**: `<list of accounts / credentials>`
- **Estimated effort**: `<engineer-days; risk buffer included>`
- **Blast radius**: `<which apps, packages, customer cohorts>`
- **Customers to notify**: `<all customers? PII-touch customers only? none if
  internal-only?>`
- **Window**: `<scheduled maintenance window? immediate due to incident?>`

## What we use this vendor for

- (List the actual surfaces.) E.g., for an email provider: account
  verification, password reset, security notifications, marketing
  campaigns (separate consent).

## What's locked in (per decision doc)

- (Copy from the decision doc's "Vendor escape hatch" section. Update if
  reality has diverged.)

## Migration target

- **From**: `<vendor>`
- **To**: `<replacement vendor>` OR `<self-hosted>` OR `<remove the
  dependency>`
- **Rationale**: `<why this replacement>`

## Steps

### 1. Set up the replacement

- [ ] Create account / provision infra.
- [ ] Sign DPA (and BAA where the vendor will process health data; see
      `healthcare-phipa` profile if applicable). Update
      [`../docs/compliance/subprocessors.md`](../docs/compliance/subprocessors.md).
- [ ] Configure environment variables in production and `.env.example`
      for local dev.
- [ ] Smoke-test the replacement in a non-production environment.

### 2. Implement the swap

- [ ] Update the abstraction layer that hides the vendor (the goal is
      that consumer code does not need to change).
- [ ] Add tests against the new implementation.
- [ ] Verify the abstraction's interface is unchanged (consumers
      shouldn't need to update).
- [ ] Update prompts, templates, configuration as needed.

### 3. Cut over

- [ ] Deploy behind a feature flag.
- [ ] Cut a small percentage of traffic to the new implementation.
- [ ] Monitor error rates, latency, cost.
- [ ] Increase traffic share incrementally.
- [ ] 100% on the new implementation.
- [ ] Disable the feature-flag fallback.

### 4. Decommission the old vendor

- [ ] Verify no dependencies remain (grep for the old SDK / API
      surface).
- [ ] Remove the old implementation code.
- [ ] Remove old env vars from production and `.env.example`.
- [ ] Cancel the vendor account (after a 30-day buffer for any residual
      data export needs).
- [ ] Update [`../docs/compliance/subprocessors.md`](../docs/compliance/subprocessors.md):
      move the old vendor from active to historical.
- [ ] Update the original decision doc's status to "Superseded by …".

### 5. Author the supersede decision

- [ ] If the project tracks ADRs (`docs/adr/` or similar), author the
      supersede ADR: context (the trigger), decision (the swap),
      options considered, consequences (upside + downside of the new
      vendor), vendor-escape-hatch for the *new* vendor.
- [ ] Mark the original decision as "Superseded by <new-decision>".

### 6. Retrospective

- [ ] What forced the migration?
- [ ] How long did it take vs. the estimate?
- [ ] What went well, what didn't?
- [ ] Lessons → update CLAUDE.md's "Lessons learned" if there's a
      guidance change a future contributor needs.

## Verification

- [ ] All flows that depended on the old vendor now run on the new
      vendor.
- [ ] Tests pass.
- [ ] No errors in monitoring related to the swap surfaces.
- [ ] Cost monitoring confirms expected baseline.
- [ ] Customers notified if their experience changed (e.g., a different
      "from" address on emails).
- [ ] Audit-log entries for credential rotation are present.

## Rollback

If the new vendor turns out worse:

- Re-enable the feature flag → cut traffic back to the old vendor
  (assuming it has not been decommissioned).
- If decommissioned: the old vendor is gone — forward-fix on the new
  vendor or pick yet another one.

## Last updated

`<YYYY-MM-DD>` by `<person>`.

## Related

- The decision doc being superseded.
- The new decision doc (after step 5).
- [`access-revocation.md`](access-revocation.md) — handles the
  credential side of a vendor decommission.
- [`../docs/compliance/subprocessors.md`](../docs/compliance/subprocessors.md).

---

> **Template usage**: clone to `vendor-escape-<vendor-slug>.md`, fill
> placeholders, commit alongside the new decision doc.
