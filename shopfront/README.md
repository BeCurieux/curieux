# Shopfront

Make a shop in a sentence. See `BRIEF.md` for what this is and `CLAUDE.md` for
the rules that must never be violated.

**Built so far: steps 1, 2 and 3 of the build order — the ingester, the
merchandiser and the renderer.**

```
pnpm install
pnpm ingest kelpandcotton.com                              # store URL -> catalogue + brand
pnpm merchandise kelpandcotton.com "a clean bio shop for the knitwear post" --render
pnpm dev                                                   # then open /preview/<store>
pnpm test
pnpm typecheck
```

`merchandise` reuses the cached ingest, so iterating on a prompt costs one
model call rather than a re-crawl of somebody else's storefront. It runs the
deterministic merchandiser by default; `AI_PROVIDER=anthropic` (or
`--provider anthropic`) uses the model.

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

## 2. The merchandiser

Catalogue + brand context + the merchant's prompt in; `ShopConfig` out.

```
merchandise(ingest, "nothing over £80, lead with the crew")
  ├── brief        brand, its own voice, its colours, a closed set of URLs, the catalogue
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

It is the test fixture, the renderer's input for step 3 without a model call per
reload, and the baseline. If the model's shop isn't obviously better than this,
the merchandising isn't earning its cost. It is **not** a fallback: if the API
is unreachable the run fails rather than quietly shipping a heuristic shop.

## 3. The renderer

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

Steps 4-5: publish and funnel events. `/preview/<key>` renders from a local
file; there is no public URL, no Supabase and no free-tier badge yet, and
nothing on the page records a view or a product click. `pnpm generate` is the
definition of done for Sprints 1-2 and ends in a published, shareable URL, so it
does not exist — `pnpm ingest`, `pnpm merchandise --render` and `pnpm dev` are
the first three quarters of it.

## Verification status

217 unit and integration tests pass against fixtures, all three stages have been
run end to end against a local storefront, and the renderer has been reviewed at
390×844 and 1280×900 across all five moods.

The design review used a purpose-built fake store whose photography is
deliberately bad in seven different ways — landscape studio shot, floating white
cut-out, underexposed, extremely wide, busy phone snap, blown highlights, a
200×200 thumbnail, and one product with no image at all — because "must flatter
mediocre product photography" is not a claim a catalogue of clean shots can
test.

Two things have **not** been verified, both because this environment's egress
proxy blocks them:

- **No real catalogue has been ingested.** Storefront hosts are refused at the
  proxy with a policy denial. Running against four real stores, one with poor
  photography, is the first thing to do next; the ingest trace exists for that
  session.
- **No real merchandising call has been made.** `api.anthropic.com` answers but
  no credential is configured here, so the Anthropic provider has only been
  exercised against a faked SDK client — request shape, refusal, truncation and
  the retry loop are covered; the actual quality of the merchandising is not.
