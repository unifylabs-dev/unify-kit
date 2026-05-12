<!--
templates/snippets/nextjs/prisma-7.md
Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
Pattern shape derived from in-house Next.js + Prisma 7 projects; helper
names and config keys reflect the public Prisma 7 API. No expression
lifted from any single source.
Authored: 2026-05-12
License: CC0 1.0 (templates ship CC0 per specs/00-vision-and-license.md §"License")
-->

# Prisma 7 in Next.js (App Router)

Prisma 7 introduces `prisma.config.ts` as the configuration entry point and
deprecates the schema-only `prisma generate` discovery flow that earlier
versions relied on. For Next.js apps on Node 22.12+ with `"type": "module"`
in `package.json`, you also need the `@prisma/adapter-pg` adapter to keep
the Prisma client out of the legacy CJS-only code path.

## Files

```
prisma.config.ts        # Prisma 7 config — replaces the `prisma` key in package.json
prisma/schema.prisma    # schema (datasource + models)
prisma/seed.ts          # idempotent dev seed
prisma/seed-e2e.ts      # deterministic e2e seed (called by Playwright global-setup)
src/lib/db.ts           # the singleton PrismaClient + adapter
```

## `prisma.config.ts`

```ts
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
```

The `tsx` runner is used over `ts-node` because Prisma 7's CLI subprocess
inherits `NODE_OPTIONS`; `tsx` handles ESM without the `--loader` workaround.

## Adapter setup (`src/lib/db.ts`)

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Why the adapter: Prisma 7's default engine still ships as CJS, which collides
with `"type": "module"` projects when Next.js's App Router bundles Server
Components. The `@prisma/adapter-pg` adapter sidesteps the engine entirely and
talks to Postgres over `pg` directly — fully ESM-compatible. Same client API.

## Dual seed pattern

`prisma/seed.ts` is for local development: idempotent, upserts a few demo
users, leaves existing data alone.

```ts
import { prisma } from '../src/lib/db';

async function main() {
  await prisma.user.upsert({
    where: { email: 'dev@example.com' },
    update: {},
    create: { email: 'dev@example.com', name: 'Dev User' },
  });
}

main().finally(() => prisma.$disconnect());
```

`prisma/seed-e2e.ts` is for e2e tests: destructive, drops + recreates a known
fixture set so every Playwright run starts from the same state.

```ts
import { prisma } from '../src/lib/db';

async function main() {
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  await prisma.user.createMany({
    data: [
      { email: 'e2e-admin@example.com', name: 'E2E Admin', role: 'admin' },
      { email: 'e2e-user@example.com', name: 'E2E User', role: 'user' },
    ],
  });
}

main().finally(() => prisma.$disconnect());
```

Wire `seed-e2e.ts` into Playwright's `globalSetup` so each test run starts on
the deterministic fixture:

```ts
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  // ...
});
```

```ts
// e2e/global-setup.ts
import { execSync } from 'node:child_process';
export default async function globalSetup() {
  execSync('tsx prisma/seed-e2e.ts', { stdio: 'inherit' });
}
```

## Migration commands

| Command | Use |
|---|---|
| `npx prisma migrate dev --name <slug>` | Author a new migration locally. |
| `npx prisma migrate deploy` | Apply pending migrations in CI / prod. |
| `npx prisma migrate reset` | Wipe dev DB + re-seed via `prisma.config.ts#migrations.seed`. |
| `npx prisma generate` | Re-generate the client after a schema change. |

## Common pitfalls

- **`prisma.config.ts` not picked up**: Prisma 7's discovery is by filename
  in CWD. If you run `prisma` from a non-root dir, pass `--config`.
- **`ESM_LOADER_NOT_FOUND` when seeding**: install `tsx` (`npm i -D tsx`)
  and reference `tsx prisma/seed.ts` (not `node --loader ts-node/esm`).
- **Cold-start latency**: the adapter keeps a pg connection pool. In
  serverless/edge deployments, use a connection-pooler URL (e.g. PgBouncer
  or a Vercel-style pooled URL) for `DATABASE_URL`.
