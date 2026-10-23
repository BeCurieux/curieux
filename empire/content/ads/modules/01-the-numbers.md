---
slug: 01-the-numbers
module: 1
title: The Numbers
outcome: Work out, before you spend a dollar on ads, the most you can pay for one sale and still make money, and read your ad results against that number instead of against a feeling.
prerequisites:
  - A product with a price, even a draft one
  - Your payment platform's fee (Gumroad, Shopify Payments, Stripe or similar)
  - A rough idea of your refund rate (use 5% if you have no history yet)
estimated_minutes: 60
estimate_note: EST, based on reading time plus filling in one product in the calculator; your first product may take longer
sources:
  - Gumroad fee, 10% + US$0.50 per direct sale | docs/SERVICES.md (Little Offer Kit) | FACT, checked 23 Oct 2026
  - Gumroad card-processing charges on top of that fee | gumroad.com/pricing | UNKNOWN, check your own payout statement
  - Australian GST registration threshold, A$75,000 turnover a year | Her Little Empire Rules Guide (Australia) | FACT, checked 17 Oct 2026
  - What Meta Ads Manager calls each reported figure (purchases, purchase value, ROAS) | facebook.com/business/help | UNKNOWN, field names checked in Module 2
  - US$0.50 to Australian dollars | your bank or Gumroad payout statement | EST, A$0.80 used as a round planning figure
---

## What you'll be able to do

By the end of this module you'll have one number for each product: your **break-even cost per sale**. It's the most you can spend on ads to win one order without losing money on it. Every later module uses it. When an ad "isn't working", this is how you'll know whether it's actually losing money or just feels slow.

You'll also be able to:

- turn a price into what you actually keep, after fees, GST and refunds
- read ROAS (return on ad spend) properly, and know why a ROAS above 1 can still be a loss
- say, for any amount of ad spend, how many sales it needs to break even

## Before you start

You need four things for one product. Write them down; rough is fine, and you'll refine them later.

1. **The price** the customer sees.
2. **Your payment fee**, as a percentage plus any fixed amount per sale.
3. **Your costs per order**: anything you pay each time someone buys. For a digital product this is often nothing. For a physical product it's materials, packaging and postage.
4. **Your refund rate**: the share of orders you refund. No history yet? Plan on 5% and replace it with your real figure later.

All the examples in this module are **hypothetical**. They're there to show the maths, including the ones that lose money. None of them are results from a real business.

## The lesson

### 1. Price is not what you keep

When someone pays A$49, three things come out before you see it:

- **GST**, if you're registered. In Australia you must register once your turnover reaches A$75,000 a year. If you're registered, GST is collected for the tax office: it was never yours to spend.
- **Refunds.** If 3 in every 100 orders are refunded, you keep the money from 97 of them on average.
- **Fees.** Your payment platform takes its cut on what the customer paid, and it usually keeps it even when you refund.

Then your **costs per order** come out: anything you spend because this one order happened.

What's left is your **contribution per order**: the money each sale leaves over to pay for advertising and, after that, to pay you.

> Contribution per order = (price − GST) × (1 − refund rate) − fees − costs per order

### 2. Your break-even cost per sale

If each order leaves A$41.83 of contribution, you can spend up to A$41.83 on ads to win that order and break even. Spend less and the sale makes you money; spend more and it costs you.

That's the whole idea. It's called break-even **CAC** (customer acquisition cost). Every ad result in this course gets compared to it.

If your contribution is zero or less, there's no break-even cost. Each sale already loses money before ads, and no amount of ad spend fixes that. Change the price, the fees or the costs first.

### 3. ROAS, and why above 1 can still lose

Ads platforms often report **ROAS**: revenue divided by ad spend. A ROAS of 2 means every A$1 of ads brought in A$2 of sales.

The catch: ROAS uses **revenue**, the full price, not what you keep. If you keep A$41.83 of a A$49 sale, you need to bring in A$49 for every A$41.83 you spend just to break even. That's a ROAS of 1.17. Below it, you lose money even though the platform says each dollar "returned" more than a dollar.

> Break-even ROAS = what the customer pays ÷ contribution per order

The thinner your margin, the higher your break-even ROAS. A product where you keep half the price needs a ROAS of 2 just to stand still.

### 4. How many sales does this spend need?

Turn it around before you launch an ad: for the budget you're about to spend, how many sales does it need to break even?

> Sales needed = ad spend ÷ contribution per order, rounded up

If that number looks unlikely for your budget, you know before you spend it.

### 5. Upsells and later purchases

An upsell (a second product offered at checkout) adds to what each order is worth, but only for the share of buyers who take it. If 1 in 5 buyers adds a A$19 extra, each order is worth an extra A$3.80 on average, before fees.

Customers who come back and buy again later are worth more than their first order. That's real, but it's uncertain until it happens. The calculator shows it as a separate figure and never folds it into your break-even number. Plan on the first sale paying for itself.

## Worked example

These are hypothetical products, worked through the course calculator. Gumroad's fee is 10% + US$0.50 per sale; we use A$0.80 for the US$0.50 as a round planning figure. Check the conversion on your own payout statement.

### A. A A$49 planner bundle

