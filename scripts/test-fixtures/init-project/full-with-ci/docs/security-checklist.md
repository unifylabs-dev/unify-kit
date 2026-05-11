<!--
templates/security-checklist.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern reference: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/examples/skills/security-checklist.md
  (CC BY-SA 4.0 — patterns documented; expression authored independently per
  docs/decisions/0001-hook-bundle-licensing.md)
Reclassification note: spec 02 §5 originally specified verbatim-with-light-edit;
  the share-alike incompatibility documented in ADR 0001 applies to this file
  too. Original prose authored under the ADR's customization template.
  Spec 02 §5 paperwork follow-up flagged in this phase's handoff.
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# TestProject — Security Checklist

A pre-PR cross-reference for security-relevant work. The spine is the OWASP
Top-10 (2021 edition); each category gets a one-paragraph framing and a small
set of actionable checks. The "Stack example: Next.js" section at the end shows
how to apply the spine in a Next.js codebase — adapt or skip per stack.

If a check doesn't apply to the change in front of you, write "n/a" and move on.
The checklist is a forcing function for thought, not a bureaucratic gate.

## A01 — Broken Access Control

Authorization failures are the most-exploited class of vulnerability and the
hardest to spot in code review because the bug is usually an absent check, not a
present one. Every endpoint, server action, and resource-mutating function must
answer the question "who is allowed to call this?" before it answers "what does
this do?"

- [ ] Every server-side mutation guards on the actor's identity and role.
- [ ] Object-level checks compare the actor against the *resource owner*, not
      the actor's role alone (a user with `editor` role cannot edit *another
      user's* document just because they have the role).
- [ ] Tests cover the unauthorized path explicitly (a 403 test is not optional).

## A02 — Cryptographic Failures

Storing or transmitting sensitive data without the right primitive is a quiet
class — the code looks fine, the failure mode appears in audit, screenshot, or
breach. Default to platform primitives; resist the urge to hand-roll.

- [ ] Secrets at rest use a managed secret store, not `.env` files committed to
      a branch (the `pre-commit-secrets.sh` hook is your safety net, not your
      policy).
- [ ] Hashes use a modern algorithm with a per-record salt (`bcrypt`, `argon2`,
      `scrypt`); never SHA-256 alone.
- [ ] All transit is TLS, including service-to-service calls inside the VPC.

## A03 — Injection

Injection is older than the OWASP list itself and still in the top three because
new query languages keep arriving. The defense is universal: don't concatenate
untrusted input into a query, command, or expression.

- [ ] Database queries use parameterized statements or a query builder; no raw
      string concatenation with user input.
- [ ] Shell calls go through a function that takes an argument array, not a
      single string with interpolation.
- [ ] Server-rendered output escapes by default (the framework's default is
      almost always right; opt-out is the suspicious move, not opt-in).

## A04 — Insecure Design

Some bugs aren't implementation bugs — they're design bugs the code faithfully
implements. A password-reset flow that emails a long-lived token to an
unverified address is correctly implemented and structurally broken. Catch
these in the design conversation, not in code review.

- [ ] New flows that handle credentials, payments, or state changes get a
      threat-model paragraph in the PR description (or in `docs/architecture.md`).
- [ ] Rate limits and abuse paths are designed *before* the endpoint exists.
- [ ] Sensitive flows have an audit-log trail by design.

## A05 — Security Misconfiguration

The leading source of misconfiguration in modern stacks is "the framework
default was fine, then we changed it for one reason and forgot why." Default-on
beats opt-in for security-relevant settings.

- [ ] Production runs with `NODE_ENV=production` (or stack equivalent) — not by
      coincidence, by deployment script.
- [ ] Error responses do not leak stack traces or internal paths to unauthenticated
      callers.
- [ ] CORS, CSP, and security headers are explicitly configured (not relying on
      a default that may shift).

## A06 — Vulnerable & Outdated Components

The supply chain is part of the codebase. A dependency that hasn't been
updated in 18 months is a security signal, not a stability signal.

