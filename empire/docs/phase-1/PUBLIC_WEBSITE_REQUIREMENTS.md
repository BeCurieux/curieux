# Public website requirements (herlittleempire.com)

**Status, 23 October 2026 (FACT):** the public website's **platform and source code are unavailable** to this project.

- It isn't in `BeCurieux/curieux`, which holds nine unrelated apps plus `empire/` (`DEPLOYS.md`).
- No connected service shows it. The only connected Shopify store is PATONGA, another business; Google Drive isn't authorised.
- From this session, `herlittleempire.com` fails (proxy 403; DNS lookup "ENOTFOUND" from the web fetcher). That's this session's network policy, **not** evidence the site is down.

So this document **doesn't assume the website can be edited from here.** It's a specification the founder, or whoever manages the site, can apply in the site's own editor. Nothing about the site's current design or copy is known or changed.

## 1. Identify the platform (founder, 10 minutes)

| Check                                         | Where                                                                                           | Record              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| Which service you log in to, to edit the site | Your password manager or bookmarks (Squarespace, Wix, WordPress, Shopify, Carrd, Framer, other) | Platform name       |
| Who the domain is registered with             | The registrar's renewal emails (e.g. VentraIP, Crazy Domains, GoDaddy, Namecheap)               | Registrar           |
| Where DNS is managed                          | The registrar, or Cloudflare if you moved it                                                    | DNS host            |
| Any analytics or email tools on the site      | The platform's integrations or settings page                                                    | Names only, no keys |

Send those four facts, plus screenshots of the homepage and any product or about page. A later session can then write platform-specific steps.

## 2. What the website must link to (no redesign)

These are **links and short blocks** added in the site's existing style, using the brand's existing words.

| #   | Placement                               | Link text (suggested)               | Destination                                                                          | Why                                         |
| --- | --------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| W1  | Homepage, first screen (primary button) | **Get the free Fit Check**          | `https://herlittleempireco.gumroad.com/l/fit-check?ref=website` (confirm live first) | Primary lead magnet (founder decision)      |
| W2  | Homepage, beside W1 (secondary)         | **See the Income Fit Test (US$19)** | `https://herlittleempireco.gumroad.com/l/income-fit-test?ref=website`                | First paid offer                            |
| W3  | Homepage section "Free tools"           | **Take the free FIT Finder**        | `https://studio.herlittleempire.com/fit?ref=website`                                 | Interactive free tool                       |
| W4  | Same section                            | **Free ads calculator**             | `https://studio.herlittleempire.com/ads/tools/calculator?ref=website`                | Secondary free tool                         |
| W5  | Site navigation or footer               | **Sign in** (for buyers)            | `https://studio.herlittleempire.com/sign-in`                                         | Buyers reach the interactive report         |
| W6  | Footer                                  | Privacy · Terms and refunds         | The site's own pages, or Studio's `/privacy` and `/terms` once reviewed              | Policies visible from the brand entry point |

The full copy for W1–W2 landing sections is in [LAUNCH_COPY.md](LAUNCH_COPY.md).

**`?ref=website`:** Studio records it with the page view, and after cookie consent remembers it, so a later sign-up is credited to the website (`docs/ANALYTICS.md`). Gumroad shows referrers in its own analytics (UNVERIFIED for this account).

**Hold W3–W5 until Studio is live on `studio.herlittleempire.com`** (PHASE_1_STATUS.md, steps B–C). Until then those links would point at a preview URL that shouldn't be public.

## 3. The subdomain (DNS)

| Item                    | Value                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Record                  | `studio` → the record Vercel shows when `studio.herlittleempire.com` is added to the `empire-studio` project (Vercel → Project → Settings → Domains). It's typically a CNAME; **use exactly what Vercel displays** |
| Effect on the main site | **None.** The main site's own records (`@`, `www`) aren't touched                                                                                                                                                  |
| Who                     | Founder, at the DNS host. Founder approval required                                                                                                                                                                |
| Check                   | `https://studio.herlittleempire.com` serves Empire Studio over HTTPS; `https://herlittleempire.com` is unchanged                                                                                                   |

## 4. Requirements the website should meet before driving traffic

These are checks, not changes made. The founder ticks each in the site's editor.

| Requirement                                                                                               | Why                                                         |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| The promise reads "Make your own money. Know what you're getting into." exactly                           | Founder decision; consistent with Studio                    |
| No income figures, "passive income", countdowns or testimonials without written permission                | House rules                                                 |
| Seller identity visible: "Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com"             | Faceless, never anonymous                                   |
| The refund sentence is exactly "Full refund within 14 days of purchase, no questions asked."              | Founder decision                                            |
| Privacy notice covers anything the site collects (newsletter forms, analytics), with consent where needed | Needs checking against the site's actual tools (UNVERIFIED) |
| Every Gumroad link opens the right product and price                                                      | Test before launch                                          |
| Phone layout: the W1 button is visible without scrolling far                                              | Most social traffic is mobile (ESTIMATE)                    |

## 5. If the site can't be edited soon

Fallback, still with no website change:

- Instagram's bio link (W1) and the Gumroad listing carry the journey alone.
- Studio's `/fit` and `/ads/tools/calculator` pages already link to the Fit Check and the Income Fit Test.
