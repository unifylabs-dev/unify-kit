<!--
templates/snippets/nextjs/rate-limiting.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Derived from common rate-limit + timing-attack-mitigation patterns; not lifted
from any specific source. Helper names are generic.
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Rate limiting + timing-safe delay (Next.js)

Public endpoints — login, signup, password reset, magic-link send — need two
defenses that look the same to a casual reader but solve different problems:

1. `checkRateLimit(...)` caps how many attempts a single key (IP, email, user)
   can make in a window. It defends against brute-force and abuse.
2. `timingSafeDelay(targetMs)` pads fast paths so they take as long as slow
   paths. It defends against timing-side-channel leaks ("did this email exist?
   the response came back in 5ms vs. 200ms — answer: no").

The pair belongs together because rate limiting alone leaks side-channel
information: a rejected request returns instantly, a fresh attempt takes
longer. `timingSafeDelay` removes the gap.

## Helper signatures

```ts
// Returns { allowed: boolean, retryAfterMs: number }. Backed by Redis,
// Upstash, or any keyed-counter store with TTL.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterMs: number }>;

// Pads to at least targetMs since the function was invoked. Resolves at the
// max of (actual elapsed, targetMs).
export async function timingSafeDelay(targetMs: number): Promise<void>;
```

## Example call site

```ts
'use server';
import { checkRateLimit } from '@/lib/rate-limit';
import { timingSafeDelay } from '@/lib/timing';
import { logAudit } from '@/lib/audit';

export async function requestLoginLink(email: string, ip: string) {
  const startedAt = Date.now();
  const TARGET_MS = 250; // every response takes ≥ 250ms

  const { allowed } = await checkRateLimit(`login:${ip}`, 5, 60_000);
  if (!allowed) {
    void logAudit({ event: 'login.ratelimited', actor: 'anonymous', metadata: { ip } });
    await timingSafeDelay(TARGET_MS - (Date.now() - startedAt));
    return { ok: true }; // Same response shape as the success path.
  }

  const user = await db.users.findByEmail(email);
  if (user) {
    await sendLoginEmail(user);
    void logAudit({ event: 'login.link.sent', actor: user.id });
  }

  // Pad whether or not the user existed. Same shape, same timing.
  await timingSafeDelay(TARGET_MS - (Date.now() - startedAt));
  return { ok: true };
}
```

The handler returns the same `{ ok: true }` regardless of whether the email
existed, was rate-limited, or actually got an email — same shape, same
timing. The information disclosure is closed.

## When to apply

Apply rate limiting to any endpoint reachable without authentication.
Apply `timingSafeDelay` to any endpoint where the response shape or latency
could distinguish "this user/email/identifier exists" from "doesn't exist."
Both helpers are cheap; the cost of omitting them only shows up when an
attacker is already probing.
