<!--
docs/curated-plugins.md
Sourcing mode: net-new (per specs/00-vision-and-license.md §"Sourcing modes")
Authored: 2026-05-12 (v2.0.0)
License: CC BY-SA 4.0 (narrative docs per LICENSE)
-->

# Curated plugins

External plugins worth pairing with `unifylabs-workflow`. Documented here,
not auto-installed — consumers add the marketplaces they trust and install
the plugins they want.

This file replaces the v1 attempt to encode external plugin references in
`.claude-plugin/marketplace.json`. Claude Code's `marketplace.json` schema
is for plugins a marketplace *owns*; cross-marketplace curation belongs in
documentation.

Each entry below lists: short purpose, the install command, and the source
marketplace if non-default.

## How to install

Each plugin lives in a separate Claude Code marketplace. Add the source
marketplace once, then install. For Unifylabs's own plugin, the kit's own
marketplace is registered first:

```
/plugin marketplace add github.com/unifylabs-dev/unify-kit
/plugin install unifylabs-workflow
```

External marketplaces use the same pattern with their own URLs. The
install commands below assume the relevant marketplace is already added.

## Process / workflow

### `superpowers`

The canonical Anthropic-published superpowers plugin (TDD, brainstorming,
debugging, code review, plan execution, parallel agents, verification,
worktrees). Use alongside `unifylabs-workflow` — they're complementary,
not duplicate.

```
/plugin install superpowers
```

## Supabase

### `supabase:supabase`

Use when working on any Supabase product (Database, Auth, Edge Functions,
Realtime, Storage, Vectors, Cron, Queues), the client libraries
(`supabase-js`, `@supabase/ssr`), or the Supabase CLI / MCP server.
Covers SSR auth (Next.js, Remix, SvelteKit, etc.), session management,
RLS, migrations, and Postgres extensions.

```
/plugin install supabase:supabase
```

### `supabase:supabase-postgres-best-practices`

Postgres performance optimization + best practices from Supabase. Use when
writing, reviewing, or optimizing Postgres queries, schema designs, or
database configurations.

```
/plugin install supabase:supabase-postgres-best-practices
```

## Vercel suite

Pair with Next.js projects. The full Vercel-published plugin set:

### Deployment + CI/CD

| Plugin | Purpose |
|---|---|
| `vercel:bootstrap` | Project bootstrapping orchestrator for Vercel-linked resources (DB, auth, integrations) in the correct safe order. |
| `vercel:deploy` | Deploy current project to Vercel; `prod`/`production` argument for production deploys. |
| `vercel:deployments-cicd` | Deployment + CI/CD expert: promoting, rolling back, `--prebuilt` builds, CI workflow configs. |
| `vercel:vercel-cli` | CLI guidance: linking, env, logs, metrics, domains. |
| `vercel:env`, `vercel:env-vars` | Env variable expert: `.env` files, OIDC tokens, environment-specific configs. |
| `vercel:status` | Show current Vercel project status: recent deployments, linked project info, env overview. |
| `vercel:verification` | Full-story verification: browser → API → data → response, end-to-end. |

### Framework + runtime

| Plugin | Purpose |
|---|---|
| `vercel:nextjs` | Next.js App Router expert (routing, RSC, Server Actions, layouts, middleware, data fetching, rendering strategies). |
| `vercel:next-cache-components` | Next.js 16 Cache Components, PPR, `use cache`, `cacheLife`, `cacheTag`, migration from `unstable_cache`. |
| `vercel:next-upgrade` | Upgrade Next.js versions via official migration guides + codemods. |
| `vercel:next-forge` | next-forge Turborepo monorepo SaaS starter expert. |
| `vercel:routing-middleware` | Routing middleware: request interception before cache, rewrites, redirects, personalization. |
| `vercel:turbopack` | Turbopack bundler configuration + Webpack-vs-Turbopack differences. |
| `vercel:vercel-functions` | Serverless + Edge Functions, Fluid Compute, streaming, Cron Jobs. |
| `vercel:vercel-sandbox` | Ephemeral Firecracker microVMs for running untrusted (AI-generated) code. |
| `vercel:workflow` | Vercel Workflow DevKit: durable workflows, long-running tasks, pause/resume, crash-safe orchestration. |
| `vercel:runtime-cache` | Runtime Cache API: ephemeral key-value cache with tag-based invalidation. |
| `vercel:vercel-storage` | Blob + Edge Config + Marketplace storage (Neon Postgres, Upstash Redis). |
| `vercel:marketplace` | Marketplace expert: discovering + installing + building integrations. |

### UI + integrations

| Plugin | Purpose |
|---|---|
| `vercel:shadcn` | shadcn/ui expert: CLI, components, composition, custom registries, theming. |
| `vercel:react-best-practices` | React TSX best-practices reviewer (structure, hooks, accessibility, performance, TypeScript). |
| `vercel:auth` | Authentication via Clerk (native Vercel Marketplace), Descope, Auth0. Middleware + sign-in/sign-up patterns. |

### AI

| Plugin | Purpose |
|---|---|
| `vercel:ai-sdk` | Vercel AI SDK: chat, text generation, structured output, tool calling, agents, MCP, streaming, embeddings, image gen. |
| `vercel:ai-gateway` | AI Gateway: model routing, provider failover, cost tracking, unified API across providers. |
| `vercel:chat-sdk` | Multi-platform chat bots (Slack, Telegram, Teams, Discord, GitHub, Linear) with one codebase. |
| `vercel:vercel-agent` | AI-powered code review, incident investigation, SDK installation. |

### Knowledge + corrections

| Plugin | Purpose |
|---|---|
| `vercel:knowledge-update` | Corrects outdated LLM knowledge about the Vercel platform; introduces new products. Injected at session start. |

## Explicitly NOT curated

### `compound-engineering`

Tomer tried `compound-engineering` and bounced. Its phasing / reviewer
roster doesn't compose well with this kit's preferred workflow
(`unifylabs-workflow:work-issue` + `superpowers:brainstorming` +
`superpowers:test-driven-development` + this kit's `phasing` skill
together cover the same ground with less ceremony).

The kit's `templates/claude-runtime/.claude-settings.json.template` could
list `compound-engineering` under a `disabledPlugins` block to prevent
accidental enable — but since `--compliance=` and `--include=` install paths
don't add it, simple non-installation is the default and that's enough.

If you (the reader) want `compound-engineering`, install it separately;
it'll coexist with `unifylabs-workflow`. The opt-out is opinion, not
mechanism.

## Out of curation

This file curates plugins Tomer + the team has actively used and found
worth recommending. Plugins not listed here aren't necessarily bad —
they're just not load-bearing for the projects this kit targets.

To propose an addition, open an issue with:
- Plugin name + source marketplace
- One concrete project where it earned its keep
- One-line description (the kind that fits the tables above)
