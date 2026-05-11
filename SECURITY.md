# Security policy

## Supported versions

Security fixes land on the latest released minor version. Older minor versions
are not patched; consumers should upgrade per the upgrade-flow contract in
[`specs/08-living-docs-and-decision-log.md`](specs/08-living-docs-and-decision-log.md)
§4.

| Version | Supported |
|---|---|
| Latest released minor (e.g. `1.0.x`) | Yes |
| Older releases | No |

## Reporting a vulnerability

**Do not open a public issue.** Report privately via GitHub's vulnerability
reporting:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, reproduction steps, and affected file paths.

This opens a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/about-coordinated-disclosure-of-security-vulnerabilities)
visible only to the maintainer and you. We collaborate on the fix in the same
advisory.

If GitHub's reporting flow is unavailable to you, fall back to opening a public
issue with the *minimum* detail needed to flag that a private channel is needed
(e.g. "Need a private channel to report a hook-related issue"). Do **not**
include exploit details in the public issue.

## Response SLA

- **Initial acknowledgement:** within **5 business days** of receipt.
- **Triage outcome:** within 10 business days — accepted, needs-info, or
  declined with reasoning.
- **Fix timeline:** depends on severity. Critical issues (RCE, secret
  exposure, hook bypass) target a patch release within 14 days of triage.
  Lower-severity issues land on the next regular release.

This is a single-maintainer project; the SLA reflects realistic capacity, not
24/7 on-call.

## Scope

In scope:

- Shell hooks under [`hooks/`](hooks/) (output scanning, prompt-injection
  surfaces, secret leakage)
- The bootstrap installer in [`scripts/`](scripts/) (path traversal, backup
  handling, manifest tampering)
- GitHub Actions workflows under [`github-actions/`](github-actions/) and
  [`.github/workflows/`](.github/workflows/) (token scope, command injection)
- Templates that embed executable patterns (CI snippets, settings.json
  fragments)

Out of scope:

- Consumer projects built *with* the kit — report those to the relevant
  consumer's own security channel.
- Bugs in upstream plugins (`superpowers`, `compound-engineering`) — report to
  those projects.
- Theoretical issues without a working repro against a current release.

## Disclosure

Once a fix is released, the advisory is published with credit to the reporter
(unless the reporter requests anonymity) and the CHANGELOG `### Security`
section is updated for that release.
