# Digital product catalogue (updated 22 October 2026)

From Vee's `catalog.py` ("single source of truth: products, files, prices, bundles"). Prices are US$, live on Gumroad as listed; **Empire Studio displays them and never changes them.** The app's copy is `src/content/catalogue.ts`.

## New software

| Product              | Price                                                                     | Status                                                          |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Empire Studio — free | US$0                                                                      | New: brand preview, one Sidekick prompt, every workflow visible |
| Shopify Launch Pack  | US$39–59 (default label US$49; set `NEXT_PUBLIC_LAUNCH_PACK_PRICE_LABEL`) | New, one-time: 80 generations, 10 products, all studios, export |

## Existing products (unchanged)

| Product                                  | Price | On Gumroad | In Empire Studio                        |
| ---------------------------------------- | ----- | ---------- | --------------------------------------- |
| The Income Fit Test                      | 19    | yes        | **FIT Finder unlocked for owners**      |
| Video Course                             | 6     | yes        | not supplied yet                        |
| First 5 Customers                        | 7     | yes        | launch-email honesty rules              |
| Get Found                                | 7     | yes        | listing SEO rules                       |
| Price It Right                           | 5     | yes        | planned: pricing calculator             |
| 14-Day Tracker                           | 4     | yes        | FIT Finder saved progress               |
| Brand-in-a-Box                           | 9     | yes        | Brand Blueprint palette/font rules      |
| 100 Faceless Hooks                       | 9     | yes        | social kit hooks; planned: hook library |
| Comment-to-DM Kit                        | 12    | yes        | social method source                    |
| 30-Day Faceless Content Plan             | 17    | yes        | social launch week                      |
| Your Little Offer Kit                    | 19    | yes        | listing, homepage and email methods     |
| VA & Online Business Manager Starter Kit | 29    | yes        | service pathway (future)                |
| Etsy Digital Downloads Starter Kit       | 29    | yes        | Etsy Studio (future)                    |
| Pinterest Manager Starter Kit            | 29    | yes        | service pathway (future)                |
| Tutor & Lesson Starter Kit               | 29    | yes        | service pathway (future)                |
| The 90-Day Grow Plan                     | 24    | yes        | post-launch plan (future)               |
| Side Income Money System                 | 19    | yes        | planned: money tracker                  |
| Client Paperwork Kit                     | 19    | not yet    | downloadable only (legal-template rule) |
| AI Business Assistant Pack               | 12    | not yet    | prompts informed the methods            |

**Bundles** (owning a bundle counts as owning everything in it): The Empire Bundle US$39 (Income Fit Test, video course and the five add-ons); The Faceless Content Bundle US$29 (hooks, 30-day plan, comment-to-DM, Get Found); The Whole Empire US$99 (all 19).

**Not in `catalog.py`:** Sell It Simply, the Faceless Content System workbook, Faceless & Not Anonymous and the Fit Check freebie have finished PDFs but no price or Gumroad status — decide whether they're products, bonuses or retired drafts. **Not found at all:** Business Starter System, Money & Operations Kit.

**Not offered yet, by design:** Studio subscription (US$29/month) until repeat use is proven; Pro (US$99/month) until real automation exists.

**To do before library matching works:** copy each product's and bundle's Gumroad product id into `gumroadProductIds` in `src/content/catalogue.ts`.
