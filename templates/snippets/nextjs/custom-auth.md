<!--
templates/snippets/nextjs/custom-auth.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern shape derived from in-house regulated-data Next.js projects: bcrypt
password hashing + HMAC-signed cookie session + middleware-level actor
resolution + DAL `verifySession()` / `verifyRole()` helpers. No expression
lifted from any single source.
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Custom auth (bcrypt + HMAC cookie session)

For projects that can't use a third-party auth provider — typically because
the data is regulated (PHIPA, HIPAA, etc.) and the threat model requires
keeping the auth surface inside the application's blast radius — a small,
auditable custom auth pattern is the right shape.

This snippet describes the four pieces: password storage, session token
format, the DAL (data-access layer) helpers, and middleware actor resolution.

## 1. Password storage (bcrypt)

```ts
// src/lib/auth/password.ts
import bcrypt from 'bcryptjs';

const COST = 12;  // tune on hardware; aim for ~250ms hash time.

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

Store only the hash in the DB (`users.password_hash`). `verifyPassword` is
constant-time for two valid bcrypt hashes; pair it with a `timingSafeDelay`
helper (see `rate-limiting.md`) on the login route to neutralize
account-enumeration via response timing.

## 2. Session token format (HMAC over `<userId>.<expiresAt>`)

The session token is a self-contained string written to an httpOnly cookie.
No server-side session store needed — verification is purely cryptographic.

```ts
// src/lib/auth/session-token.ts
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET!;  // 32+ random bytes, base64-encoded

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createToken(userId: string, ttlMs: number): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${userId}.${expiresAt}`;
  const mac = sign(payload);
  return `${payload}.${mac}`;
}

export function verifyToken(token: string): { userId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, mac] = parts;
  const payload = `${userId}.${expiresAtStr}`;
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  if (Number(expiresAtStr) < Date.now()) return null;
  return { userId };
}
```

Token shape: `${userId}.${expiresAtMs}.${hmacBase64Url}`. Compact, opaque to
the client, tamper-evident. Rotate `SESSION_SECRET` to invalidate every
outstanding session.

## 3. Cookie write/clear

```ts
// src/lib/auth/cookie.ts
import { cookies } from 'next/headers';
import { createToken } from './session-token';

const COOKIE = 'session';
const TTL_MS = 1000 * 60 * 60 * 8;  // 8 hours

export async function setSessionCookie(userId: string) {
  const token = createToken(userId, TTL_MS);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
```

## 4. DAL helpers (`verifySession`, `verifyRole`)

The DAL layer is the single point where Server Components and Server Actions
read the actor. No code outside `src/lib/auth/dal.ts` reads the cookie.

```ts
// src/lib/auth/dal.ts
import { cookies } from 'next/headers';
import { cache } from 'react';
import { verifyToken } from './session-token';
import { db, users } from '@<scope>/db';
import { eq } from 'drizzle-orm';

export const verifySession = cache(async () => {
  const jar = await cookies();
  const token = jar.get('session')?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
  return user ?? null;
});

export async function requireSession() {
  const user = await verifySession();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export async function verifyRole(actor: { role: string }, required: string) {
  if (actor.role !== required) throw new Error('FORBIDDEN');
}
```

`cache()` (from React) deduplicates the DB lookup within a single request,
so Server Components calling `verifySession()` multiple times only pay one
query.

## 5. Middleware (actor stamp, not authorization)

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/session-token';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const decoded = token ? verifyToken(token) : null;
  const res = NextResponse.next();
  if (decoded) res.headers.set('x-actor-id', decoded.userId);
  return res;
}

export const config = {
  matcher: ['/((?!_next/|api/auth/|favicon|public/).*)'],
};
```

The middleware identifies; it does NOT authorize. Authorization is per-route
(Server Component / Server Action calling `requireSession` + `verifyRole`).
Doing authorization in middleware is a footgun — the Next.js docs explicitly
recommend against it because middleware runs on every request, including ones
your route doesn't actually serve.

## Common pitfalls

- **Putting authorization in middleware**: routes change, middleware
  doesn't follow. Auth lives next to the data access.
- **Storing the password hash in a place reachable from the client**:
  treat `users.password_hash` as a server-only column; don't include it in
  Server Component props or Server Action return values.
- **Forgetting `secure: true` in dev**: works fine over `localhost` (browsers
  exempt localhost from the secure-flag requirement); fails silently when
  you preview-deploy over HTTP. Make `secure` env-conditional if you have a
  non-HTTPS staging.
- **Rotating `SESSION_SECRET` without a migration plan**: invalidates every
  user simultaneously. Either accept the mass-logout or run a dual-secret
  verify-with-either window for the rotation period.
