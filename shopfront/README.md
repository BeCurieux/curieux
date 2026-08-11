# popuup

Make a shop in a sentence. See `BRIEF.md` for what this is and `CLAUDE.md` for
the rules that must never be violated.

**Sprints 1–2 are complete: all six steps of the build order — the ingester,
the Catalogue Genome, the merchandiser, the renderer, publish, and provenance +
funnel.**

```
pnpm install
pnpm generate kelpandcotton.com "a clean bio shop for the knitwear post"
pnpm dev                                                   # then open the URL it printed
pnpm funnel kelp-and-cotton                                # did anyone buy anything?
```

That is the whole pipeline in one command. The stages are also separable, which
is how you iterate on one of them:

```
pnpm ingest kelpandcotton.com                              # store URL -> catalogue + brand
pnpm genome kelpandcotton.com                              # catalogue -> what each product is for
pnpm merchandise kelpandcotton.com "<prompt>" --render     # -> ShopConfig, previewable
pnpm test
pnpm typecheck
```

With nothing configured it runs on the deterministic providers and writes to
`.cache/`, so it works on a laptop with no accounts. `AI_PROVIDER=anthropic`
uses the model; `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` uses the database.
See `.env.example`; whichever store ran is named in the output.

Each stage caches at a different grain, because each costs a different thing.
The ingest is a crawl of somebody else's storefront and is reused until
`--fresh`. The Genome is a model pass over a whole catalogue and is reused until
`--regenome`. Only the merchandising runs every time — it is the only stage
whose answer depends on the prompt.

## 1. The ingester

Store URL in; catalogue and brand context out, as `IngestResult`
(`src/lib/ingest/types.ts`).

```
ingestStore("kelpandcotton.com")
  ├── homepage        canonical origin (apex vs www settled once), brand surface
  ├── robots.txt      honoured; see below
  ├── brand           name, logo, colours, voice evidence, links
  └── catalogue       four ways to get products, tried in order:
        1. /products.json                    the whole catalogue in 1-4 requests
        2. /collections/all/products.json    same feed, different route
        3. sitemap -> /products/<handle>.js  one request per product
        4. rendered collection page          Playwright, last resort
```

The first rung that yields products wins. Every attempt lands in
`diagnostics.trace` whether it worked or not, which is what makes "why did this
store come back empty?" a five-second question.

## 2. The Catalogue Genome

Catalogue in; a private read of what each product is *for* out.

```
enrichCatalogue(ingest)
  ├── brief        every product's title, type, tags, options and description
  ├── one pass     one Anthropic call over the whole catalogue, not one per product
  ├── validate     zod for shape, then semantics: do these handles exist, is this
  │                 graph coherent, is there a price hiding in the prose?
  ├── compute      price tier and photography, which the model is never asked for
  └── store        .cache/genome/<store>.json, beside the catalogue
```

**The relationship graph is the point.** Titles and prices are already in the
catalogue; what is not there is which two products belong in the same routine
and which two are the same decision at different price points. `complements` and
`substitutes` are what make a three-step routine an actual routine rather than
three products in an arbitrary order, and they are why this is one pass over the
whole catalogue rather than one call per product — a model looking at a single
listing cannot know what it relates to.

**Two fields are computed, not inferred.** Both are questions about
measurements, and a model answering them is confidently wrong in a way that is
hard to spot:

| Field | Why it is not the model's to answer |
|---|---|
| `priceTier` | Quantiles of *this store's* own prices. £180 is entry-level in one catalogue and flagship in another; any absolute band gets one of them wrong, and a model shown one product at a time has no distribution to read |
| `photography` | Image count, resolution and aspect ratio, from what the ingest measured. Never an aesthetic judgement — we have not seen the pixels, and a flag claiming a photograph is ugly would be inventing |

`photography.dimensionsKnown` carries the same discipline as `availabilityKnown`
on the catalogue: some ingest surfaces return bare image URLs, and "we did not
measure" must never be recorded as "measured and found wanting". Unmeasured
imagery can never be rated `strong`, because `strong` is what the merchandiser
leans on to pick a hero.

