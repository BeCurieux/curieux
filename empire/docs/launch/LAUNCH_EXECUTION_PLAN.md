# Launch execution plan

**Goal: one verified end-to-end sale before any new Academy features.** A buyer goes from herlittleempire.com or a free tool, through Gumroad, to verified access in Empire Studio, and a test refund works.

> **Status update, 25 October 2026:** PR BeCurieux/curieux#68 and PR BeCurieux/curieux#69 (`hle-ads`) are merged into `main`, and the email sign-up migration (`20261024000005`) is applied to the Supabase project. Studio still isn't public on `studio.herlittleempire.com` (Vercel Pro and DNS pending) and Gumroad isn't connected. The rest of this document describes the date above.

**Strategy (founder, 23 Oct 2026):**

- herlittleempire.com is the brand entry point.
- Gumroad handles payments.
- Empire Studio holds the signed-in tools and courses.
- No Shopify migration.
- Nothing merged, deployed, published, purchased or changed in production without explicit approval.

Read with: [CUSTOMER_JOURNEY.md](CUSTOMER_JOURNEY.md) · [PLATFORM_INTEGRATION_PLAN.md](PLATFORM_INTEGRATION_PLAN.md) · [FIRST_OFFER_RECOMMENDATION.md](FIRST_OFFER_RECOMMENDATION.md) · [LAUNCH_COSTS.md](LAUNCH_COSTS.md) · [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) · the audit in [`docs/audit/`](../audit/AUDIT_REPORT.md).

## 1. Current status (verified 23 Oct 2026)

| Item                     | Status                                                                                                                                                                             | How verified                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| PR BeCurieux/curieux#68  | **Open, not merged.** Mergeable ("clean"); head `80d3595`; checks green: `check` (the `empire` CI workflow) success, Vercel preview for `empire-studio` "Deployment has completed" | GitHub API                                 |
| `main`                   | Last commit 7 Oct 2026 (`17327de`), with **no `empire/` folder**                                                                                                                   | GitHub API                                 |
| Production deployment    | **None for Empire Studio.** `main` has nothing to build. The Vercel dashboard itself isn't reachable from here                                                                     | Inferred from `main`; UNVERIFIED in Vercel |
| Preview deployment       | Works (founder signed in on it, 23 Oct 2026)                                                                                                                                       | Founder; GitHub status                     |
| Branch `hle-ads` (local) | 2 commits on top of `80d3595` (Ads course plan; calculator engine and Module 1), plus this work. **Not pushed**                                                                    | `git log`                                  |
| Public website           | Source and hosting **unavailable**: flagged in PLATFORM_INTEGRATION_PLAN §1                                                                                                        | Repository, network, connectors            |

## 2. What this step implemented (development only, on `hle-ads`)

| Change                                                                                                                                                                                                                                                  | Files                                                                                                                                               | Tested by                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Free Ads Profitability Calculator page**, public, on the tested engine                                                                                                                                                                                | `src/app/ads/tools/calculator/page.tsx`, `src/components/ads/calculator.tsx`, `src/lib/ads/calculator-view.ts`, `src/components/ads/offer-link.tsx` | `tests/unit/ads-calculator-view.test.ts` (12), `tests/e2e/calculator.spec.ts` (7 × 2 viewports)     |
| Guardrails against misleading conclusions: "not enough evidence" under 5 sales; "ROAS above 1 can still be a loss"; a loss-making product flagged first; above break-even reported "for this period only"; limits section; no predictive wording (test) | same                                                                                                                                                | same                                                                                                |
| Next-step links: Fit Check (free, Gumroad), FIT Finder, Income Fit Test                                                                                                                                                                                 | same; `FIT_CHECK_URL` in `src/content/catalogue.ts`                                                                                                 | e2e (hrefs)                                                                                         |
| Analytics: `calculator_viewed`, `offer_clicked` (offer name only)                                                                                                                                                                                       | `src/lib/analytics/track.ts`, `src/app/api/events/route.ts`, `docs/ANALYTICS.md`                                                                    | e2e "sends nothing typed"                                                                           |
| **Consent fix:** campaign cookie only after analytics consent                                                                                                                                                                                           | `src/components/beacon.tsx`, `src/components/consent.tsx`                                                                                           | existing e2e                                                                                        |
| **Privacy and terms gaps** fixed for review                                                                                                                                                                                                             | `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`                                                                                                | e2e (axe on both pages; processors named)                                                           |
| **Five-email welcome sequence**                                                                                                                                                                                                                         | `content/emails/welcome-sequence.md`                                                                                                                | `tests/unit/emails.test.ts` (claims guard, refund sentence, unsubscribe, figure matches the engine) |
| Gumroad handle fixed in the env example                                                                                                                                                                                                                 | `docs/ENVIRONMENT.md`                                                                                                                               | —                                                                                                   |

**Checks run** (local backend, mock AI):

- lint, types and format: pass;
- **135 unit tests** pass;
- production build passes;
- **38 Playwright tests** pass (desktop and phone, axe included);
- RLS suite: no database change in this step (last pass 23 Oct 2026, audit).

## 3. The sequence to the first verified sale

Each phase ends with an acceptance test from [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md).

| Phase                      | What happens                                                                                                                                 | Who                                | Approval needed                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| **A. Review**              | Vee reviews the calculator page (preview), the privacy and terms text, the welcome emails and the first-offer recommendation                 | Vee                                | Her sign-off on each                                 |
| **B. Merge and ship code** | Merge #68. Push `hle-ads` and open its PR (it creates a Vercel preview). Merge once green                                                    | Vee merges; build pushes           | **Yes**: merge #68; push `hle-ads`; merge the new PR |
| **C. Hosting**             | Vercel Pro; custom domain `studio.herlittleempire.com`; custom SMTP; Supabase URL settings                                                   | Vee                                | **Yes**: purchase; DNS                               |
| **D. Gumroad**             | Product ids into the catalogue (a code change, small PR); access token, ping secret, cron secret into Vercel; ping URL; refund subscriptions | Vee + build                        | **Yes**: production integration                      |
| **E. Content fixes**       | CORRECTIONS §1–2 and the report patches applied to the Income Fit Test files; the listing line about Empire Studio                           | Vee                                | Her call (her listings)                              |
| **F. Test sale**           | The procedure in PLATFORM_INTEGRATION_PLAN §3: buy, verify access, refund, verify lock                                                       | Vee, with a build session watching | **Yes**: a real card charge                          |
| **G. Open the front door** | Two links on herlittleempire.com; load the welcome sequence; post the calculator                                                             | Vee                                | **Yes**: website change                              |
| **H. First real sale**     | Watch `/admin`; record the first real numbers, labelled as real counts                                                                       | Vee                                | —                                                    |

**Not in this plan, on purpose:**

- Ads course modules 2–10, the diagnostic tool and the Academy dashboard: P2 and P3, after phase H.
- The Launch Pack checkout.
- Membership.
- Any new overlapping product.

## 4. Decisions waiting on Vee

1. **Approve the first offer:** the Income Fit Test (FIRST_OFFER_RECOMMENDATION).
2. **Approve the calculator page** for publishing (on the preview after phase B).
3. **Approve the privacy and terms text,** and whether to get a professional review before phase F (recommended).
4. **Approve the welcome sequence,** and where it's sent from (Gumroad, if its emails can do it, or a mailing service).
5. **Choose a usage-event retention period** (for example 24 months), so the privacy page can state it and the code can enforce it.
6. **Credentials wording** (from the audit): still open; nothing about credentials was added.
