# Ads That Actually Sell: implementation plan

Milestones follow the brief's build sequence. Each is a separate, reviewable step and isn't done until its acceptance criteria pass. Estimates are rough working time.

## M0. Audit and scaffold (this step)

- [x] Existing assets audit: `docs/HLE_EXISTING_ASSETS_AUDIT.md`
- [x] Architecture decisions: `docs/HLE_ARCHITECTURE_DECISIONS.md`
- [x] This plan

**Accepted when:** Vee has confirmed the checkout, where the app lives, credentials and delivery (done 23 Oct 2026), and the ladder overlaps in the audit (§2) are on her list.

## M1. Calculator engine and Module 1 (about 1 day)

The numbers come first, because every later module's worked examples depend on them.

- [x] `src/lib/ads/calculator.ts`: net revenue, contribution before and after ads, break-even CAC, break-even ROAS (only where defined), actual CAC and ROAS, break-even spend by order count, and low/base/high scenarios. Handles GST included, excluded or not registered, fixed and percentage fees, refunds, upsells and discounts.
- [x] Fixtures worked out independently, covering zero purchases, zero margin, negative margin, a discount larger than the price, 100% refunds and fractional fees.
- [x] Module 1, The Numbers, written in full with AUD examples computed by the same engine (`content/ads/modules/01-the-numbers.md`; a test recomputes every figure it quotes).

**Accepted when:** all fixtures pass; no output is ever Infinity or NaN; Module 1 has every required part (outcome, prerequisites, time estimate, instruction, worked example, mistakes, checklist, assessment with answers, dated sources).

## M2. Member area, access and the lesson reader (about 1 day)

- `/ads/learn` dashboard with progress and "resume", and a lesson reader that renders the Markdown, with search and a completed state.
- `ads_progress` table: migration, RLS test and data model entry.
- Access gated on `library:ads-that-actually-sell`; a sample lesson open to everyone.
- Calculator page with saved scenarios (`ads_scenarios`), CSV export and a print view.

**Accepted when:** without access, members see only the sample; with a verified test purchase, everything is visible; progress survives a reload; Playwright covers purchase → access → lesson → tool on desktop and phone, with axe checks.

## M3. Modules 2–10 and the toolkit (about 3–4 days of writing)

- Modules 2–10 written in full, to the same standard as Module 1.
- Toolkit: 30 distinct ad concepts, 12 faceless shot lists, 10 caption templates, a research worksheet, a testing matrix, a launch checklist, a landing page audit, a profitability sheet, a diagnostic worksheet, the 14-day workbook, the 5-email sequence, support FAQs and a glossary, as Markdown and CSV.
- Every claim that needs Vee's evidence is a clearly marked placeholder, never invented.

**Accepted when:** no lorem ipsum or empty sections; the claims guard passes over all content in a test; every platform fact has a dated source or UNKNOWN; Vee has reviewed the tone of Module 1 and one other module.

## M4. Diagnostic tool (about 1–2 days)

- `src/lib/ads/diagnose.ts`: data-quality checks, funnel stage analysis, ranked hypotheses, a next test with a success criterion, prioritisation, and the "What we can't conclude yet" panel.
- Tests for empty, contradictory and tiny-sample inputs, plus a test that the UI's wording never claims certainty.
- Saved diagnostics, CSV export and a print view.

**Accepted when:** fixtures pass; contradictory inputs, such as more purchases than clicks, are flagged rather than diagnosed; small samples go to "can't conclude yet".

## M5. Sales page, lead magnet and launch readiness (about 1 day)

- `/ads` sales page: the promise, who it's for, curriculum, sample lesson, what's included, preview images, FAQs, pricing labelled as test pricing internally, and the refund wording.
- First Sale Checklist and its landing page; the onboarding email copy.
- Release checklist run: links, CTAs, no placeholders, Module 2 facts verified, keyboard and screen-reader pass, build, lint and tests.

**Accepted when:** every item in the brief's acceptance criteria passes, with a real Gumroad test purchase.

## Blocked on Vee (none of these block M1–M4)

1. Gumroad products for each rung, priced in AUD, and their product ids.
2. Upgrading Vercel to **Pro** before taking money (Hobby is non-commercial).
3. Verifying Module 2's Meta and Shopify steps against the live interfaces (this session can't reach outside sites).
4. Deciding the ladder overlaps (audit §2).
5. Whether onboarding emails go through Gumroad or a mailing service.
