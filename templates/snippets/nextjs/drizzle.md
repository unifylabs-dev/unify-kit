<!--
templates/snippets/nextjs/drizzle.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern derived from `unify-rolfing-app/packages/unify-db` — a Drizzle ORM
+ Postgres setup published as an internal workspace package. Helper names
and file layout reflect that shape.
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Drizzle ORM in Next.js (monorepo package)

Drizzle's strength in a multi-app monorepo is that the schema + migrations +
connection factory live in one workspace package that every app imports. The
shape below mirrors `unify-rolfing-app/packages/unify-db`.

## Package layout

```
packages/db/
├── package.json          # name: "@<scope>/db"
├── drizzle.config.ts     # CLI config (schema path + migration out-dir)
├── src/
│   ├── index.ts          # exported `db` connection factory + re-exports
│   ├── schema.ts         # tables + relations
│   └── migrations/       # generated SQL — committed
└── tsconfig.json
```

Apps consume it as `import { db, users } from '@<scope>/db'`. The DB package
itself has no Next.js dependency — it works in API handlers, scripts, and
e2e fixture seeders alike.

## `drizzle.config.ts`

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,        // fail on schema drift
  verbose: true,
});
```

## `src/schema.ts`

```ts
import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'user']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Drizzle infers `User` (read row shape) and `NewUser` (insert shape) from the
table definition — no separate type maintenance.

## `src/index.ts`

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export * from './schema';
```

The connection is a singleton: the import-cache keeps `pool` alive across
Next.js hot reloads in dev. For serverless deployment (Vercel Functions),
swap to `drizzle-orm/postgres-js` + a pooled URL.

## Migration commands (in `packages/db/package.json#scripts`)

| Command | Use |
|---|---|
| `npm run db:generate` (alias for `drizzle-kit generate`) | Diff `schema.ts` against the last migration; write a new `migrations/0NNN_<slug>.sql`. |
| `npm run db:migrate` (alias for `drizzle-kit migrate`) | Apply pending migrations against `DATABASE_URL`. Use in dev + CI. |
| `npm run db:push` | (Dev only) Sync schema directly without writing a migration file. Useful for fast schema iteration before committing. |
| `npm run db:studio` | Open Drizzle Studio (web UI). |

Migrations are committed text files; review them in PRs like any other code.

## Querying from a Next.js Server Action

```ts
'use server';

import { db, users } from '@<scope>/db';
import { eq } from 'drizzle-orm';

export async function getUserByEmail(email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email));
  return row ?? null;
}
```

## Common pitfalls

- **Edge runtime incompatibility**: `pg` doesn't work on the Edge runtime.
  If you need Edge, use `drizzle-orm/postgres-js` + a serverless-friendly
  driver, or rewrite the Server Action to run on the Node runtime
  (`export const runtime = 'nodejs'`).
- **Connection storms in dev**: Next.js's dev server creates a new module
  graph per HMR, so without a singleton pool you accumulate connections.
  The `globalThis` cache trick from Prisma works here too.
- **Schema drift**: run `drizzle-kit check` in CI to catch a `schema.ts`
  change that wasn't accompanied by a migration.
