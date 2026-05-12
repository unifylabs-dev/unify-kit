<!--
templates/snippets/nextjs/middleware.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Derived from common Next.js 14+ middleware patterns for dual-session + idle
timeout; not lifted from any specific source. Cookie names and helper names
are generic.
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Middleware: dual-session + idle timeout (Next.js)

Some apps run with two parallel session cookies — for example, a long-lived
"remember me" cookie alongside a short-lived "active session" cookie. The
long-lived cookie identifies the user; the short-lived cookie controls
whether the user counts as currently active. This separation lets you enforce
an idle timeout on the active session without forcing the user through a full
login on every return visit.

Middleware in Next.js 14+ runs at the edge before any route handler. That's
the right layer to read both cookies, decide whether to extend the active
session, and redirect to login if it expired.

## Pattern shape

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, refreshActiveSession } from '@/lib/session';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function middleware(request: NextRequest) {
  const longLivedToken = request.cookies.get('session_id')?.value;
  const activeToken = request.cookies.get('session_active')?.value;

  // No long-lived token → anonymous. Let the route handler decide.
  if (!longLivedToken) return NextResponse.next();

  const session = await verifySessionToken(longLivedToken);
  if (!session) return redirectToLogin(request);

  // Idle timeout: if the active token is missing or older than IDLE_TIMEOUT_MS,
  // bounce to login.
  const active = activeToken ? await verifySessionToken(activeToken) : null;
  if (!active || Date.now() - active.lastSeenAt > IDLE_TIMEOUT_MS) {
    return redirectToLogin(request);
  }

  // Refresh the active cookie's lastSeenAt so the timer resets.
  const response = NextResponse.next();
  response.cookies.set('session_active', refreshActiveSession(active), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });

  // Surface the resolved actor to downstream handlers via a header.
  response.headers.set('x-actor-id', session.userId);
  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = new URL('/login', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
};
```

## Discipline rules

- **Both tokens are HMAC-signed.** Treat a missing or invalid signature as
  anonymous, not as authenticated. Never trust the cookie body without
  verifying.
- **The idle timeout is server-enforced.** A client-side "log me out after 30
  minutes" timer is a UX feature; the server-side check is the security gate.
- **Cookies are HTTP-only, `Secure`, `SameSite=Lax`** (or stricter). The
  middleware sets them once per request when refreshing.
- **The middleware does not attempt to authorize.** Authorization decisions
  belong in the route handler or Server Action, where the resource is in
  scope. Middleware identifies; handlers authorize.
