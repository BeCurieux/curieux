# Running Oviko locally

Oviko was called Mavya until M2.5. The folder, the local Supabase
project id and a few internal names still say `mavya`; nothing a person
sees does.

Needs Node 22 and Docker.

```sh
npm install
npm run db:start          # local Supabase in Docker
./scripts/local-env.sh    # writes .env.local from the running stack
npm run db:reset          # applies every migration from scratch, then seeds
npm run dev
```

Sign in at http://localhost:3000 with any seeded account (all share
`SEED_PASSWORD` from `.env.local`):

| Email                         | Lands in                             |
| ----------------------------- | ------------------------------------ |
| `sarah.morgan@aquahouse.test` | `/business` (owner, Aqua House)      |
| `mia.chen@aquahouse.test`     | `/instructor` (Aqua House)           |
| `dan.okafor@peakgym.test`     | `/business` (owner, Peak Gymnastics) |
| `lucy.hart@peakgym.test`      | `/instructor` (Peak Gymnastics)      |
| `sarah.burrows@family.test`   | `/family` (Ava, Leo)                 |
| `grace.chen@family.test`      | `/family` (Mei)                      |

## The M1 demo

Sign in as Sarah Burrows (parent), Sarah Morgan (owner) or Mia Chen
(instructor) to click through the demo in `docs/M1_DEMO.md`. What you do is
remembered in a cookie in your browser, so an instructor's skill update shows
up for the parent in the same browser. **Account → Reset the demo** starts
over. Other families and organisations see empty states, never the demo.

To give a hosted demo project these accounts, generate SQL from the same
fixtures and run it in that project's SQL editor. Use a fresh password, and
only on a demo project:

```sh
DEMO_PASSWORD='choose-one' npx tsx scripts/seed-sql.ts > demo-seed.sql
```

## Checks

| Command                                                     | What it runs                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| `npm test`                                                  | unit tests and row level security tests (needs the local stack) |
| `npm run test:unit`                                         | unit tests only, no database                                    |
| `npm run test:rls`                                          | tenancy tests through the real API, as each seeded user         |
| `npm run test:e2e`                                          | Playwright auth smoke tests at desktop and 390px                |
| `npm run lint`, `npm run typecheck`, `npm run format:check` | static checks                                                   |

After changing a migration, run `npm run db:reset` and `npm run db:types`
and commit the regenerated `src/lib/supabase/database.types.ts`. CI fails
if it's stale.

## Access model

Row level security is the boundary; the app's queries are not. See
`supabase/migrations/*_policies_and_grants.sql` and `*_m2_access.sql`.

- **Owners** read and write their organisation's locations, programs,
  levels, classes, families, children and enrolments, and read its audit
  trail. They remove and restore staff access through
  `remove_staff_member` / `restore_staff_member`
  (`*_security_hardening.sql`).
- **Instructors** read their organisation's timetable and only the children
  in classes they teach. They can't write.
- **Parents** read their own family and the classes their children are
  enrolled in. They can't write.
- Anonymous visitors read nothing.
- Tenancy, capacity and duplicate enrolments are enforced by the database
  itself (composite keys and triggers), and every change is audited.

## Deploying

The Vercel project needs Root Directory `mavya` (see `../DEPLOYS.md`) and
these environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and optionally
`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
`NEXT_PUBLIC_POSTHOG_KEY`. Never set `SEED_PASSWORD` in a deployed
environment.

### Cloud auth settings

Set these in the Supabase dashboard for the cloud project (the local stack
reads them from `supabase/config.toml`):

- Authentication → Sign In / Providers: **Allow new users to sign up** off.
  Accounts come from Oviko (the seed now, invites from M6).
- **Leaked password protection** on (Email provider settings, or
  Authentication → Attack Protection). Pro plan only, so it waits for the
  upgrade before the pilot (M6).