**None of it is ever rendered.** The Genome is the most quotable text in the
system — `problemSolved` reads like a product blurb and `audience` reads like a
headline — and both are somebody's reading of a marketing description. A shopper
meeting one as a claim about their own life is exactly the failure the
internal/external line exists to prevent. So the line is structural rather than
a matter of discipline: the Genome is not a field on `ShopConfig`, it is not part
of `ShopRenderInput`, and the renderer is never handed it.
`tests/genome-internal.test.tsx` plants a telltale string in every Genome field
and asserts it reaches the merchandiser's brief and nothing else.

Free text in the Genome is validated against the same banned claims as page
copy (`src/lib/claims.ts`, shared with the merchandiser). A Genome that says
"the £148 jumper" hands the merchandiser a price it can echo without inventing
anything itself, and a snapshot's price outlives the snapshot.

**The Genome is a per-store cost; the merchandiser is a per-shop one.** A
merchant generating twenty shops from one catalogue pays for one read, which is
why `pnpm genome` is its own command and `pnpm merchandise` loads what it
stored. `staleFor()` reports which catalogue products a stored Genome no longer
covers, so a grown catalogue degrades to partial coverage that says so rather
than to a silently stale graph.

**The deterministic read.** `AI_PROVIDER=mock` infers from structure alone —
same product type means substitute, shared tags across types mean complement —
and writes `"Not inferred without a model pass"` where a model would write an
audience. It is visibly mechanical on purpose: it is the baseline the real pass
has to beat, and a baseline that flattered itself would be useless for that.

## 3. The merchandiser

Catalogue + brand context + the merchant's prompt in; `ShopConfig` out.

```
merchandise(ingest, "nothing over £80, lead with the crew", { genome })
  ├── brief        brand, its own voice, its colours, a closed set of URLs, the
  │                 catalogue — each product carrying its Genome line
  ├── generate     one Anthropic call, output_config.format = the plan schema
  ├── validate     zod for shape, then semantics against THIS store
  │                 └── invalid? the errors go back as the next turn. Up to 3 attempts.
  └── assemble     brand and provenance filled from the ingest, never from the model
```

**The model fills a narrower schema than `ShopConfig`.** It produces the parts
that are genuinely merchandising decisions — selection, order, grouping, copy,
theme — and the code fills `brand.name`, `brand.logoUrl`, `brand.storeUrl` and
`meta` from the ingest, the prompt and the clock. A model asked for a logo URL
can produce a plausible wrong one, and a plausible wrong logo is a shop that is
subtly not the merchant's.

**Two schemas, one object, and a test that stops them drifting.** The JSON
Schema in `plan-schema.ts` goes on the request — its `description` fields are
prompt surface the model reads while filling each field. The zod schema in
`plan.ts` is derived from `schema.ts` and does the enforcing.
`tests/plan-schema.test.ts` asserts they agree on block types, enum members and
required fields.

**Structured outputs, not tool use.** The merchandiser produces exactly one
object; a tool would be pretending there was a function to call.

### What validation catches that a schema cannot

Shape is the easy half. These are the failures that actually hurt, each one a
rule from the brief:

| Check | Because |
|---|---|
| Every handle is in the catalogue | A phantom product is an order the merchant cannot fill |
| Image indexes and variant ids belong to their product | A pinned variant that isn't theirs is the wrong item at the wrong price |
| Every URL comes from a closed set built from the ingest | A link somewhere the merchant doesn't control is the worst thing this can ship |
| No price, rating, review count or stock level in copy | The renderer resolves those live; copy about them goes stale silently |
| No claim of sync, liveness or connection | Nothing is wired yet, and the merchant reads this page first |
| Offer codes appear in the merchant's own prompt | An invented code fails at their checkout |
| `launchesAt` only when the brief gives a date | The renderer counts down to it |
| Text clears 4.5:1 on the background, accent 3:1 | A shop nobody can read is worse than one that ignored the brand's grey |
| "Everything under £80" is actually everything under £80 | The one price claim the page may make is the one worth checking |

Warnings never trigger a retry: sold-out products all quietly dropped, a
selected product with no photograph, a catalogue trimmed before it was offered.

### Blocks available in this sprint

`hero`, `productGrid`, `routine`, `drop`, `offer`, `linkList`.

