# Launch costs

Labels: **FACT** (checked, with date), **EST** (estimate from general knowledge, October 2026, because this session couldn't open pricing pages), **UNKNOWN**. **Check each provider's pricing page before paying. Nothing here has been purchased.**

## 1. Required to take the first payment

| Item                    | Why it's required                                                                                                                                    | Cost                                                                                                  | When                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Vercel Pro**          | Vercel's Hobby plan is for non-commercial use. Studio unlocks paid access, so the site is commercial once purchases are matched (`docs/SERVICES.md`) | ~US$20/month per member (EST)                                                                         | Before step 2c of the integration plan is switched on |
| **Gumroad fee**         | Checkout                                                                                                                                             | 10% + US$0.50 per direct sale (FACT, Oct 2026); 30% on Discover sales (FACT); card processing UNKNOWN | Per sale                                              |
| Domain record           | `studio.herlittleempire.com`                                                                                                                         | US$0 (a DNS record on the existing domain)                                                            | Before launch                                         |
| Custom SMTP for sign-in | Supabase's built-in mailer is heavily rate-limited                                                                                                   | US$0 on a free tier (EST ~3,000 emails/month, e.g. Resend)                                            | Before launch                                         |
| **Total fixed**         |                                                                                                                                                      | **~US$20/month (EST)**                                                                                |                                                       |

## 2. Strongly recommended, but not required for the first sale

| Item                                  | Why                                                                                                                           | Cost                            | When                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Supabase Pro**                      | Free projects pause after a period of inactivity and have no daily backups. A buyer's unlocked report and progress live there | ~US$25/month (EST)              | Before the first paid Studio or course customer; within the first weeks of Income Fit Test sales at the latest |
| Professional privacy and terms review | §5 of the integration plan                                                                                                    | UNKNOWN (fixed fee quotes vary) | Before driving paid traffic                                                                                    |

## 3. Optional, later

| Item                                       | Cost                                                                              | Trigger                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Mailing service                            | US$0 to ~1,000 subscribers (EST)                                                  | If Gumroad's emails can't run the sequence            |
| Anthropic API (Studio's AI)                | Cents per generation; capped by `EMPIRE_AI_DAILY_BUDGET_USD` (`docs/SERVICES.md`) | When the Launch Pack sells                            |
| Error reporting (Sentry or similar)        | US$0 on a free tier (EST)                                                         | Once there's real traffic                             |
| Vercel or Supabase add-ons (compute, PITR) | Varies                                                                            | Only with evidence of need                            |
| Shopify                                    | ~US$39/month Basic (EST)                                                          | **Not recommended** (no migration; Gumroad covers it) |

## 4. What one sale nets (hypothetical, before card processing and refunds)

| Product               | Price | Gumroad fee (10% + US$0.50) | Kept     |
| --------------------- | ----- | --------------------------- | -------- |
| Income Fit Test       | US$19 | US$2.40                     | US$16.60 |
| Empire Bundle (later) | US$39 | US$4.40                     | US$34.60 |

Fixed costs of about US$20/month (Pro) are covered by **2 Income Fit Test sales a month**. With Supabase Pro too (~US$45/month), it's **3**. These are EST break-evens on fixed costs, not a forecast of sales.
