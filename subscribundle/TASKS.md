# Subscribundle — build tasks

Work through these in order. One task at a time; stop and summarise after each.

## Before you start (Lo, not Claude Code)
- [ ] Create a Shopify Partner account and a new app in the Partner Dashboard.
- [ ] Create 2 development stores (one plain, one with sample products and a theme).
- [ ] Request access to the subscription APIs and protected customer data (level needed for subscriber names, emails, addresses). Check current requirements in the Partner Dashboard.
- [ ] Create a Supabase project; choose the job queue and email provider.
- [ ] Install the Shopify Dev MCP server for Claude Code so it can check current docs and validate GraphQL.
- [ ] Put the product spec in `docs/SPEC.md`.

---

## M0 — Project setup
- Scaffold with Shopify CLI's current recommended app template.
- Connect Supabase; set up migrations, `.env.example`, strict TypeScript, lint, Vitest, Playwright.
- CI: lint, type check and tests on every push.
**Done when:** the app installs on a dev store, opens embedded in admin, and CI is green.

## M1 — Foundations
- Database tables from the spec: `shops`, `bundles`, `bundle_items`, `boxes`, `selling_plans`, `subscriptions`, `billing_attempts`, `subscription_events`, `notifications`, `analytics_daily`.
- Install and uninstall handling; encrypted token storage.
- Mandatory privacy webhooks (customer data request, customer redact, shop redact).
- App plans (Free, Starter $29, Growth $59, Scale $129) via Shopify app billing, test mode; feature gating by plan.
**Done when:** install → choose plan → uninstall works end to end, privacy webhooks tested.

## M2 — Fixed and mix-and-match bundles
- Admin: create, edit, pause and delete bundles (Polaris).
- Cart Transform Function: bundle shows as one line; expands to components for fulfilment and inventory.
- Theme app block for product pages; standalone bundle page.
- Bundle shows sold out when a required component is out of stock.
**Done when:** a shopper can buy a fixed bundle and a mix-and-match bundle on a dev store, and the order shows correct components and prices.

## M3 — Volume tiers
- Discount Function for "buy 2 save 10%, buy 3 save 15%" on products or collections.
- Admin UI for tiers; storefront tier display.
**Done when:** tiers apply correctly in cart and checkout, including with other discounts per Shopify's combination rules.

## M4 — Subscribe and save
- Admin: create selling plans (frequencies, discount per frequency, prepaid 3/6).
- Product page widget: one-time vs subscribe (matches mockup PDP board).
- Webhooks mirror subscription contracts into `subscriptions`.
**Done when:** a shopper subscribes on a dev store, the contract appears in the app, and our mirror matches Shopify.

## M5 — Billing engine ⚠️ (billing rules in CLAUDE.md apply)
- Scheduler every 15 minutes; renewals due in each shop's time zone.
- Create billing attempts with one idempotency key per renewal.
- Pre-renewal checks: stock, out-of-stock rules, price recalculation.
- Failed payments: retries on days 1, 3, 7 (merchant-adjustable), then pause and notify.
- Daily reconciliation job: our records vs Shopify contracts; alert on mismatch.
- Tests: duplicate jobs, retries, time zones, out-of-stock, price change, contract cancelled mid-cycle.
**Done when:** 100 simulated renewals across time zones run with zero double charges, all test cases pass, and Lo has reviewed the diff.

## M6 — Build-a-box subscriptions
- Admin: box setup (matches mockup "New build-a-box" board): sizes, eligible collection, price rule, frequencies, cutoff, out-of-stock rule.
- Storefront build-a-box page (theme app extension) matching the "Build your box" board.
- Box contents stored on the contract; editable until the cutoff.
**Done when:** a shopper builds and subscribes to a 3-item box, edits it before the cutoff, and the next renewal ships the edited contents.

## M7 — Customer portal
- Customer account UI extension (matches the portal board): next delivery, skip, change date, change frequency, swap items, edit box, update address, pause, cancel.
- One optional retention offer before cancel; cancelling never hidden.
- Every action logged to `subscription_events`.
**Done when:** each action works on a dev store and shows correctly in admin.

## M8 — Emails
- Templates: confirmed, renewal reminder, box edit window, payment failed / update card, paused / resumed / cancelled, item swapped.
- Merchant branding and editable copy.
**Done when:** every event sends the right email in test, with delivery status stored.

## M9 — Dashboard and analytics
- Admin dashboard matching the mockup: setup guide, MRR, active subscribers, bundle revenue, recovered payments, 12-week chart, AOV with vs without app, recent activity.
- Daily metrics job fills `analytics_daily`.
**Done when:** numbers on a seeded dev store match hand-calculated values.

## M10 — Hardening and launch prep
- Playwright end-to-end tests for the main flows.
- Monitoring and alerts (job backlog, renewal success rate, webhook failures).
- Help docs, privacy policy, terms (Lo), App Store listing and screenshots.
- Private beta with 5–10 merchants, then App Store submission.
**Done when:** beta merchants run live for 4 weeks without billing errors.

---

## Later releases
- **v1.1** Upsells: product page, cart, "add to next delivery".
- **v1.2** Rewards, gift with purchase, spend tiers with progress bar.
- **v1.3** Migration from Recharge, Appstle and Shopify Subscriptions; advanced analytics.
