# Lean launch budget

**Nothing has been bought or upgraded.** Labels:

- **FACT**: checked, with date and source.
- **ESTIMATE**: from general knowledge, October 2026. This session can't open provider pricing pages: the network blocks them.
- **UNVERIFIED**.

Check every price on the provider's own page before paying.

## 1. Required for the first verified sale

| Item                        | Why it's required                                                                                                                                                                    | Cost                                                                                                                    | Approval |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| **Vercel Pro**              | Empire Studio unlocks paid access, which makes it commercial. Vercel's Hobby plan is for non-commercial use (as recorded in `docs/SERVICES.md`; **re-check Vercel's current terms**) | ~US$20 per member per month (ESTIMATE)                                                                                  | 🔒       |
| Gumroad fees                | Checkout for the Income Fit Test                                                                                                                                                     | 10% + US$0.50 per direct sale (FACT, Oct 2026, Little Offer Kit); 30% on Discover sales (FACT); card processing UNKNOWN | —        |
| Test purchase               | The verified end-to-end sale (CUSTOMER_JOURNEY_TEST_PLAN T6–T11)                                                                                                                     | US$19, refunded. Gumroad's US$2.40 fee may not come back (UNVERIFIED)                                                   | 🔒       |
| Subdomain DNS record        | `studio.herlittleempire.com`                                                                                                                                                         | US$0 (a record on the existing domain)                                                                                  | 🔒       |
| Sign-in email (custom SMTP) | Supabase's built-in mailer is heavily rate-limited (`docs/SERVICES.md`)                                                                                                              | US$0 on a free tier, e.g. Resend (~3,000 emails/month, ESTIMATE)                                                        | 🔒       |
| Anthropic API               | **Not needed for Phase 1.** It's only for the Launch Pack, which isn't on sale                                                                                                       | US$0                                                                                                                    | —        |
| **Month-one minimum**       |                                                                                                                                                                                      | **~US$20 (ESTIMATE) + up to US$2.40 test-fee loss**                                                                     |          |

## 2. Strongly recommended (not strictly required for the first sale)

| Item                                  | Why                                                                                                                                                         | Cost                                     | When                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| **Supabase Pro**                      | Buyers' unlocked reports and saved progress live in Supabase. Free projects pause after inactivity and have no daily backups (`docs/SERVICES.md`; re-check) | ~US$25/month (ESTIMATE)                  | Before relying on it for paying customers; ideally before the first real sale |
| Professional privacy and terms review | `docs/launch/PLATFORM_INTEGRATION_PLAN.md` §5                                                                                                               | UNKNOWN (quote needed)                   | Before paid traffic                                                           |
| **With both**                         |                                                                                                                                                             | **~US$45/month (ESTIMATE)** + review fee |                                                                               |

## 3. Optional, later

| Item                    | Cost (ESTIMATE)                                              | Trigger                                                    |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Mailing service         | US$0 to ~1,000 subscribers                                   | Only if Gumroad's emails can't run the five-email sequence |
| Error reporting         | US$0 on a free tier                                          | Once there's real traffic                                  |
| Anthropic (Launch Pack) | Cents per generation, capped by `EMPIRE_AI_DAILY_BUDGET_USD` | When the Launch Pack goes on sale                          |
| Shopify                 | ~US$39/month Basic                                           | **Not recommended** (founder decision: Gumroad for launch) |

## 4. What a sale covers (hypothetical)

| Product         | Price | Gumroad fee (10% + US$0.50) | Kept     |
| --------------- | ----- | --------------------------- | -------- |
| Income Fit Test | US$19 | US$2.40                     | US$16.60 |

That's before card processing (UNKNOWN), refunds and Discover's 30%.

- **2 sales a month** cover Vercel Pro.
- **3** cover Vercel Pro plus Supabase Pro.

These are arithmetic on fixed costs, not a sales forecast.

## 5. Spending order

1. Vercel Pro, just before Gumroad pings are switched on in production.
2. Supabase Pro, before the first real customer relies on it.
3. The test purchase.
4. The professional review, before any paid promotion.

Each needs a yes from the founder.
