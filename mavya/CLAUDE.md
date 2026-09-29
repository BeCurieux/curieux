# CLAUDE.md — MAVYA

You are working on **Mavya v0.1**, a multi-tenant SaaS platform for recurring children's activities.

## Source of truth

Before making product decisions, read:

- `docs/PRODUCT.md`
- `docs/DATA_MODEL.md`
- `docs/RULES_ENGINE.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/BUILD_PLAN.md`
- `docs/SECURITY.md`
- the current milestone file in `/docs`

If the code conflicts with the docs, stop and surface the conflict before changing the architecture.

## Non-negotiable rules

1. **Do not add features outside the current milestone.**
2. **Do not change the data model without updating `docs/DATA_MODEL.md`.**
3. **Business rules belong server-side.**
4. **Never duplicate eligibility logic in the UI.**
5. **Never weaken Supabase RLS to make a feature work.**
6. **Every user-visible feature must have an acceptance test.**
7. **Every important administrative action must be auditable.**
8. **Keep the architecture boring. No microservices in v0.1.**
9. **Use one Postgres database.**
10. **Prefer explicit typed domain services over magic abstractions.**
11. **Do not introduce AI features in v0.1 unless specifically approved.**
12. **Do not add native mobile apps in v0.1.**
13. **Do not build marketplace/discovery functionality in v0.1.**
14. **Do not add Xero, payroll, HR, franchise or league-management features.**
15. **Do not expose children's data across organisations.**

## Recommended stack

- Next.js
- TypeScript
- React
- Tailwind
- shadcn/ui primitives, heavily customised
- Supabase Postgres
- Supabase Auth
- Supabase Row Level Security
- Supabase Storage
- Vercel
- Resend
- PostHog
- Sentry
- Vitest
- Playwright

Payments via Stripe Connect come later and are **not part of M0 or M1**.

## Product roles

- Business Owner
- Instructor
- Parent / Guardian
- Internal Platform Admin

Permissions must be explicit.

A parent must never see another family.
An instructor must never see another organisation.
A business owner must never see another provider's customers.

## UX rule

Mavya should feel like:

**Apple Wallet × Duolingo × Linear**

Do not build a generic SaaS dashboard.

Avoid:
- dense sidebars
- tiny grey type
- corporate blue
- unnecessary settings
- tables on mobile
- jargon like "workflow optimisation"

Prefer:
- large tap targets
- clear action hierarchy
- strong empty states
- calm business UI
- warm parent UI
- plain-language labels

## Development workflow

For every milestone:

1. Restate the milestone goal.
2. List files to create/change.
3. Implement smallest coherent slice.
4. Run tests.
5. Verify acceptance criteria.
6. Report:
   - what changed
   - tests run
   - anything unresolved
   - anything intentionally deferred

Do not silently broaden scope.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