`reviews` and `capture` are in `schema.ts` and deliberately not offered to the
model. Review data isn't ingestable from a public storefront, and email capture
is Sprint 3 — a form that posts into nothing is exactly the dishonesty the brief
rules out. Both are one line from available once the thing behind them is.

### The deterministic merchandiser

`AI_PROVIDER=mock` assembles a defensible default from the ingest alone: the
brand's own line as the headline, photographed products first, the colourway
read off the brand's own stylesheet, and no copy it cannot source. It has one
hard contract — it always produces a plan that passes validation.

It is the test fixture, the renderer's input without a model call per reload,
and the baseline. If the model's shop isn't obviously better than this,
the merchandising isn't earning its cost. It is **not** a fallback: if the API
is unreachable the run fails rather than quietly shipping a heuristic shop.

## 4. The renderer

`ShopConfig` + catalogue in; one page out. No branching on brand, category or
block count beyond what the tokens already say.

```
<Shop config catalogue ingestedAt />
  ├── theme.ts     5 tokens -> ~40 CSS custom properties on the root
  ├── resolve.ts   handle -> live price, stock and photograph, at render time
  ├── image.ts     the merchant's own CDN asked for the widths this layout uses
  └── shop.css     one hand-written stylesheet, mobile-first, serving every shop
```

### Where the taste budget went

**One plate ratio, one tint, one page.** Every product photograph is cropped to
the mood's `--plate-ratio` and sits on the same surface colour. That single
decision does most of the work of flattering a mixed catalogue: a landscape
studio shot, an underexposed phone snap and a floating white cut-out stop
arguing with each other the moment they are all the same shape on the same
ground. Nothing is filtered — the merchant's goods have to look like the
merchant's goods — but a soft radial vignette on the plate keeps a blown-out
white background from bleeding into the page.

**A product with no photograph gets its initial, set huge in the display face.**
A grey rectangle is the single clearest tell that a page was generated.

**Mood has to mean something.** `luxe` and `playful` differ by plate ratio, hero
height, whether the hero bleeds to the edges, eyebrow case and tracking, rule
weight, and the display scale, tracking and weight — not by a corner radius.
`tests/render-theme.test.ts` asserts all five moods produce distinct
fingerprints, because if two of them collapse, one was decoration.

**The brand's two faces, self-hosted.** A warm editorial serif for display over
Space Grotesk for everything a shopper reads at 14px. Both come from npm rather
than Google Fonts — no third-party connection, no request to a stranger's CDN
carrying a shopper's IP — as latin-subset variable woff2: 62KB and 22KB, two
files rather than the eight a static family would need. `font-display: swap`
with a metric-adjusted fallback, and only the display face is preloaded, since
the hero headline is the one piece of text worth the bytes. A shop whose theme
picks `soft-rounded` or `mono-utility` fetches neither file and stays on device
fonts entirely.

Fraunces stands in for Recoleta, which is a commercial licence (Latinotype)
this repository cannot vendor. It is not a compromise — its SOFT axis gives the
same rounded terminals that make Recoleta read warm rather than literary — and
swapping the real thing in is one `src` in `app/fonts.ts`, which is the only
file that names a font file.

**Derived colour is computed, not `color-mix`ed.** Muted text, hairlines and the
accent wash come out of the same arithmetic the ingester and the validator use,
so `--on-accent` clearing 4.5:1 is something a test can check rather than
something the browser decides at paint time.

**Rounded, soft, warm.** Pills for every control, 14–26px plates, a gentle
gradient in the plate tint so a white cut-out has something to sit on, and wide
low-opacity shadows built on the scrim so the same rule works on a dark page.
The hero CTA is a pale tint of the accent carrying the accent's own hue in the
label rather than a saturated block — over a photograph a solid button competes
with the product for the only colour attention the frame has. `--accent-ink` is
solved for 4.5:1 on that tint, walking the accent towards the text colour a
step at a time so a green brand keeps a green label instead of getting a black
one.

**One well-orchestrated page load.** Staggered reveals driven by `--i` per
block, a scroll-snap carousel, and nothing else moving — all of it off under
`prefers-reduced-motion`. The single client component on the page is the
press-to-copy discount chip, which earns it: a code exists to be typed into a
checkout on another site, and selecting one accurately on a phone is the only
genuinely fiddly interaction a mini-shop has.

