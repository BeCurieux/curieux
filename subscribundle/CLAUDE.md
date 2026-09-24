# Subscribundle — project brief for Claude Code

## What we're building
A public Shopify app: bundles, build-a-box subscriptions, subscribe and save, a customer portal, and later upsells and rewards — one app, flat monthly pricing, no revenue share.
Full product spec: `docs/SPEC.md` (paste the Claude Doc spec there). Build order: `TASKS.md`.

## Ground rules
1. **Verify Shopify APIs before using them.** Shopify's APIs change every quarter. Use the Shopify Dev MCP server (or shopify.dev docs) to confirm current API versions, GraphQL fields, Function targets and extension targets. Validate every GraphQL operation against the schema. Never rely on memory for Shopify specifics.
2. **Billing code is sacred.** Anything that triggers a charge (renewals, retries, prepaid plans, price changes) lives in `app/billing/` and:
   - must have unit tests and integration tests before merge,
   - must be idempotent (one idempotency key per renewal; a duplicate job can never charge twice),
   - must never be changed without showing Lo the diff and the test results first.
3. **Shopify is the source of truth** for products, orders, subscription contracts and payments. Our database stores configuration, schedules and history only.
4. **Small steps.** One task from `TASKS.md` at a time. Finish its acceptance criteria, run tests, then stop and summarise before starting the next.
5. **Ask before:** destructive database migrations, adding paid services, changing API scopes, or changing pricing logic.
6. **Never commit secrets.** Use `.env` locally and environment variables in deployment. Access tokens are encrypted at rest.
7. **Test mode only** until Lo says otherwise: app billing charges use test mode; subscription testing uses development stores.

## Stack
- **App framework:** use the Shopify CLI's current official app template (confirm which template Shopify currently recommends). It handles OAuth, session tokens, webhooks and app billing. Only use Next.js if there's a clear reason the official template can't do something — ask first.
- **Language:** TypeScript, strict mode.
- **Database:** Supabase Postgres. Migrations checked into the repo.
- **Background jobs:** a durable job queue for renewals, retries, emails and reconciliation (confirm choice with Lo: e.g. Postgres-backed queue or a hosted workflow service).
- **Shopify Functions:** Cart Transform (bundles) and Discount Functions (tiers, spend tiers, gifts).
- **Extensions:** theme app extensions (storefront widgets and build-a-box page), customer account UI extensions (portal), checkout UI extensions on thank-you / order status only.
- **Admin UI:** Polaris components, embedded via App Bridge.
- **Email:** transactional provider (confirm with Lo: Postmark or Resend).
- **Testing:** Vitest for unit/integration; Playwright for end-to-end flows on a development store.

## Code conventions
- Folders: `app/` (routes and UI), `app/billing/`, `app/bundles/`, `app/boxes/`, `app/subscriptions/`, `app/webhooks/`, `extensions/`, `functions/`, `db/migrations/`, `tests/`.
- Every webhook handler is idempotent and verifies the HMAC.
- All money values are integers in minor units (cents) plus currency code. Never floats.
- All dates stored in UTC; renewals scheduled in the shop's time zone.
- Log every subscriber-affecting change to `subscription_events` with actor (merchant, subscriber, system).
- Accessibility: storefront widgets and portal must work with keyboard and screen readers; text contrast WCAG AA.
- Storefront script budget: under 50 KB, loaded after page content, never blocks checkout.

## Definition of done (every task)
- Acceptance criteria in `TASKS.md` met.
- Tests pass (`npm test`), lint and type checks clean.
- Short summary written back to Lo: what changed, how it was tested, anything uncertain.
