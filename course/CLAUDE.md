# CLAUDE.md — Her Little Empire course platform

Read `SPEC.md` first: it is the founder's build spec, and its build order is
the plan. `README.md` → Build progress says which step is next and what
earlier steps left for it.

## Rules

1. **One build step per session**, as `SPEC.md` asks, then stop for review.
   Update `README.md` → Build progress when a step is done.
2. **The non-negotiables in `SPEC.md` hold everywhere**: no GST charged or
   itemised; prices in cents, AUD by default and USD outside Australia; no
   earnings language in any UI copy; every gated page and route checks
   entitlement on the server; a refund revokes access immediately.
3. **Row level security is the boundary.** Never weaken a policy to make a
   feature work. Schema change = new migration + RLS tests in
   `tests/rls/rls.sql` + `npm run test:rls`.
4. `serviceClient()` bypasses RLS. Only the Stripe webhook, admin actions and
   scripts use it, and only after their own check.
5. Every user-visible feature needs a test (unit or Playwright). Run
   `npm run lint`, `typecheck`, `format:check`, `test:unit`, `test:rls` and
   `test:e2e` before committing.
6. Mobile-first, one accent colour, large type, no stock imagery.
7. Keys never go in the repository.

Next.js 16 differs from older versions: see `AGENTS.md` and
`node_modules/next/dist/docs/` before writing framework code.
