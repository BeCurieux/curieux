# External services and expected costs

Every figure is labelled, per Her Little Empire's rule: **FACT** (checked at
the source, with the date), **EST** (a reasoned estimate) or **UNKNOWN**.
Check each provider's pricing page before launch.

| Service                       | Used for                                                                       | Plan to start                                                                 | Expected cost                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel**                    | Hosting, cron                                                                  | Pro (Hobby is non-commercial)                                                 | ~US$20/month (EST, Oct 2026)                                                                                                    |
| **Supabase**                  | Postgres, Auth, Storage                                                        | Free to test; Pro before charging (free projects pause when idle, no backups) | US$0 → ~US$25/month (EST, Oct 2026)                                                                                             |
| **Custom SMTP** (e.g. Resend) | Sign-in emails via Supabase Auth — the built-in mailer is heavily rate-limited | Free tier (~3,000 emails/month, EST)                                          | US$0 → ~US$20/month (EST)                                                                                                       |
| **Anthropic API**             | Generation                                                                     | Pay as you go                                                                 | See below                                                                                                                       |
| **Gumroad**                   | Checkout                                                                       | Existing account                                                              | 10% + US$0.50 per direct sale (FACT, checked Oct 2026, Little Offer Kit); 30% on Discover sales (FACT); card processing UNKNOWN |
| **Domain**                    | `studio.herlittleempire.com`                                                   | Existing domain                                                               | US$0 (a DNS record)                                                                                                             |

**Fixed running cost before customers:** roughly US$45–65/month (EST) once on paid
plans; US$0 while testing on free tiers with the mock generator.

## AI cost per customer

Estimates (EST) for `claude-opus-5-5` (US$4 / US$20 per million input / output
tokens — FACT, Anthropic price list, Oct 2026) at `EMPIRE_AI_EFFORT=low`. A generation sends ~2–3k input tokens
(rules, her profile, the method) and returns ~2–6k output tokens.

|                               | Per generation | Typical pack use (~25 generations) | Full allowance (80) |
| ----------------------------- | -------------- | ---------------------------------- | ------------------- |
| Opus 5.5                      | ~US$0.05–0.13  | ~US$1.50–3.25                      | ~US$4–10.50         |
| Sonnet 5.5 (US$2 / US$10)     | ~half          | ~US$0.75–1.60                      | ~US$2–5.20          |
| Haiku 5.5 (US$0.10 / US$0.50) | ~1/40          | cents                              | under US$0.50       |

On a US$49 sale (US$43.60 after Gumroad's 10% + US$0.50, before card processing), even full use of the allowance on
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
