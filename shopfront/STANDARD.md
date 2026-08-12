# POPUUP: The Product Standard

Recorded 2026-08-12, as given. This is the product bar — where POPUUP is going,
who it is for, and what "done" means commercially.

**It is not the build contract.** `CLAUDE.md` is, and where the two disagree
`CLAUDE.md` wins until somebody changes it deliberately. Six collisions are
listed at the end of this file; three of them are enforced by
`tests/stop-line.test.tsx`, so building them early turns CI red on purpose.
That is the mechanism working, not a bug to route around.

---

POPUUP must do one thing exceptionally well:

> Turn a Shopify catalogue and a campaign brief into a beautiful, brand-perfect, always-current mini-shop in under three minutes—and prove that it generated sales.

If it nails that, it is not another link-in-bio tool or page builder. It becomes an **AI merchandising and campaign storefront platform**.

## 1. Start with the right customer

The initial customer should be a Shopify brand that:

* Has approximately 20–500 products
* Generates traffic from Instagram, TikTok, creators or paid ads
* Launches at least two campaigns or collections each month
* Has no dedicated web-development team
* Is already doing approximately US$20,000–$500,000 monthly sales
* Works in beauty, fashion, food, gifting, homewares or accessories

Do not begin with hobby stores, creators without a Shopify catalogue or enterprise retailers requiring extensive approval workflows.

The primary buyer is the founder, ecommerce manager or growth marketer.

## 2. Nail the "campaign to shop" workflow

This is the experience POPUUP must own.

### Step 1: Connect Shopify

Installation must automatically import:

* Products and variants
* Images and video
* Prices and compare-at prices
* Inventory status
* Collections and tags
* Product descriptions
* Vendors and product types
* Markets and currencies
* Existing discount codes
* Metafields where permitted

The merchant should never upload their catalogue manually.

### Step 2: Learn the brand automatically

POPUUP scans the merchant's existing store and creates a brand profile containing:

* Logo
* Colours
* Fonts
* Button treatments
* Corner radius
* Spacing style
* Photography treatment
* Copy tone
* Existing navigation and social links

The merchant reviews and corrects this once.

The standard is:

> A POPUUP shop should look as though the merchant's designer created it—not as though the merchant applied its colours to a POPUUP template.

### Step 3: Describe the campaign

The prompt should collect or infer:

* Audience
* Campaign goal
* Traffic source
* Products or collection
* Price range
* Promotion or creator code
* Tone and visual direction
* Start and end dates

Example:

> "Make an Instagram shop for university students featuring our five bestselling skincare products under $50. Lead with the starter set and apply BACKTOSCHOOL15."

POPUUP should also eventually accept:

* An ad creative
* Instagram or TikTok post
* Creator profile
* Existing landing page
* Campaign brief
* Product collection URL

### Step 4: Generate three excellent options

Do not generate arbitrary pages from free-form code.

The AI should convert the brief into a structured shop specification. A deterministic rendering engine then assembles it from tested components.

Each option should differ meaningfully:

* **Product-led:** hero product followed by supporting products
* **Editorial:** campaign story and curated collection
* **Fast-shop:** immediate products, price and add-to-cart

POPUUP should briefly explain its decisions:

> "The starter set leads because it fits the requested budget and has the strongest review score. The three supporting products create a complete routine."

This makes the AI useful and trustworthy rather than mysterious.

### Step 5: Refine conversationally

The merchant should be able to say:

* "Make it feel more editorial."
* "Move the lip oil to the top."
* "Only show products under $40."
* "Use less copy."
* "Replace anything that sells out."
* "Make the creator more prominent."
* "Add free shipping over $75."

Also provide simple controls for:

* Pinning and excluding products
* Reordering sections
* Editing text
* Changing colours and typography
* Selecting variants
* Configuring the discount
* Scheduling the campaign
* Setting sold-out behaviour

Do not turn this into a complex drag-and-drop page builder.

### Step 6: Publish on the merchant's domain

The ideal URL is:

* `brand.com/pages/summer-edit`
* `brand.com/apps/popuup/jess`
* `shop.brand.com/mothers-day`

Shopify supports app proxies that can display externally generated experiences while keeping visitors on the merchant's domain. Its Storefront API supports products, carts and checkout. [Shopify app proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies), [Shopify Storefront API](https://shopify.dev/docs/api/storefront/latest)

POPUUP.co is the company and dashboard. Shoppers should ordinarily remain on the merchant's domain.

## 3. Make the storefront genuinely shoppable

The shopper must be able to:

* Select variants
* See current price and availability
* Add products to a shared Shopify cart
* Apply the campaign discount
* View essential product information
* Move directly into Shopify checkout
* Continue shopping without losing the campaign cart

