# Ads That Actually Sell: existing assets audit

**Audited 23 October 2026** for the master brief _Ads That Actually Sell: The Small-Budget Meta Ads Playbook_. The brief says to inspect what Her Little Empire already has before choosing an architecture. This is that inspection.

## 1. What exists

### Storefront and checkout

| Asset                       | What it is                                                                                                                                              | Status                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Gumroad (herlittleempireco) | Where every Her Little Empire product sells today: 19 products and 3 bundles, plus the free Fit Check (`src/content/catalogue.ts`)                      | Live. **Chosen for this course** (founder, 23 Oct 2026)                                  |
| Shopify                     | The only Shopify store connected to this workspace is **PATONGA** (patonga.com.au, Basic plan, AUD). That's a different business, not Her Little Empire | Not used. The brief's "existing Shopify site" premise doesn't hold for Her Little Empire |
| herlittleempire.com         | The public website. Its platform wasn't inspectable from this session (network policy)                                                                  | Linked from the app footer; not changed                                                  |

### Empire Studio (this app): reusable as-is

Empire Studio (`empire/`, pull request BeCurieux/curieux#68) already has everything the brief asks for under "member area" and "payment/access workflow". The course is built inside it (founder, 23 Oct 2026).

| Need in the brief                                  | Existing piece                                                                                                                    | Where                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Passwordless login via a proven auth solution      | Supabase magic-link sign-in; works on the preview (verified 23 Oct 2026)                                                          | `src/app/sign-in`, `src/app/auth/callback`                     |
| Server-side access control                         | Entitlements (`launch_pack` or `library:<slug>`), checked on the server; row level security on every customer table               | `src/lib/billing/plans.ts`, `supabase/migrations`              |
| Verified purchase, granted once, revoked on refund | Gumroad licence verification and sale lookup, idempotent on `(provider, external_purchase_id)`, daily refund recheck              | `src/lib/billing/`, `docs/PAYMENTS.md`                         |
| Never grant access from a redirect alone           | Access comes only from a verified Gumroad sale or ping (signed `empire_ref`, ping secret)                                         | `src/lib/billing/gumroad.ts`                                   |
| Consent-aware first-party analytics                | Cookie banner, first-party events, nothing sent to third parties                                                                  | `src/components/consent.tsx`, `src/lib/analytics`              |
| Data deletion and export                           | Account deletion cascades; data export endpoint                                                                                   | `src/app/api/account`                                          |
| Brand tokens                                       | Aubergine, ivory, blush, rose; Bodoni Moda 800, Lora, Inter, Caveat (self-hosted)                                                 | `src/app/globals.css`, `public/fonts`                          |
| Seller details and refund wording                  | Footer: "Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com"; exact refund sentence plus consumer-rights sentence | `src/components/shell/imprint.tsx`, `src/lib/billing/plans.ts` |
| Claims guard                                       | Flags income claims, fake urgency, PLR/MRR, MLM and more                                                                          | `src/lib/ai/guard.ts`                                          |
| Deterministic calculators with tests               | The Fit Finder calculator: zero-safe, tested against fixtures                                                                     | `src/lib/fit/engine.ts`                                        |
| Accessibility checks                               | axe checks in Playwright on desktop and phone                                                                                     | `tests/e2e`                                                    |
| Hosting                                            | Vercel project `empire-studio`; Supabase project "Empire Studio" (US East)                                                        | `docs/ENVIRONMENT.md`                                          |

The brief's visual direction (cream, ink, warm taupe, muted blush, an elegant serif with a modern sans) is already met by the existing tokens. Its own rule, "use existing brand tokens first", applies, so no new palette.

### Her Little Empire methods the course can build on

Her Little Empire's products contain **no Meta ads method**. Ads appear only in passing: Etsy's paid Boosted Listings (Get Found), ManyChat on boosted posts (Comment-to-DM Kit), "#ad" disclosure and advertising as a deductible expense (Rules Guides). So the ten modules are original, as the brief requires. These existing methods carry over:

| Existing method                                                                                | Source                                            | Use in the course                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Fee maths and price floor (floor = hours × minimum return + costs + fees); price check signals | Price It Right                                    | Module 1 (The Numbers); the calculator's fee handling                                |
| Gumroad fee formula (7 → 5.80, 19 → 16.60, and so on)                                          | Little Offer Kit                                  | Worked examples, calculator fixtures                                                 |
| "Not enough evidence" rule: fewer than 5 real conversations isn't a no                         | Income Fit Test (corrected report)                | Diagnostic tool's "What we can't conclude yet" panel; Modules 5 and 8                |
| Change one thing at a time; adjust or stop rules                                               | Income Fit Test, 90-Day Grow Plan                 | Modules 8 and 9 (one-variable tests, kill rules)                                     |
| Six-part sales page, five-question page check, honest launch price                             | Sell It Simply                                    | Module 6 (Landing page and funnel), landing page audit checklist                     |
| Email consent rules by country (dated)                                                         | Sell It Simply                                    | Module 6, the 5-email sequence                                                       |
| 100 hooks (7 goals), four hook formulas, honest caption check                                  | 100 Faceless Hooks, Faceless Content System       | Module 4; the 30 ad concepts are new and distinct, but follow the same honesty rules |
| Six faceless formats, filming privacy checks                                                   | Faceless Content System, Faceless & Not Anonymous | The 12 faceless shot lists                                                           |
| Ad disclosure ("#ad", "Paid ad" at the start)                                                  | Rules Guides                                      | Module 4 compliance notes (each country's rule, dated)                               |
| House rules: no income claims, real testimonials only, FACT/EST/UNKNOWN labels with dates      | README, `src/content/methodology.ts`              | Every lesson, template and the sales page                                            |

## 2. Overlaps with the product ladder (decisions for Vee)

The brief's ladder is hypotheses to validate. Three rungs overlap products already on sale:

| Brief                                  | Existing                                                                  | Issue                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Free: First Sale Checklist             | The 5-Question Fit Check (free, `fit-check`)                              | Two free lead magnets aimed at different moments (choosing an idea vs selling one). Fine if positioned apart. |
| AUD 29: Digital Product Starter Kit    | Your Little Offer Kit (US$19), Etsy Digital Downloads Starter Kit (US$29) | Close overlap. Either reposition, or bundle the existing kits instead of writing a new one.                   |
| AUD 79: First 100 Sales System/Roadmap | First 5 Customers (US$7), 90-Day Grow Plan (US$24)                        | Overlaps, and "100 sales" reads as a promise. The brief already suggests "Roadmap"; even that needs care.     |
| AUD 149: Ads That Actually Sell        | Nothing                                                                   | New. This is what the brief asks to build first.                                                              |

The catalogue is priced in US$; this course is in AUD. Gumroad prices each product in its own currency, and the app's catalogue needs a currency per item (see the architecture decisions).

## 3. Gaps

- **No email marketing service** in the stack. Lead magnet delivery and the 5-email onboarding need either Gumroad's own tools (free product delivery, emails to buyers; verify current features) or a new service.
- **No course content** exists; all ten modules, the templates and the 14-day workbook are new writing.
- **No lesson reader, progress tracking or downloads area** in Empire Studio yet.
- **Meta and Shopify interface details** can't be verified from this session: the network policy blocks outside sites. Every interface instruction is marked UNKNOWN, with the official page to check, until Vee or a later session verifies it.

## 4. Security, privacy and cost notes

- **Vercel plan:** the project is on **Hobby**, which Vercel limits to non-commercial use (`docs/SERVICES.md`). Selling anything through it needs **Pro** (about US$20/month, EST, Oct 2026) before launch.
- **Ad metrics are business data.** Diagnostic inputs are stored per account under row level security, never logged, and exportable and deletable like everything else.
- **No Meta login or Ads API** in the first build (as the brief says). Nothing holds a Meta token.
- **New recurring costs from this course: none**, beyond Vercel Pro (needed anyway to sell Empire Studio) and Gumroad's per-sale fee (10% + US$0.50 per direct sale, FACT, Oct 2026).
- **Credentials** stay off the course and its sales page (founder, 23 Oct 2026; README rule).
