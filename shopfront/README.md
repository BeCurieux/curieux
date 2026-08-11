# Shopfront

Make a shop in a sentence. See `BRIEF.md` for what this is and `CLAUDE.md` for
the rules that must never be violated.

**Built so far: step 1 of the build order — the ingester.**

```
pnpm install
pnpm ingest kelpandcotton.com          # summary to stderr, JSON to stdout
pnpm ingest kelpandcotton.com --out catalogue.json
pnpm test
pnpm typecheck
```

## What the ingester does

Store URL in; catalogue and brand context out, as `IngestResult`
(`src/lib/ingest/types.ts`). That type is the merchandiser's input in step 2,
in the same way `ShopConfig` (`src/lib/schema.ts`) is its output.

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

## Decisions worth knowing about

**Nothing is invented.** Every field is either something the storefront told us
or an explicit admission that it didn't. Currency stays `null` when undeclared
rather than defaulting to USD. A product with no readable variant is dropped
rather than priced at zero. `availabilityKnown` distinguishes "sold out" from
"we never found out". Reviews are always `available: false` in this step, with
the platform noted if one is detected — a `ReviewsBlock` in a ShopConfig built
from such an ingest would be claiming social proof nobody read.

**Sold-out products are kept.** They are shown and marked, never hidden. The
ingester cannot make that possible downstream if it filters them out here.

**Money is decided by type, not by endpoint.** `"24.00"` is decimal; `2400` is
minor units. Guessing by magnitude would misprice every product over $100.

**robots.txt is honoured** — with a `respectRobots: false` escape hatch, and a
`--no-robots` flag, for the case that arrives with OAuth. The kill-test has us
generating shops from storefronts whose owners have not asked us to and then
DMing them honestly about it; ignoring their crawl rules on the way would make
that first message a lie about our conduct rather than our product.

**Colour comes from the theme's own naming.** A value declared as
`--color-accent` is the brand's accent, and no amount of counting hexes beats
being told. Frequency is the fallback. The suggested colourway is
contrast-checked: text clears 4.5:1 against the background or it is replaced.

**Everything above `http.ts` is pure.** Tests inject a fetch; none of them
touch the network, and none of them need a browser.

## Not built yet

Steps 2-5 of the build order: merchandiser, renderer, publish, funnel events.
There is no Next.js app in this package yet — it arrives with the renderer in
step 3, and the `src/lib` layout is where it will sit. `pnpm generate` is the
definition of done for Sprints 1-2 and does not exist yet; `pnpm ingest` is its
first half, runnable on its own because the way this gets good is by pointing it
at real storefronts and reading what came back.

## Verification status

101 unit and integration tests pass against fixtures. **It has not yet been run
against a real catalogue** — the environment it was built in blocks outbound
connections to storefront hosts at the egress proxy. Running it against at
least four real stores, one of them with poor photography, is the first thing
to do next, and the trace output exists precisely for that session.