Avoid forcing the shopper through several separate product pages.

The mobile experience is the real product. Desktop quality still matters, but most campaign and social traffic will arrive on phones.

Performance targets:

* First meaningful content in under 1.5 seconds on a normal mobile connection
* Largest Contentful Paint below 2.5 seconds
* No layout movement as product images load
* Thumb-friendly variant and add-to-cart controls
* No intrusive newsletter modal before shopping
* Accessible contrast, type sizes and tap targets

## 4. Make every shop "stay true"

This is POPUUP's most important product promise:

> Set it once. It stays true.

A published shop must never knowingly display:

* An incorrect price
* An expired discount
* A product as available when it is sold out
* A deleted product
* An unavailable variant
* A campaign countdown that has ended
* An outdated sale message

Merchants choose a sold-out policy:

* Hide the product
* Show "Notify me"
* Replace it automatically
* Retain it as social proof
* Redirect to the closest alternative

POPUUP should also support:

* Scheduled launch and expiry
* Automatic sale start and end
* Market-aware currency and pricing
* Collection changes
* Inventory-aware product ordering
* Automatic replacement rules
* A visible sync-status indicator in the dashboard

This is a stronger differentiator than AI page generation.

## 5. Make the merchandising better than the merchant could do manually

The engine needs three layers.

### The Merchant Graph

A structured understanding of:

* Products and variants
* Collections and attributes
* Price bands
* Inventory
* Margins, when supplied
* Reviews
* Purchase relationships
* Brand rules
* Campaign history

### The Shop Recipe Engine

Tested compositions for specific commercial jobs:

1. New product drop
2. Creator or affiliate edit
3. Gift guide or occasion
4. Price-based collection
5. Sale or clearance campaign
6. Bestseller shop
7. Ad-matched landing shop
8. Product routine or bundle

AI selects and configures the appropriate recipe. It should not invent unstable layouts every time.

### The Performance Graph

Over time, POPUUP learns:

* Which product position drives clicks
* Which hero treatment converts
* Which price bands work for an audience
* Which items are commonly purchased together
* Which creator audiences prefer which products
* Which shop structures work by traffic source
* Where shoppers abandon the experience

This performance layer—not the underlying language model—becomes the defensible asset.

## 6. Provide indisputable analytics

Every shop should show:

* Visits
* Product impressions
* Product clicks
* Add-to-cart rate
* Checkout starts
* Purchases
* Revenue
* Conversion rate
* Average order value
* Revenue per visitor
* Best-performing products
* Drop-off points
* Performance by creator, campaign and traffic source

The merchant should be able to answer:

> "Did this POPUUP shop perform better than sending traffic to our ordinary collection page?"

Support:

* UTM preservation
* Meta Pixel
* TikTok Pixel
* Google Analytics
* Shopify Web Pixels
* Creator and affiliate attribution

Shopify's Web Pixels system exposes behavioural and checkout events for analytics and campaign optimisation. [Shopify Web Pixels](https://shopify.dev/docs/apps/build/marketing/pixels)

Analytics must respect consent choices and regional privacy requirements.

## 7. Make cloning a superpower

Once a merchant has one successful shop, creating another should take seconds.

Examples:

* Duplicate the Mother's Day shop for Father's Day
* Turn the Jess creator shop into a version for Maya
* Make US, UK and Australian versions
* Create five audience variants from one campaign
* Change the price ceiling from $100 to $50
* Generate matching shops for three different advertisements

The reusable primitive is:

> One catalogue → unlimited audience-specific shops.

This is where POPUUP becomes more valuable than a one-off landing-page generator.

## 8. Make the AI controllable

Merchants must always be able to:

* See which products the AI selected
* Understand why they were selected
* Lock or remove products
* Preview every price, discount and variant
* Approve changes before publication
* Roll back to a previous version
* Turn automatic optimisation off
* Define non-negotiable brand rules

The AI must never:

* Invent product claims
* Fabricate reviews
* Create a discount without confirmation
* Publish unsupported health or performance claims
* Change live shops materially without permission
* Replace merchant copy silently
* Generate arbitrary executable storefront code

The correct architecture is:

> AI interprets intent → structured shop specification → tested POPUUP components render it.

## 9. Nail the five core visual recipes

Do not launch with 100 mediocre templates. Launch with five superb compositions:

1. **The Drop**
   Dramatic hero, countdown, new products and scarcity.

2. **The Edit**
   Editorial introduction and tightly curated product selection.

3. **The Creator Shop**
   Creator introduction, favourites, personal notes and code.

