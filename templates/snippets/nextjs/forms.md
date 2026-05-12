<!--
templates/snippets/nextjs/forms.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern shape derived from in-house Next.js form flows: useActionState +
Server Action + Zod validation + a tagged-union result shape. No expression
lifted from any single source.
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Forms (useActionState + Server Action + Zod)

The shape below is React 19's `useActionState` paired with a Server Action
and a Zod schema. The Action returns a discriminated union so the client
can render field-level and form-level errors without ad-hoc shape detection.

## Result shape (the contract)

```ts
// src/lib/forms/result.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

`ok: true` means the action committed. `ok: false` always carries a
human-readable `error`; `fieldErrors` is present when the failure is
input-validation (Zod produces a map of field → array of messages).

## Server Action

```ts
// src/app/(forms)/intake/actions.ts
'use server';

import { z } from 'zod';
import { requireSession } from '@/lib/auth/dal';
import { logAudit } from '@/lib/audit';
import { db, intakes } from '@<scope>/db';
import type { ActionResult } from '@/lib/forms/result';

const Schema = z.object({
  fullName: z.string().min(1, 'Required').max(120),
  email: z.string().email('Invalid email'),
  notes: z.string().max(2000).optional(),
});

type Output = { id: string };

export async function submitIntake(
  _prev: ActionResult<Output> | null,
  formData: FormData,
): Promise<ActionResult<Output>> {
  const actor = await requireSession();

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  logAudit({ event: 'intake.submit.start', actor: actor.id });

  const [row] = await db.insert(intakes).values(parsed.data).returning({ id: intakes.id });

  logAudit({ event: 'intake.submit.success', actor: actor.id, target: row.id });

  return { ok: true, data: { id: row.id } };
}
```

The Action follows the 6-step Server Action anatomy: auth-guard
(`requireSession`), validate (`Schema.safeParse`), audit-start, business
(`db.insert`), audit-success, return. See
`templates/snippets/nextjs/server-action-anatomy.md`.

## Client component

```tsx
// src/app/(forms)/intake/intake-form.tsx
'use client';

import { useActionState } from 'react';
import { submitIntake } from './actions';

export function IntakeForm() {
  const [state, action, pending] = useActionState(submitIntake, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        Full name
        <input name="fullName" required className="block w-full" />
        {state?.ok === false && state.fieldErrors?.fullName && (
          <p className="text-red-600 text-sm">{state.fieldErrors.fullName[0]}</p>
        )}
      </label>

      <label className="block">
        Email
        <input name="email" type="email" required className="block w-full" />
        {state?.ok === false && state.fieldErrors?.email && (
          <p className="text-red-600 text-sm">{state.fieldErrors.email[0]}</p>
        )}
      </label>

      <label className="block">
        Notes (optional)
        <textarea name="notes" className="block w-full" />
      </label>

      {state?.ok === false && !state.fieldErrors && (
        <p className="text-red-600">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn">
        {pending ? 'Submitting…' : 'Submit'}
      </button>

      {state?.ok === true && (
        <p className="text-green-600">Submitted. Reference: {state.data.id}</p>
      )}
    </form>
  );
}
```

## Why this shape

- **`useActionState`** wires the action result back into the component
  without `useState` ceremony. The first argument (`_prev`) lets the
  server see the previous result if you want optimistic chaining.
- **Discriminated union** lets TypeScript narrow `state` cleanly:
  `if (state?.ok) state.data` is type-safe; `if (!state.ok) state.error`
  is too. No `state?.errors ?? state?.error ?? null` ladders.
- **Zod via `safeParse`**: never throw on validation failure; convert
  Zod's tree-shaped error into the flat `fieldErrors` map via
  `error.flatten().fieldErrors`. The client renders each field's first
  message.
- **Field-level vs form-level**: if `fieldErrors` is set, render inline
  per field; otherwise render `error` as a top-level alert.

## Common pitfalls

- **Using `useFormState` (deprecated alias)**: `useActionState` replaced
  it in React 19. The old name still works but the docs say to migrate.
- **Forgetting `'use server'`**: a missing directive makes the action a
  regular import, which then ships to the client. The build will warn.
- **Returning `undefined`**: `useActionState` infers `null` if you don't
  return — always return a typed result, even on early returns.
- **Confusing `state.fieldErrors[field]` with a string**: Zod's flattened
  output is `Record<string, string[]>`. Render `errors[0]` for the first
  message; loop if you want all.