- [ ] `npm audit` (or stack equivalent) runs in CI and high/critical findings
      block the build.
- [ ] Major version bumps go through review (transitive bumps from a minor
      version of a direct dep are normal; major bumps deserve attention).
- [ ] Removed dependencies are removed from `package.json` (or equivalent), not
      just removed from imports.

## A07 — Identification & Authentication Failures

Session management is where the small mistakes compound. Long-lived sessions,
missing idle timeouts, and "remember me" tokens that never expire are quiet
risks until they aren't.

- [ ] Session cookies are HTTP-only, `Secure`, and `SameSite=Lax` or stricter.
- [ ] Idle timeout is enforced on the server, not just the client.
- [ ] Login responses use a single error message ("invalid credentials") for
      both bad-username and bad-password cases.

## A08 — Software & Data Integrity Failures

Integrity failures show up when an unsigned artifact is trusted as signed —
a build pipeline that pulls from an untrusted source, a CI runner with
unrestricted network, an MCP server that wasn't vetted.

- [ ] CI runs only signed images / pinned action versions; `@main` is forbidden
      in workflow YAML.
- [ ] MCP servers go through the policy in `templates/mcp-policy.md.template`
      before they touch a contributor's `~/.claude`.
- [ ] Auto-update behavior is opt-in for tools that touch the codebase.

## A09 — Security Logging & Monitoring Failures

If you don't log it, you can't tell whether it happened. Audit logging is
observability for security events; the cost of capturing it is small, the cost
of not having it during an incident is large.

- [ ] Authentication events (success, failure, lockout) are logged with actor +
      time + outcome.
- [ ] Authorization failures are logged (a stream of 403s on the same resource
      from different actors is a signal).
- [ ] Logs do not contain the secret values they're auditing — log the
      *attempt*, not the *credential*.

## A10 — Server-Side Request Forgery (SSRF)

An endpoint that accepts a URL from a user and fetches it server-side is a
gateway to internal infrastructure unless explicitly constrained. The defense
is allowlisting destinations, not denylisting.

- [ ] User-supplied URLs are checked against a destination allowlist before fetch.
- [ ] Internal cloud-metadata endpoints (e.g., `169.254.169.254`) are blocked at
      the network layer, not just at the application layer.
- [ ] Redirects from user-supplied URLs are followed at most once and re-checked
      against the allowlist.

---

## Stack example: Next.js

If you're on a Next.js stack, the four patterns below are how the OWASP spine
shows up in practice. Each links to a snippet in `templates/snippets/` that
sketches the canonical shape; adapt to your codebase's helpers.

- **HMAC session cookies**. Sign session cookies with an HMAC of the session
  payload + a server-side secret. Verify the signature on every read; treat a
  missing or invalid signature as anonymous, not as authenticated. (See
  [middleware-nextjs.md](snippets/middleware-nextjs.md) for the dual-session
  middleware pattern that integrates with this.)
- **Audit logging via `logAudit()`**. Every mutation worth replaying in an
  incident gets a `logAudit({ event, actor, target, metadata })` call. The
  helper is fire-and-forget and non-blocking; errors don't propagate. (See
  [audit-logging-nextjs.md](snippets/audit-logging-nextjs.md).)
- **Public-endpoint rate limiting + `timingSafeDelay`**. Public endpoints
  (especially auth) wrap their handler in `checkRateLimit(...)` and pad slow
  paths with `timingSafeDelay(targetMs)` so timing alone doesn't leak whether
  a username exists. (See [rate-limiting-nextjs.md](snippets/rate-limiting-nextjs.md).)
- **Server Action auth-guard pattern**. Every Server Action begins with
  `requireAuth()` (or equivalent). The 6-step anatomy — auth → validate →
  audit-start → business → audit-success → return — is a discipline that makes
  the *absence* of any step show up in code review. (See
  [server-action-anatomy-nextjs.md](snippets/server-action-anatomy-nextjs.md).)

If you're on a different stack, write the equivalent four-pattern block for
your stack and link it here. The OWASP spine above is universal; the patterns
that implement it are stack-specific.