4. **The Gift Guide**
   Shop by recipient, budget or occasion.

5. **The Fast Shop**
   Minimal copy, immediate product grid and rapid add-to-cart.

Every recipe must handle:

* One to twenty products
* Portrait and landscape imagery
* Long and short product names
* Sale prices
* Multiple variants
* Sold-out products
* Mobile and desktop
* Dark and light brand systems

## 10. Price it as commerce software

Do not price POPUUP like a generic link-in-bio service.

A sensible structure:

| Plan   |             Price | Designed for                                           |
| ------ | ----------------: | ------------------------------------------------------ |
| Trial  |  Free for 14 days | Experience the complete product                        |
| Launch |       US$29/month | Small brands, 3 active shops                           |
| Growth |       US$79/month | Unlimited campaigns, analytics and scheduling          |
| Scale  |      US$199/month | Creator attribution, optimisation and multiple markets |
| Agency | From US$299/month | Multiple stores and client workspaces                  |

The product must show generated revenue inside the dashboard so the subscription is evaluated against sales—not against cheaper bio-link tools.

## 11. The exact MVP

The first sellable version needs:

* Shopify App Store installation
* Automatic catalogue sync
* Automatic brand extraction
* Prompt-based shop creation
* Five shop recipes
* Product pinning and exclusion
* Conversational copy and layout changes
* Mobile preview
* Merchant-domain publishing
* Live price and inventory sync
* Variant selection
* Shopify cart and checkout
* Discount-code support
* Shop duplication
* Scheduling
* Basic conversion and revenue analytics
* "Powered by POPUUP" on trial shops
* Stripe or Shopify subscription billing

It does **not** initially need:

* A creator marketplace
* AI-generated product photography
* Full website generation
* Email marketing
* A CRM
* Customer accounts
* Loyalty points
* Complex personalisation
* Arbitrary page layouts
* Native iOS or Android apps
* Non-Shopify ecommerce platforms
* Autonomous optimisation

## 12. Launch acceptance criteria

Do not call POPUUP ready until:

* A new merchant publishes their first shop in under three minutes
* At least 80% of test users publish without needing design help
* Every shop looks convincingly on-brand
* Prices, variants and stock remain accurate
* Discounts apply correctly
* Add-to-cart and checkout work across mobile browsers
* Shop analytics reconcile reasonably with Shopify orders
* A merchant can duplicate and adapt a shop in under one minute
* Sold-out replacement works without breaking the layout
* Shops remain attractive with imperfect product photography
* Uninstallation removes storefront integration cleanly
* No prompt can cause arbitrary code execution
* Ten real merchants have used it for actual campaigns
* At least five merchants say they would be genuinely disappointed to lose it

## 13. The metrics that matter

Ignore vanity metrics such as total generated shops. Track:

### Activation

* Shopify connection rate
* Time to first published shop
* Percentage generating a shop
* Percentage publishing a shop

### Usage

* Active shops per merchant
* New shops created monthly
* Percentage of shops receiving traffic
* Percentage duplicated or adapted

### Commercial value

* Gross merchandise value influenced
* Revenue per POPUUP shop
* Conversion rate
* Add-to-cart rate
* Improvement versus the merchant's ordinary destination
* Subscription revenue as a percentage of influenced GMV

### Retention

* Merchants publishing again within 30 days
* Three- and six-month retention
* Shops remaining live
* Campaign frequency
* Expansion from Launch to Growth

The north-star metric should be:

> **Monthly merchant revenue generated through POPUUP shops.**

## The five things that must be exceptional

If everything else is stripped away, POPUUP wins or loses on these:

1. **Speed:** brief to published shop in under three minutes.
2. **Taste:** the result looks designed, not generated.
3. **Truth:** products, prices, stock and promotions never quietly rot.
4. **Merchandising:** POPUUP chooses and arranges products intelligently.
5. **Proof:** the dashboard demonstrates revenue and conversion impact.

That is the bar. If POPUUP nails those five, competitors may copy "prompt to page," but they will not have the same brand engine, catalogue intelligence, living sync, performance data and merchant workflow.

---

# Where this collides with CLAUDE.md

Recorded at the same time as the standard, so the disagreements are visible
rather than discovered halfway through a task. `CLAUDE.md` remains
authoritative; each item needs a deliberate decision. One has been made —
item 4, one shop rather than five. The rest are open.

## 1. The Performance Graph is PULSE

§5's third layer — "Over time, POPUUP learns … this performance layer, not the
underlying language model, becomes the defensible asset" — is the drawer rule's
subject, and the drawer rule says it does not exist yet: *"no learned weights,
no experimentation framework, no 'intelligence' claims in copy, no schema built
for a learning system we don't have. Log faithfully (step 6) and build nothing
on top."*

