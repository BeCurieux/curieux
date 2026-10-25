# Seven-day launch plan

**Goal:** by day 7, a stranger can land, use something genuinely useful for free, join the list with consent, and buy, receive and access a paid product, with every claim honest. **Not the goal:** launching the full Ads course. Nine modules of writing plus checking Meta's live screens doesn't fit honestly in seven days.

**What launches:** the free Ads Profitability Calculator (lead magnet), email capture and welcome sequence, Empire Studio in production, and working access for past buyers (Income Fit Test owners get the full FIT Finder report).

Each day lists who does what. "Vee" = founder; "build" = a Claude Code session.

| Day | Vee (founder)                                                                                                     | Build                                                                                                                  | Done when                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Merge #68. Upgrade Vercel to Pro. Decide the first paid offer (P0-5) and the credentials wording (BRAND §3)       | Rebase and push `hle-ads`; open the Ads course PR                                                                      | Production deploy of `main` green                               |
| 2   | Copy Gumroad product ids; create the access token; add the ping URL. Point `studio.herlittleempire.com` at Vercel | Fill ids in `catalogue.ts`; fix the handle in the env example; set up custom SMTP with her account                     | Sign-in email from the custom sender works on the custom domain |
| 3   | Choose the email service (P1-2)                                                                                   | Calculator page `/ads/tools/calculator`: inputs, results, formulas, CSV, print; tests on desktop and phone             | Page passes e2e and axe; figures match engine tests             |
| 4   | Review privacy and terms drafts; send to a reviewer if possible                                                   | Consent-based email capture on the calculator and FIT Finder; privacy page completed (processors, location, retention) | Test signup lands in the list with consent recorded             |
| 5   | Approve the welcome sequence's tone                                                                               | Write the five welcome emails (guard-checked); public landing linking FIT Finder → calculator → kits; SEO basics       | Five emails pass the claims guard; landing live                 |
| 6   | Real purchase of one product and one bundle with a second email; refund one                                       | Watch the ping and recheck; fix anything found                                                                         | Library shows the purchase; refund removes it after the recheck |
| 7   | Tell past buyers (`docs/MIGRATION.md` email, updated); share the calculator in her channels                       | Check `/admin` funnel; write the first numbers-shown report (visits, signups, purchases), labelled as real counts      | First real numbers recorded, whatever they are                  |

## Costs in the week (EST)

Vercel Pro ~US$20/month; Supabase stays free in week 1 (move to Pro, ~US$25/month, before the first paid Studio or course customer); SMTP and email service on free tiers; Gumroad's 10% + US$0.50 per sale (FACT, Oct 2026) on the test purchase.

## Out of scope this week, on purpose

Ads Modules 2–10, the diagnostic tool, the `/ads` sales page, the Launch Pack checkout (unless P0-5 picks it and P0-7 is done), a gold accent, any Shopify store, membership.

## Risks to the week

- Any founder step slipping (days 1–2 are all hers) moves everything after it.
- DNS changes can take up to a day to settle (EST).
- If the reviewer can't read the privacy and terms text this week, launch the free tools and email only, and hold paid changes.
