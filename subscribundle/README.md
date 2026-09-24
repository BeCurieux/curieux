# Subscribundle

A public Shopify app: bundles, build-a-box subscriptions, subscribe and save and
a customer portal, on flat monthly pricing. The brief is in [`CLAUDE.md`](CLAUDE.md),
the build order in [`TASKS.md`](TASKS.md), and the product spec belongs in
`docs/SPEC.md` (not added yet).

Scaffolded from Shopify's [React Router app template](https://github.com/Shopify/shopify-app-template-react-router),
which shopify.dev lists as the recommended template for new apps.

## Stack so far (M0)

| | |
|---|---|
| App | React Router 7 + `@shopify/shopify-app-react-router`, embedded with App Bridge |
| Admin API | `2026-07` (latest stable) — `app/shopify.server.ts`, `shopify.app.toml`, `.graphqlrc.ts` |
| Database | Supabase Postgres via Prisma. Schema `db/schema.prisma`, migrations `db/migrations/` |
| Tests | Vitest (`tests/unit`, `tests/integration`), Playwright (`tests/e2e`) |
| CI | `.github/workflows/subscribundle.yml` at the repository root |

## First run

Needs Node 22, a Shopify Partner account, a development store and a Supabase project.

```sh
cd subscribundle
npm ci
cp .env.example .env          # fill in DATABASE_URL and DIRECT_URL from Supabase → Connect
npx prisma migrate deploy     # creates the Session table
npm run config:link           # links this code to the app in the Partner Dashboard
npm run dev                   # tunnels, installs on your dev store, opens the admin
```

`npm run dev` injects `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`
and `SCOPES`; the server refuses to start if any required variable is missing
and names it.

## Scripts

| Script | |
|---|---|
| `npm run dev` | Shopify CLI dev server |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run typecheck` | React Router typegen + `tsc` (strict) |
| `npm test` | Vitest |
| `npm run test:e2e` | Builds, boots the server with placeholder credentials, runs Playwright |
| `npm run db:migrate` | `prisma migrate dev` — create a migration from schema changes |
| `npm run db:deploy` | `prisma migrate deploy` — apply migrations |

## Notes

- **Row level security.** Supabase serves the `public` schema over its REST API.
  Every table the app creates enables RLS with no policies, so the anon key can
  read nothing; the app connects as the database owner, which bypasses RLS. Keep
  doing this in every migration.
- **Pooler.** `DATABASE_URL` is the transaction pooler (6543, `pgbouncer=true`);
  `DIRECT_URL` is the session pooler (5432) and is only used by migrations.
- **Access tokens** are stored by the template's Prisma session storage in plain
  text. Encryption at rest is part of M1.
- **Scopes** are the template default, `write_products`. The real set is decided
  in M1 (subscription APIs, protected customer data) — changing scopes needs Lo's
  sign-off.