The standard and the rule are not actually in conflict about the destination,
only about when. Step 6 already logs everything the Performance Graph would
need. `tests/stop-line.test.tsx` fails on `experiment`, `variant_group`,
`ab_test`, `bandit`, a `weights:` literal, or the word `pulse` appearing in
`src/`.

## 2. "Hide the product" is not an available sold-out policy

§4 offers five merchant-chosen sold-out policies, the first of which is *hide
the product*. `CLAUDE.md`: *"Sold-out products are shown (marked), never
hidden."* The visual suite asserts it at every mood and viewport, and would go
red on a hide policy.

The other four — notify-me, auto-replace, keep as social proof, redirect to
nearest — do not conflict. Notify-me is email capture, which is Sprint 3.

## 3. Most of §11's MVP is behind the stop line

`CLAUDE.md` step 7 gates OAuth sync, email capture, creator shops, billing,
word-editing and TikTok-URL input on the kill test (5+ of 30 merchants wanting
their shop live). The standard's MVP list includes Shopify App Store install,
Stripe/Shopify billing, conversational editing and creator attribution.

Four of the stop-line test's seven assertions fail the moment any of that is
built: Shopify Admin API or OAuth tokens in `src/`, a `<form>` or `<input>`
anywhere, `EditMove` used outside `schema.ts`, and any mention of Stripe. That
is the test doing its job — *"If one of these starts failing, that is not a bug,
it is somebody having built a Sprint 3 feature."*

The honest options are to run the kill test, or to move the gate on purpose.

## 4. Three options and five recipes — DECIDED: one shop

**Decided 2026-08-12: one shop, not five.** The merchant describes the campaign
and gets a finished shop. No gallery, no side-by-side comparison, no "pick a
layout" step. §4's "generate three excellent options" and §9's five named
compositions are internal — the AI picks the recipe, and the merchant sees the
result of that choice, refined by conversation rather than by browsing
alternatives.

The north star this protects: *"There is no page builder. The prompt is the
builder … if a proposed feature adds blocks, sections, layout pickers, template
galleries, or any builder-shaped UI: the answer is no."*

The renderer already works this way and should stay that way. `mood` is one of
five values in `ShopConfig`, chosen by the model from the brand's own voice
(`src/lib/merchandise/prompt.ts`: *"Pick the mood from how the brand writes, not
from what it sells"*), never offered as a choice. Recipes, when they arrive,
belong in the same place: a field the model fills, not a screen the merchant
shops in.

This does not close off showing the merchant *why* — §4's "the starter set
leads because it fits the requested budget" is explanation, not a picker, and
step 6 already persists the decisions it would be built from.

Same section, `§5`'s controls: *pinning, excluding, reordering sections,
editing text, changing colours* are all inside the declared word-editing move
set, so they are Sprint 3 scheduling rather than a north-star problem.

## 5. New third-party services

`CLAUDE.md` fixes the stack at Next.js · TypeScript · Supabase · Stripe ·
Anthropic · Vercel, plus Playwright, and adds: *"No other services without
asking."* §6 introduces Meta Pixel, TikTok Pixel, Google Analytics and Shopify
Web Pixels. Shopify's own APIs arrive with OAuth in item 3; the three
third-party pixels are a separate decision, and each is a consent and
regional-privacy surface as §6 itself notes.

## 6. "Set it once. It stays true." must not be printed before it is wired

Not a conflict — a sequencing trap. `CLAUDE.md`: *"nothing on the page may
claim sync/liveness that isn't yet wired for that store."* The standard makes
liveness the headline promise. The promise is right; putting it on a generated
page, or in dashboard copy, before OAuth sync exists for that merchant is the
exact dishonesty the rule names.

## Where the two agree, strongly

Worth saying, because it is most of the document:

* §8's *"AI interprets intent → structured shop specification → tested POPUUP
  components render it"* is `CLAUDE.md`'s one architectural law, restated.
  Already built and enforced by zod validation with retry.
* §8's never-list — invent claims, fabricate reviews, generate executable
  storefront code — matches the product rules exactly.
* §3's mobile-first framing matches *"mobile-first always; desktop is the
  adaptation."*
* §12's *"shops remain attractive with imperfect product photography"* is the
  renderer's stated job, and the visual suite runs against a fixture that is
  deliberately bad in seven ways.
* §1's 20–500 product range is mostly covered. The Genome's hard cap is 160
  products (`src/lib/genome/prompt.ts`), and it says so in its own output
  rather than silently truncating — but a 500-product catalogue is currently
  read as its first 160.
