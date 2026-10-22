# External services and expected costs

Prices change: check each provider's pricing page before launch. Figures
below are as understood in October 2026 and are estimates, not quotes.

| Service                       | Used for                                                                              | Plan to start                                                                 | Expected cost                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Vercel**                    | Hosting, cron                                                                         | Pro (Hobby is non-commercial)                                                 | ~US$20/month                                                                        |
| **Supabase**                  | Postgres, Auth, Storage                                                               | Free to test; Pro before charging (free projects pause when idle, no backups) | US$0 → ~US$25/month                                                                 |
| **Custom SMTP** (e.g. Resend) | Sign-in emails via Supabase Auth — Supabase's built-in mailer is heavily rate-limited | Free tier (~3,000 emails/month)                                               | US$0 → ~US$20/month                                                                 |
| **Anthropic API**             | Generation                                                                            | Pay as you go                                                                 | See below                                                                           |
| **Gumroad**                   | Checkout                                                                              | Existing account                                                              | Per-sale fee (about 10% + US$0.50 on direct sales at the time of writing — confirm) |
| **Domain**                    | `studio.herlittleempire.com`                                                          | Existing domain                                                               | US$0 (a DNS record)                                                                 |

**Fixed running cost before customers:** roughly US$45–65/month once on paid
plans; US$0 while testing on free tiers with the mock generator.

## AI cost per customer

Estimates for `claude-opus-5-5` (US$4 / US$20 per million input / output
tokens) at `EMPIRE_AI_EFFORT=low`. A generation sends ~2–3k input tokens
(rules, her profile, the method) and returns ~2–6k output tokens.

|                               | Per generation | Typical pack use (~25 generations) | Full allowance (80) |
| ----------------------------- | -------------- | ---------------------------------- | ------------------- |
| Opus 5.5                      | ~US$0.05–0.13  | ~US$1.50–3.25                      | ~US$4–10.50         |
| Sonnet 5.5 (US$2 / US$10)     | ~half          | ~US$0.75–1.60                      | ~US$2–5.20          |
| Haiku 5.5 (US$0.10 / US$0.50) | ~1/40          | cents                              | under US$0.50       |

On a US$49 sale (~US$43 after Gumroad), even full use of the allowance on
Opus 5.5 leaves a healthy margin. The usage ledger records the estimated
cost of every call, and `/admin` shows average AI cost per paying customer
— **measure real usage in Phase C before choosing a cheaper model.** Changing
model is one variable (`EMPIRE_AI_MODEL`); quality should be compared on real
customer profiles first.

Controls already in place: per-account lifetime allowance, 15
generations/hour per account, a platform-wide daily ceiling
(`EMPIRE_AI_DAILY_BUDGET_USD`), failed generations not charged to the
customer but still recorded in the ledger, and the free plan limited to 4
generations producing a single sample prompt.
