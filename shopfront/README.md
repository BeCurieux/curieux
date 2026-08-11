# Shopfront

Make a shop in a sentence. See `BRIEF.md` for what this is and `CLAUDE.md` for
the rules that must never be violated.

**Built so far: steps 1 and 2 of the build order — the ingester and the
merchandiser.**

```
pnpm install
pnpm ingest kelpandcotton.com                              # store URL -> catalogue + brand
pnpm merchandise kelpandcotton.com "a clean bio shop for the knitwear post"
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

Steps 3-5: renderer, publish, funnel events. There is no Next.js app in this
package yet — it arrives with the renderer, and `src/lib` is where it will sit.
`pnpm generate` is the definition of done for Sprints 1-2 and ends in a
published URL, so it does not exist; `pnpm ingest` and `pnpm merchandise` are
its first two thirds.

## Verification status

173 unit and integration tests pass against fixtures, and both CLIs have been
run end to end against a local storefront.

Two things have **not** been verified, both because this environment's egress
proxy blocks them:

- **No real catalogue has been ingested.** Storefront hosts are refused at the
  proxy. Running against four real stores, one with poor photography, is the
  first thing to do next; the ingest trace exists for that session.
- **No real merchandising call has been made.** `api.anthropic.com` answers but
  no credential is configured here, so the Anthropic provider has only been
  exercised against a faked SDK client — request shape, refusal, truncation and
  the retry loop are covered; the actual quality of the merchandising is not.