- Price A$49, not registered for GST
- Fees 10% + A$0.80
- No costs per order (it's a download)
- 3% of orders refunded

Working it through:

- What you keep after refunds: A$49 × 0.97 = A$47.53
- Fees: A$49 × 10% + A$0.80 = A$5.70
- **Contribution per order: A$41.83.** This is the break-even cost per sale.
- **Break-even ROAS: 1.17**
- Five sales break even at up to A$209.15 of ad spend in total.

Now a hypothetical first week of ads: A$120 spent, 2 sales.

- Cost per sale: A$120 ÷ 2 = A$60.00, above the A$41.83 break-even
- ROAS: A$98 ÷ A$120 = 0.82
- Contribution from those 2 sales: A$83.66
- **After the ad spend: −A$36.34.** A loss.
- This spend needed 3 sales to break even.

That's not a verdict on the product. Two sales is far too few to judge anything (Module 8 covers how many you need). But it tells you exactly how far off break-even you are, which a feeling can't.

### B. A A$12 printable, with and without an upsell

- Price A$12, same fees and refund rate, no costs per order

Contribution per order: **A$9.64**. Break-even ROAS: **1.24**.

The fixed part of the fee hurts small prices more: A$0.80 is under 2% of A$49 but nearly 7% of A$12.

If 2 in every 100 visitors to the product page buy, you can afford **A$0.19** per visit. That's a tight budget, and it's why cheap products are hard to sell with ads alone.

Add a A$19 upsell that 1 in 5 buyers takes. Each order is now worth A$15.80 on average, and contribution rises to **A$12.95**. That's an upsell doing what it's for: giving the ad more room.

### C. A A$66 physical product, GST included

A hypothetical seller who **is** registered for GST, selling a A$66 item (GST included), with a 2.9% + A$0.30 card fee, A$18 of materials and postage per order, and 2% refunds.

- GST in the price: A$6.00
- **Contribution per order: A$38.59**
- **Break-even ROAS: 1.71**

Notice how GST and costs per order push break-even ROAS up even though the fee is lower.

### D. A launch discount

The A$49 bundle from example A, at 40% off for launch week: the customer pays A$29.40.

- **Contribution per order: A$24.78**, down from A$41.83
- **Break-even ROAS: 1.19**

A 40% discount cut what each sale can pay for ads by more than 40%, because the fixed fee doesn't shrink. If you run ads to a discount, use the discounted figures.

## Common mistakes

- **Comparing ad cost to the price instead of to contribution.** "I paid A$40 for a A$49 sale, so I made A$9." You didn't: after fees and refunds, example A made about A$1.83, before your time.
- **Treating ROAS above 1 as profit.** Break-even ROAS is above 1 for every product with any fees or costs.
- **Counting GST as revenue.** If you're registered, it's the tax office's.
- **Leaving out refunds.** Even a low refund rate lowers what every sale is worth.
- **Planning on repeat purchases you haven't seen yet.** Use them once your own records show them.
- **Judging from two sales.** The numbers here tell you where break-even is; they can't tell you from a handful of sales whether an ad works.
- ✗ "Spend A$1, get A$3 back, guaranteed." (Nobody can promise an ad result. If you see this, walk away.)

## Your checklist

- [ ] I've written down price, fees, costs per order and refund rate for one product
- [ ] I've worked out my contribution per order in the calculator
- [ ] I know my break-even cost per sale for that product
- [ ] I know my break-even ROAS, and that it's above 1
- [ ] I've checked how many sales my first ad budget needs to break even
- [ ] If I use a launch discount, I've worked out the discounted figures too

## Check your understanding

1. A product sells for A$30. Fees are 10% + A$0.80, there are no costs per order and no refunds. What's the contribution per order?
2. The same product's ads report a ROAS of 1.1. Is it making money on ads?
3. Each order leaves A$20 of contribution. You plan to spend A$150 on ads. How many sales does that spend need to break even?
4. Why should repeat purchases be kept out of your break-even cost per sale?
5. A product's contribution per order is −A$2. What should you change before running ads?

## Answers

1. A$30 − (A$3.00 + A$0.80) = **A$26.20**.
2. **No.** Break-even ROAS is A$30 ÷ A$26.20 = 1.15. A ROAS of 1.1 is below it, so each sale costs slightly more in ads than it leaves.
3. A$150 ÷ A$20 = 7.5, rounded up: **8 sales**.
4. Because they're uncertain until they happen. Planning on them means spending money you might never get back. Use them once your records show them.
5. **The price, the fees or the costs**, not the ads. Each sale already loses A$2; more ad spend just loses more.

## Sources

Each fact is labelled FACT (checked, with the date), EST (an estimate) or UNKNOWN (not yet checked). The full list is in this module's details above.

- Gumroad's fee of 10% + US$0.50 per direct sale: FACT, checked 23 Oct 2026. Card processing on top: UNKNOWN; check your payout statement.
- Australian GST registration at A$75,000 turnover a year: FACT, checked 17 Oct 2026 (Her Little Empire Rules Guide).
- A$0.80 for US$0.50: EST, a round planning figure only.
- What Meta calls each reported figure: UNKNOWN until Module 2 is checked against the live Ads Manager.