### What the brand board specifies that a generated shop does not get

The board's shop mockups carry four things this renderer will not draw, each
for the same reason:

| On the board | Why it is not on the page |
|---|---|
| Star ratings and review counts — `(128)`, `(96)`, `(77)` | No review data is ingestable from a public storefront yet, and a rating nobody read is the same fabrication as a price nobody read |
| A testimonial with an avatar and a quote | Same — there is no source for it |
| A cart icon with an item badge | There is no cart. Checkout is a permalink out to the merchant's own store (step 5) |
| A hamburger beside the wordmark | A mini-shop is one page, so it would open onto itself |

The ratings are the one worth coming back for, and they are closer than
"omit the block" suggests: Judge.me, Yotpo, Okendo and Stamped all expose public
aggregates, and the ingester already sees their widget scripts on the homepage.
A fifth rung on the catalogue ladder that reads a detected review app's public
API would make the board's product card shippable exactly as drawn, for the
stores that have one. Until then `reviews` renders nothing.

### popuup's own brand

`app/brand.css` holds the palette from the board — violet, pink, amber, teal,
ink and the warm off-whites — and `app/workbench.css` is the only thing that
uses it. A generated shop wears the *merchant's* colours; these never leak into
one. They live in their own file because step 4's free-tier badge is the one
thing that will cross over, and the badge and the app must not drift apart.

### The honesty rules, as tests

`tests/render-shop.test.tsx` renders the actual markup and asserts the things a
rendering bug could quietly break without any type failing:

| Assertion | Because |
|---|---|
| A sold-out product appears, marked | Hiding it tidies the page and loses the merchant the sale someone came back for |
| A product whose stock we never read says nothing | "In stock" is a claim nobody checked |
| Prices come from the catalogue, in its currency | The config carries no prices, so a shop opened in June shows June's |
| No "live", "real-time", "in sync", rating or review word anywhere | None of it is wired, and the merchant reads this page first |
| `reviews` and `capture` render nothing at all | No review data is ingestable; nothing receives an email address |
| A handle missing from the catalogue is dropped | A dead card is worse for the merchant than a shorter page |
| The dateline prints when — and only when — there is an ingest time | A snapshot is not a feed, and shoppers are owed the difference |

**No image optimiser.** `images: { unoptimized: true }` is deliberate: the
merchant's CDN already resizes when asked, and `/_next/image` would add a second
optimiser, a `remotePatterns` allowlist to widen per merchant, and a proxy hop
in front of a photo that was one request away.

**`.cache/shop/` is the storage seam.** `src/lib/render/store.ts` is the only
file in the renderer that knows where a shop lives, because step 4 replaces
exactly that with Supabase and a public URL. Everything above it takes a config
and a catalogue as arguments.

## 5. Publish

`ShopConfig` in; a URL somebody can put in their bio out.

```
publishShop({ config, ingest, genome })
  ├── stores          one row per storefront: catalogue + Genome, upserted
  ├── shops           a slug and a plan
  ├── shop_versions   one ShopConfig, appended — never overwritten
  └── /<slug>         served from the current version
```

**Catalogue lives on the store, not on the version.** Re-ingesting a merchant's
prices updates every shop built from that catalogue at once, which is the actual
mechanism behind "constantly live" — a sell-out reaches twenty published shops
without any of them being regenerated. What a version pins is the
*merchandising*, because that is what step 6's funnel events have to be
attributable to.

**Regenerating appends a version.** It costs a row and buys two things: a
merchant who regenerates and prefers the old shop has not lost it, and a funnel
event recorded against v1 is not silently reattributed to v3.

**The slug is the most public string this system produces.** It goes into an
Instagram bio and is copied into places nobody can edit, so shops live at the
root — `popuup.com/kelpandcotton`, not `/s/kelpandcotton`. The price of that is
`RESERVED_SLUGS`: Next matches static routes before dynamic ones, so a shop that
took a word the app later needed would simply stop resolving one day with no
error anywhere. The list is deliberately longer than the routes that exist.
Collisions count up (`-2`, `-3`) rather than randomising, because
`kelp-and-cotton-2` can be read down a phone and `kelp-and-cotton-f3a9` cannot.
A slug the merchant asks for is *refused* rather than corrected — publishing
"Summer Edit!" to `summer-edit` without saying so is how a bio link ends up
pointing somewhere they never agreed to.

