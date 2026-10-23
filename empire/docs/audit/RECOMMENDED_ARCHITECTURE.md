# Recommended architecture (Phase 5)

**Recommendation only. Nothing is migrated or implemented.** Costs are EST (October 2026, from general knowledge; this session couldn't open pricing pages) unless marked FACT. Check each provider's pricing page before committing.

## 1. What has to be served

| Need                                                               | Today                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Marketing website                                                  | herlittleempire.com (platform UNVERIFIED, not in this repo)        |
| Checkout, tax, file delivery                                       | Gumroad (merchant of record: it collects and remits sales tax/VAT) |
| Course access, progress, members' tools                            | Empire Studio (Next.js + Supabase), built for this                 |
| Interactive software (FIT Finder, calculators, diagnostic, Studio) | Empire Studio                                                      |
| Email marketing                                                    | Nothing                                                            |

## 2. The three options

### A. Keep the website, add Shopify checkout

- Shopify would sell digital products through an app (for example Shopify's Digital Downloads). Course access and tools still need Empire Studio, so you'd run **website + Shopify + Studio**: three systems.
- Shopify is not merchant of record. **GST/VAT on overseas digital sales becomes the founder's to register for and remit** in each country that requires it (UNKNOWN which thresholds apply to her; check with the accountant).
- Cost (EST): Shopify Basic ~US$39/month or Starter ~US$5/month + payment fees, on top of today's costs.
- **Verdict: not recommended.** It adds a monthly fee, a tax burden and a third system, and solves nothing Gumroad doesn't.

### B. Shopify as the full storefront

- Rebuild the website on Shopify; courses through a Shopify course app or Studio.
- Same tax change as A; plus a migration of every product, listing and the website; plus course-app fees (EST US$20–100/month).
- **Verdict: not recommended now.** Highest cost and effort; the brief says don't migrate. Revisit only if HLE starts selling **physical** products.

### C. Keep the current application, connect commerce to it

- Keep herlittleempire.com as the marketing site; keep Empire Studio at `studio.herlittleempire.com` for every interactive product and course; keep **Gumroad** as checkout. This is what's already built: purchases become entitlements (`library:<slug>`) only from a verified sale (`docs/PAYMENTS.md`).
- **Verdict: recommended, without adding Shopify.** "Connect Shopify for commerce" isn't needed: Gumroad already does the commerce job, as merchant of record, and the code for it exists and is tested.

## 3. Recommended stack and monthly cost

| Piece              | Choice                                                | Cost                                                                    | When                                                        |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| Website            | Existing herlittleempire.com                          | Unchanged                                                               | Now                                                         |
| App                | Empire Studio on Vercel **Pro**                       | ~US$20/month (EST)                                                      | Before the first paid sale (Hobby is non-commercial)        |
| Database / sign-in | Supabase **Pro**                                      | ~US$25/month (EST); free while testing                                  | Before charging (free projects pause when idle, no backups) |
| Sign-in email      | Custom SMTP (e.g. Resend)                             | US$0 on a free tier (EST, ~3,000/month)                                 | Before launch                                               |
| Checkout           | Gumroad                                               | 10% + US$0.50 per direct sale (FACT, Oct 2026); card processing UNKNOWN | Now                                                         |
| Email marketing    | One service with a free tier (e.g. MailerLite or Kit) | US$0 to ~1,000 subscribers (EST)                                        | P1                                                          |
| AI (Studio only)   | Anthropic, capped by `EMPIRE_AI_DAILY_BUDGET_USD`     | Cents per generation (`docs/SERVICES.md`)                               | When Studio sells                                           |
| **Total fixed**    |                                                       | **~US$45–65/month (EST)** once on paid plans                            |                                                             |

**Cheaper path:** sell the course and calculator first and keep Supabase on free for the first weeks. That saves ~US$25/month at the cost of no backups. Not recommended once anyone has paid.

## 4. How each future need fits

| Need                        | Where it goes                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product delivery            | Gumroad for files; Studio for anything interactive                                                                                                                                                                    |
| Course access               | Studio `/ads/learn`, gated on `library:ads-that-actually-sell` (AD-1, AD-2)                                                                                                                                           |
| Future software tools       | Studio; one account, one sign-in for everything                                                                                                                                                                       |
| Email marketing             | The email service; Gumroad buyers added with consent (Gumroad's export or integration: UNKNOWN which applies to her account)                                                                                          |
| Subscriptions (P3)          | Stripe Billing behind the existing `BillingProvider` interface (`docs/PAYMENTS.md`): handles renewals and dunning better than Gumroad. Tax then needs a merchant-of-record alternative or registration (decide at P3) |
| Physical products (if ever) | Then revisit option B                                                                                                                                                                                                 |

## 5. One structural fix worth making

**Put herlittleempire.com under version control** (or at least export it regularly). Today it can't be reviewed, audited or rolled back, and the brand's front door is the one part nobody can see.
