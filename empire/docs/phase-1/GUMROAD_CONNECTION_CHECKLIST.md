# Gumroad connection checklist

**Goal:** a purchase of the Income Fit Test (directly, or in a bundle that contains it) on Gumroad unlocks the full FIT Finder report in Empire Studio, and a refund locks it again.

The code is built and unit-tested against a fake Gumroad (`src/lib/billing/`, `docs/PAYMENTS.md`). Only configuration is missing.

**Secrets rule:**

- The **access token**, **ping secret** and **cron secret** go only into Vercel → `empire-studio` → Settings → Environment Variables, marked **Sensitive**, for Production (and Preview if testing there).
- Never into the repository, a chat, a screenshot or an email.
- **Product ids aren't secret**; they go into the code.

Steps marked 🔒 need the founder's explicit approval.

## 1. Development-side mapping (done in this phase)

| Item                                     | Status                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mapping code                             | `librarySlugFor` / `productTypeFor` (existing): a Gumroad product id → `library:<slug>`. Bundles unlock their contents (`expandLibrary`)                                |
| **Id helper script (new)**               | `scripts/gumroad-products.ts`: lists your Gumroad products (read-only) and suggests the catalogue slug for each, by permalink, then exact title. Never prints the token |
| **Safety test (new)**                    | `tests/unit/phase1.test.ts`: every id is well-formed and no id is listed under two products                                                                             |
| Ids filled in `src/content/catalogue.ts` | **Not yet: all empty.** They come from the founder's Gumroad account                                                                                                    |

## 2. Product ids (founder → small code change)

1. In Vercel, add `GUMROAD_ACCESS_TOKEN` (step 3 creates it). Or, on your own computer only, in a terminal, run:
   ```sh
   cd empire
   GUMROAD_ACCESS_TOKEN=<paste here, never save it in a file> npx tsx scripts/gumroad-products.ts
   ```
   Alternatively, copy each id from the product's Gumroad edit page.
2. Check every suggested line by eye, then send the printed **id list** (ids only, no token) to the build session.
3. These go into `gumroadProductIds`:

| Priority | Catalogue slug      | Product                    | Why                                                         |
| -------- | ------------------- | -------------------------- | ----------------------------------------------------------- |
| **Must** | `income-fit-test`   | The Income Fit Test        | First paid offer; unlocks the full FIT report               |
| **Must** | `empire-bundle`     | The Empire Bundle          | Contains the Income Fit Test                                |
| **Must** | `the-whole-empire`  | The Whole Empire           | Contains the Income Fit Test                                |
| Should   | `fit-check-freebie` | The 5-Question Fit Check   | Shows the free download in the buyer's library              |
| Later    | the other products  | —                          | Library display only                                        |
| Not now  | Launch Pack         | `GUMROAD_PRODUCT_ID` (env) | Not for sale yet; leave unset (pages say "not on sale yet") |

4. Acceptance: a unit test maps each pasted id to the right slug; `catalogueIdProblems()` returns nothing; CI is green.

## 3. Access token 🔒

1. Gumroad → Settings → Advanced → **Applications** → create an application. Any name, e.g. "Empire Studio"; the redirect URI can be the app's URL.
2. Open it → **Generate access token**.
3. Paste it into Vercel as `GUMROAD_ACCESS_TOKEN` (Sensitive). Close the page; don't store it anywhere else.
4. What it's used for: looking up a sale by id before trusting a ping; finding purchases by email ("Look for purchases made with my email"); the daily refund recheck.

## 4. Ping secret and ping URL 🔒

1. Generate 32 random characters on your own computer: `openssl rand -base64 32`.
2. Vercel: `GUMROAD_PING_SECRET` = that value (Sensitive).
3. Gumroad → Settings → Advanced → **Ping** → `https://studio.herlittleempire.com/api/billing/gumroad?token=<the same value>`.
   - Pings cover **every** product on the account.
   - Only set this once the custom domain serves Studio in **production** (PHASE_1_STATUS.md step C).
4. The ping is never trusted on its own. The app looks the sale up with Gumroad, records it once per sale id, and grants access only for a real, unrefunded sale.

## 5. Refunds 🔒

1. Vercel: `CRON_SECRET` = another `openssl rand -base64 32` (Sensitive). The daily recheck at 09:17 UTC (`vercel.json`) re-verifies purchases from the last 45 days and locks refunded ones.
2. **Faster refund notices:** subscribe the same ping URL to Gumroad's `refund` and `dispute` resources (`PUT https://api.gumroad.com/v2/resource_subscriptions`, with the access token). A build session can make this one-off call in a way that never displays the token. **Confirm with the founder first.**
3. Refund behaviour (built): the entitlement becomes `refunded`, the full report locks back to the free top three, and saved answers stay. The purchase record is kept (tax).

## 6. Other settings Studio needs in production

| Variable                                    | Value                                             | Secret?         |
| ------------------------------------------- | ------------------------------------------------- | --------------- |
| `APP_URL`                                   | `https://studio.herlittleempire.com`              | No              |
| `EMPIRE_BACKEND`                            | `supabase` (already set on preview)               | No              |
| Supabase keys                               | Already set on preview; copy to Production        | Secret key: yes |
| `EMPIRE_SESSION_SECRET`                     | 48 random characters                              | Yes             |
| `GUMROAD_PRODUCT_URL`, `GUMROAD_PRODUCT_ID` | **Leave unset** until the Launch Pack is for sale | —               |

## 7. Done when

- [ ] Ids for the three "Must" products are in the catalogue (merged, approved).
- [ ] `GUMROAD_ACCESS_TOKEN`, `GUMROAD_PING_SECRET` and `CRON_SECRET` are present in Vercel Production (a name check only; values never displayed).
- [ ] The ping URL is set in Gumroad.
- [ ] The refund and dispute subscriptions are listed by `GET /v2/resource_subscriptions`.
- [ ] [CUSTOMER_JOURNEY_TEST_PLAN.md](CUSTOMER_JOURNEY_TEST_PLAN.md) T1–T12 all pass.
