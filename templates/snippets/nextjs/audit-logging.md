<!--
templates/snippets/nextjs/audit-logging.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Derived from common audit-logging patterns in Next.js Server Actions; not lifted
from any specific source. The `logAudit()` helper name is generic.
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Audit logging (Next.js)

`logAudit()` is a fire-and-forget helper that records security-relevant events
to a durable append-only sink. The sink can be a database table, a structured
log stream, or a SaaS audit-log product — what matters is that entries are
durable, ordered, and observable during incident response.

The pattern has three discipline rules:

1. **Non-blocking.** A `logAudit(...)` call never delays the user-visible work.
   The helper enqueues the entry and returns immediately. Use `void
   logAudit(...)` if your linter complains about an unawaited promise.
2. **Errors don't propagate.** The audit log is observability, not a
   transactional store. If the sink is down, the user-visible action still
   completes; the missing entry is a separate incident, not a request failure.
3. **No secrets in entries.** Log the event and identifiers — actor, target,
   outcome — never the credential, password, token, or PHI involved. Audit
   logs leak in different ways than application logs; pretend they're public.

## Helper signature

```ts
type AuditEntry = {
  event: string;          // dotted name, e.g., 'session.login.success'
  actor: string;          // user id, service id, or 'anonymous'
  target?: string;        // resource id the event affects (optional)
  metadata?: Record<string, unknown>; // structured fields (no secrets)
};

export function logAudit(entry: AuditEntry): void {
  // Enqueue and return immediately. Errors are caught internally and
  // surfaced via a separate observability path (Sentry, log stream, etc.).
}
```

## Example call site

```ts
'use server';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function archiveThing(thingId: string) {
  const actor = await requireAuth();

  // Non-blocking: void the promise so the lint allows it.
  void logAudit({
    event: 'thing.archive.start',
    actor: actor.id,
    target: thingId,
  });

  await db.things.update({ id: thingId, archived: true });

  void logAudit({
    event: 'thing.archive.success',
    actor: actor.id,
    target: thingId,
  });

  return { ok: true };
}
```

## What to audit

A useful default — audit any mutation that an incident-responder would want
to replay: authentication events, authorization failures, role changes,
data-export operations, payment operations, and any state change with legal
or compliance implications. Read-only operations are usually noise; resist
auditing every `GET`.
