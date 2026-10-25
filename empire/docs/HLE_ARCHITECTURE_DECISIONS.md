# Ads That Actually Sell: architecture decisions

Each decision names what was chosen, why, and how to reverse it. Founder decisions are dated.

## AD-1. Built inside Empire Studio (founder, 23 Oct 2026)

The course, member area and both tools live in the existing app under `/ads`. They reuse its sign-in, database, row level security, Gumroad purchase checks, brand, analytics, deletion and hosting. One account covers both products.

- Public: `/ads` (sales page), `/ads/free` (lead magnet landing), `/ads/sample` (sample lesson).
- Members: `/ads/learn` (dashboard), `/ads/learn/[module]` (lesson reader), `/ads/toolkit` (templates and downloads).
- Tools: `/ads/tools/calculator`, `/ads/tools/diagnose`.

**Reversible:** the `/ads` routes, `src/lib/ads` and `content/ads` are self-contained and could move to their own app.

## AD-2. Gumroad checkout (founder, 23 Oct 2026)

Each rung is a Gumroad product priced in AUD. Access is an entitlement `library:<slug>`, granted only from a verified sale (licence check or signed ping, idempotent on the sale id), and revoked by the daily refund recheck. That's the existing path in `src/lib/billing/`, so there's no new payment code and no access from a redirect alone.

- Course slug: `ads-that-actually-sell`. Other rungs get their own slugs once Vee confirms them.
- Gumroad product ids are added to `src/content/catalogue.ts` from the dashboard.

**Reversible:** a Shopify integration could later feed the same entitlements table.

## AD-3. Content as versioned Markdown in the repository

Each module is one Markdown file in `content/ads/modules/` with front matter: outcome, prerequisites, estimated time (marked as an estimate), sources (URL plus last-verified date or UNKNOWN), a mini assessment with answers, and an action checklist. Templates live in `content/ads/toolkit/` as Markdown and CSV. Vee can edit the text without touching code; a push redeploys.

**Why not a CMS:** no new service or cost, and every change is reviewable and reversible in git.

## AD-4. Calculator and diagnostic as pure, deterministic functions

`src/lib/ads/calculator.ts` and `src/lib/ads/diagnose.ts` are plain TypeScript with no AI, no network and no randomness. The diagnostic is a rule table: each rule has an id, a condition, a hypothesis, a next test with a success criterion, and a minimum-data requirement. When data is below that minimum, the rule moves to "What we can't conclude yet" instead of firing.

- Every division goes through one guard that returns "not defined" instead of Infinity or NaN.
- Tests use fixtures worked out independently (by hand and in a separate script), including all the edge cases the brief lists.
- The UI uses only the words "hypothesis", "suggests" and "test next", never "will" or "guaranteed". A test enforces this.

**Why not AI:** the brief asks for testable rules, not ungrounded proclamations.

## AD-5. Storage

Two new tables, each with row level security like the rest (owner-only):

- `ads_progress (user_id, lesson_slug, completed_at)`: lesson completion and resume point.
- `ads_scenarios (id, user_id, kind ['calculator','diagnostic'], name, inputs jsonb, created_at, updated_at)`: named saved scenarios.

Both get a migration, an RLS test and an entry in `docs/DATA_MODEL.md`. The local backend mirrors them for development.

## AD-6. Exports

- Calculator and diagnostic: CSV download and a print stylesheet ("Save as PDF" from the browser). There's no PDF library to maintain.
- Diagnostic reports contain only the numbers entered and the derived results: no account ids, emails or tokens.

## AD-7. Lead magnet and onboarding emails

The First Sale Checklist is a **free Gumroad product**, like the Fit Check: Gumroad delivers it and collects consent and the email. The 5-email sequence is written as copy for Gumroad's buyer emails, or for a mailing service if Vee adds one later. Whether Gumroad's current email features fit is UNKNOWN until checked in her dashboard. No email service is added without listing its cost first.

## AD-8. Currency

Course examples and prices are in AUD. Catalogue items gain a `currency` field (existing items stay `USD`). The calculator labels every money input with its currency and flags when a scenario mixes them.

## AD-9. GST

Her Little Empire is not registered for GST, so its own prices include no GST. The calculator still offers "prices include GST", "exclude GST" and "not registered", because customers may be registered. The tax treatment is FACT-checked against the ATO page, with its date, before release.

## AD-10. Platform facts

Meta and Shopify interfaces change often, and this session can't reach outside sites. Every interface instruction carries an official source link plus "last verified: UNKNOWN" until someone checks it. The release checklist blocks launch while any UNKNOWN remains in Module 2.

## AD-11. Claims and credentials

- The claims guard runs over the course content and sales page in a test, as well as over AI output.
- No credentials on the sales page or in lessons (founder, 23 Oct 2026).
- Worked examples are labelled "hypothetical", show losses as well as wins, and are never presented as results.

## AD-12. Delivery

Empire Studio's pull request (#68) merges first; this course ships as a new pull request in small, reviewable steps (founder, 23 Oct 2026).
