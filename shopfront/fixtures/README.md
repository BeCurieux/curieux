# fixtures

One ingested catalogue, committed on purpose, against the rule in `.gitignore`
that keeps ingested catalogues out of the repository.

That rule is about **merchants**: "real data about real shops — it does not
belong in the repository." It exists so that iterating on the merchandiser
never means keeping a copy of somebody's live storefront in version control.

`bench-and-bolt.ingest.json` is not that. It is a Shopify development store —
ten hardware products on a `.myshopify.com` subdomain, selling to nobody. The
shops generated from it are already in the repository as screenshots under
`public/press/`, so its *output* was committed long before its input was.

## Why it has to exist

No container this project runs in can reach a storefront. Egress is limited to
package registries and the Anthropic API, so a checkout on a build machine, in
CI, or inside a coding agent cannot run `pnpm ingest` against anything at all —
which means it cannot exercise the merchandiser either, on real or fake data.

That is the whole reason a catalogue is checked in: it is the difference
between "the merchandiser can be run anywhere" and "the merchandiser can only
be run on a laptop that happens to have a warm cache."

## Using it

```
cp fixtures/bench-and-bolt.ingest.json .cache/ingest/bench-and-bolt.myshopify.com.json
pnpm merchandise bench-and-bolt.myshopify.com "a starter kit for a first workshop"
```

`pnpm generate` will reuse that cache rather than crawling, so the rest of the
pipeline runs unchanged.

## What may be added here

Development stores and hand-written catalogues. Not a merchant's. If a real
storefront's data is ever needed for a test, bridge it locally with
`scripts/bridge-products.ts` and leave it in `.cache/`, where `.gitignore` has
always meant it to stay.

## `shops/` — the demo shops the marketing site points at

Ten `ShopRenderInput` files, committed for the same reason and against the same
rule. `/preview/<key>` serves each of them, and `/examples` links to all ten.

That page says of itself that every image links to the page it was taken from.
It was false everywhere except the machine that generated them: shops live in
`.cache/`, `.cache/` is gitignored, and a deployment is always a fresh
checkout. Six pages of careful honesty undone by a 404.

Every store here is `example.invalid` or `maisonverre.example` — reserved
names, selling to nobody, with hand-drawn SVG products. Their screenshots have
been in `public/press/` for weeks; this is the input that produced them.

Regenerate with:

```
pnpm tsx scripts/demo-fixtures.ts
```

It refuses any store that is not a reserved example domain, and
`tests/marketing.test.tsx` asserts the same thing from the other side — so a
real merchant's catalogue cannot be frozen in here by accident.