**The Genome is unreachable from a public key, structurally.** It is stored on
the store row, and the only public read path is `get_published_shop`, a
`security definer` function whose return columns are the allowlist. `genome` is
not among them. `stores` has no select policy at all, so even a bug that asked
for it would be denied rather than served. The same rule holds in the types:
`PublishedShop` has no field for it.

**The badge is the marketing budget, so it is designed to be kept.** Free-tier
shops carry "Made with popuup" below the colophon — in the *merchant's* muted
palette rather than popuup's violet, because a badge someone resents is a badge
they remove the moment they can. The one piece of brand that survives the
translation is the violet on the double-u. It carries a per-shop UTM, since
"organic install rate from published-shop badges" is a number the brief commits
to and is otherwise unmeasurable. `badge` defaults to `true` in the renderer: a
caller that forgets to pass a plan ships the badge rather than quietly giving
the tier away.

**Supabase or the filesystem.** `createLocalStore` writes the same shapes to
`.cache/published/`, and it exists for a specific reason: the kill-test
generates thirty shops from public storefront data before any of those merchants
has an account, and standing up Postgres for that would be building step 5's
infrastructure to run the test that decides whether step 5 is worth building.

## 6. Provenance and the funnel

Provenance was finished by step 5: every version stores its prompt, its stated
audience and the whole `ShopConfig`, in columns rather than only inside a blob.
This step is the funnel.

```
view → product click → checkout start
  ├── Funnel.tsx     one `view` on mount, then one delegated click listener
  ├── /api/events    validates, resolves the slug server-side, always 204s
  ├── shop_events    keyed to the shop *version* that served the page
  └── pnpm funnel    the rates, per session
```

**The client says what happened, never where to file it.** A browser sends a
slug and a session id; the server resolves that slug to the shop and to the
version it is currently serving, and stamps the clock itself. `FunnelEventBody`
is `.strict()`, so a body carrying `shopId` or `versionId` is rejected rather
than trusted — otherwise the events table is writable by anyone with the URL.

**Rates are per session, not per event.** A shopper who taps four products has
converted once on the question the merchant is asking. Counting it four times is
how a funnel flatters itself into a number nobody can act on.

**Keyed to the version.** This is what step 5's append-only versions were for: a
regeneration does not reattribute yesterday's numbers to a shop nobody saw
yesterday, so `pnpm funnel` can show v2 against v1.

**Not tracking.** No cookie, no IP, no fingerprint, nothing cross-site. The
session id is random — not derived from anything about the person, which is a
distinction that has to be visible in the code that makes it — and lives in
`sessionStorage`, scoped to one tab on one origin and gone when it closes. Every
storage access is guarded, because a shop that failed to render in a private
window because analytics could not write would be unacceptable.

The one contextual thing recorded is *where the click came from*, coarsely:
`instagram`, not a URL. That is the layer the brief calls the honest moat, and
recording less than the browser offered is the point. A merchant's own
`utm_source` beats the referrer, because a tag is a statement of intent and
in-app browsers — most of this product's traffic — routinely send no referrer at
all.

### Checkout is a cart permalink, and sometimes it is not

`/cart/<variantId>:1`, on the merchant's own domain, optionally carrying the
offer code from their own brief. Shopify owns the money, the tax, the fraud
rules and the compliance. It lands on their cart, pre-filled — one tap from
checkout rather than the checkout itself, which is what the brief asks for and
what this claims.

A card only gets one when there is exactly one variant it could mean:

| Case | Destination | Because |
|---|---|---|
| One variant, in stock | Cart permalink | Nothing to choose |
| A variant the plan pinned | Cart permalink | The plan chose it and the card shows its price |
| Sizes, colours, strengths | Product page | Pre-filling the medium because it was first sends somebody to a checkout holding the wrong thing, and the shopper who does not notice is the expensive case |
| Sold out | Product page | A cart that cannot be filled is the most annoying possible dead end |
| Non-numeric variant id | Product page | A permalink built on a guess is a 404 where a purchase should be |

