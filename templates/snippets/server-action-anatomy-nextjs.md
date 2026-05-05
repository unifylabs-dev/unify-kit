<!--
templates/snippets/server-action-anatomy-nextjs.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Derived from common Next.js Server Action patterns; not lifted from any specific
source. Helper names are generic — adapt to your codebase's actual helpers.
Authored: 2026-05-04
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Server Action anatomy (Next.js)

A Server Action is a server-only function the client invokes via React's
`use server` directive. The action runs in the server runtime, has access to
your database and secrets, and returns a value the client renders. Because the
action is reachable from the browser, every action must be treated as a public
endpoint with a private body.

The 6-step anatomy below makes the mandatory pre-conditions show up as separate
calls. The discipline isn't about the helpers — it's about the *absence* of any
of these steps being immediately visible in code review.

## The 6 steps

1. **`requireAuth()` — auth-guard.** Resolve the actor from the session cookie
   and assert they exist + are active. Throw if not. This must be the first
   call; never accept the first argument before knowing who's calling.
2. **`validateInput()` — input validation.** Parse the input against a schema.
   Reject anything that isn't shape-correct. Don't trust the client's typing,
   even if the call site looks typed.
3. **`logAudit({ event: '...', actor, target })` — audit-start.** Record the
   intent before the side effect. If the side effect fails halfway, the audit
   log still has a "we tried to do X" entry.
4. **`doBusinessLogic()` — business logic.** The actual work. Keep this small;
   factor anything reusable into pure functions you can unit-test without the
   server runtime.
5. **`logAudit({ event: '...', actor, target, outcome: 'success' })` — audit-success.**
   Record the completion. The outcome field lets a future reader differentiate
   "started" from "finished" entries.
6. **Return the result.** The shape returned to the client. Keep it minimal —
   don't return internal IDs or fields the caller doesn't need.

## Skeleton

```ts
'use server';

import { requireAuth } from '@/lib/auth';
import { validateInput } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { schema } from './schema';

export async function updateThing(rawInput: unknown) {
  // 1. Auth-guard — must be first.
  const actor = await requireAuth();

  // 2. Input validation.
  const input = validateInput(schema, rawInput);

  // 3. Audit-start.
  logAudit({ event: 'thing.update.start', actor, target: input.id });

  // 4. Business logic.
  const result = await doBusinessLogic(input, actor);

  // 5. Audit-success.
  logAudit({ event: 'thing.update.success', actor, target: input.id });

  // 6. Return.
  return { id: result.id, updatedAt: result.updatedAt };
}
```

If your codebase doesn't have `requireAuth()`, `validateInput()`, or `logAudit()`
helpers, this snippet describes what they look like. Build them once; reuse
across every Server Action.
