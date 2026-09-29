# M0 — Foundation

## Goal

Create the secure technical foundation for Ovyko without building product workflows.

## Deliverables

### Repository
- Next.js + TypeScript
- Tailwind
- customised shadcn/ui base
- Vitest
- Playwright
- ESLint
- Prettier
- environment validation

### Supabase
- local dev setup
- cloud-ready config
- initial migrations
- Auth
- RLS
- seed script

### Initial tables
Only what is needed to establish tenancy:

- users
- organisations
- staff_memberships
- families
- family_members
- children

Do not create the full future schema unless the migration is necessary now.

### Roles
- owner
- instructor
- parent

### RLS acceptance

Must prove:

1. Owner A cannot read Organisation B.
2. Parent A cannot read Family B.
3. Instructor A cannot access Organisation B.
4. A parent can read their own child.
5. An owner can read family/child records connected to their organisation only once the product relationship exists; if that relationship is not modelled yet, do not over-permit.

### App shells

Create protected route groups for:

- `/business`
- `/instructor`
- `/family`

Each may initially contain a simple branded shell.

### Observability
- Sentry configured
- PostHog placeholder/config wiring
- no analytics on sensitive child details

## Acceptance criteria

- `npm test` passes
- Playwright auth smoke tests pass
- RLS tests pass
- unauthorised tenant access returns no data / denied
- application deploys cleanly to Vercel preview
- no milestone-1 product workflows have been added

## Claude task

Before coding:
1. Read all docs.
2. Return exact proposed package dependencies.
3. Return proposed migration order.
4. Return RLS strategy.
5. Return test strategy.
6. Wait for approval before implementation.