**The drawer stays shut.** Nothing here carries a weight, a variant assignment
or a score, and nothing reads these numbers back into a decision. Three event
types, closed — no properties bag, no custom events, which is how an events
table becomes an analytics product nobody asked for. `pnpm funnel` says so at
the bottom of its own output.

## Decisions worth knowing about

**Nothing is invented.** Every ingested field is either something the storefront
told us or an explicit admission that it didn't — currency stays `null` when
undeclared rather than defaulting to USD, and `availabilityKnown` separates
"sold out" from "we never found out".

**Sold-out products are kept.** Shown and marked, never hidden. Neither the
ingester nor the merchandiser filters them out unless the brief asked for
in-stock only.

**Money is decided by type, not endpoint.** `"24.00"` is decimal, `2400` is
minor units. Guessing by magnitude misprices everything over $100.

**robots.txt is honoured** — with `--no-robots` for a merchant who has connected
their own store. We generate shops from storefronts that haven't asked and then
DM their owners honestly about it; ignoring their crawl rules undercuts that.

**Colour comes from the theme's own naming.** A value declared as
`--color-accent` is the accent, and no amount of counting hexes beats being
told.

**Everything above `http.ts` and `provider.ts` is pure.** The tests inject a
fetch and a fake model client; none of them need a network, a browser or a key.

## Not built yet

Step 7 is **Stop.** OAuth sync, email capture, creator shops, billing,
word-editing and TikTok-URL input are Sprint 3, gated on the kill-test — five of
thirty merchants actively wanting their shop live. The `capture` block and the
`EditMove` set are both defined in `schema.ts` and both deliberately unbuilt.

PULSE is not in the drawer by accident either. The logs from step 6 are what it
would eventually learn from; until they hold enough real sessions, there are no
learned weights, no experimentation framework and no schema shaped for one.

**PULSE stays in the drawer.** No learned weights, no experimentation
framework, no schema shaped for a learning system that does not exist. The
Genome is heuristics plus one model pass, and the diagnostics on it are
descriptive — nothing reads them back into a decision.

## Verification status

308 unit and integration tests pass against fixtures, and the whole pipeline has
been run end to end against a local storefront: `pnpm generate` through all six
steps, republishing to v2, a custom slug, a 404 on an unknown one, and the badge
with its UTM. The funnel was verified by driving three real browser sessions
through a published shop — one arriving with an Instagram referrer, one direct,
one from TikTok — and reading the result back with `pnpm funnel`, which
attributed the sources, the per-session rates and the per-product breakdown
correctly. The renderer has been reviewed at 390×844 and 1280×900 across all
five moods.

The design review used a purpose-built fake store whose photography is
deliberately bad in seven different ways — landscape studio shot, floating white
cut-out, underexposed, extremely wide, busy phone snap, blown highlights, a
200×200 thumbnail, and one product with no image at all — because "must flatter
mediocre product photography" is not a claim a catalogue of clean shots can
test.

Three things have **not** been verified, all because this environment's egress
proxy blocks them:

- **No real catalogue has been ingested.** Storefront hosts are refused at the
  proxy with a policy denial. Running against four real stores, one with poor
  photography, is the first thing to do next; the ingest trace exists for that
  session.
- **No real merchandising or Genome call has been made.** `api.anthropic.com`
  answers but no credential is configured here, so both Anthropic providers have
  only been exercised against a faked SDK client — request shape, refusal,
  truncation and the retry loop are covered; the actual quality of the
  merchandising and of the relationship graph is not. The Genome's heuristic
  half *has* been verified against the fixture catalogue: it correctly finds the
  200×200 thumbnail and the product with no image, and spreads eight products
  across all four price tiers.
- **No Supabase project has been touched.** `supabase.com` is refused at the
  proxy and no credentials are configured, so `supabase.ts` has been typechecked
  against the real client and run against nothing, and `schema.sql` has never
  been applied. The `ShopStore` interface it implements is covered by tests
  through the local adapter, so what is unverified is narrow but real: whether
  those queries and those RLS policies are right. Applying the migration to a
  fresh project and running `pnpm generate` against it is the first thing to do
  next, and the RLS check worth doing by hand is that an anon key can read a
  published shop and cannot read `stores.genome`.
