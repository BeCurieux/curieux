# Demo photography

Drop product photographs in here and the demo shops use them instead of the
drawings:

```
pnpm press               # catalogues, the five mood shops, their screenshots
pnpm press:edits         # the five front-page shops, re-merchandised
pnpm press:capture-edits # and their screenshots
pnpm tsx scripts/demo-fixtures.ts   # freeze them so a fresh checkout has them
```

Three commands rather than one, and the reason is worth knowing: `pnpm press`
rebuilds the *mood* shops — one brand each, five templates — which is where the
hero image comes from. The five phones under "One catalogue. Five shops." are a
different and stronger claim, one catalogue against five sentences, and they go
through the real merchandiser. `press:edits` needs `POPUUP_ANTHROPIC_API_KEY`
and `AI_PROVIDER=anthropic`.

**The merchandiser is not deterministic.** Re-running it against the same
catalogue and the same five sentences returned four products for the negroni
kit on one run and five on another. That is a model making a judgement and it
is fine — but `src/app/page.tsx` types those counts by hand next to each phone,
so a regeneration can turn "4 pieces" into a lie. `tests/marketing.test.tsx`
checks every label against its fixture, so this fails loudly rather than
shipping. Update the `n` values when it does.

## Why this folder exists

The demo shops currently render **drawn SVG shapes** where the products should
be. That was never a design decision. This repository is developed in an
environment with no outbound network — it cannot reach a storefront, a CDN or a
stock library — so the pipeline needed something to render and a drawn shape
was all that was available.

The cost is real and it lands in the worst place. The five phones on the front
page are genuine screenshots of the real template, so the layout, the product
selection, the ordering and the copy are all true output. But the goods inside
them are yellow blobs, and a merchant decides whether their own shop will look
good from exactly those five images.

## Naming

```
public/demo/<brand-key>/<handle>.<ext>
```

`.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` all work, checked in that order.
Anything without a matching file falls back to the drawing, so a half-finished
set is fine — it degrades one product at a time rather than all at once.

The brand keys and handles are in `scripts/press/shops.mjs`. For example:

```
public/demo/maison-verre/coupe.jpg
public/demo/maison-verre/wine-glass.jpg
public/demo/bench-and-bolt/framing-hammer.jpg
```

## What to shoot

Portrait, 4:5, at least 1200×1500. The renderer crops to that ratio, so a
landscape shot loses its edges.

**Include two or three deliberately mediocre ones.** This is not a joke and it
is not lowered standards. The brief asks the renderer to "flatter mediocre
product photography", because that is what most merchants actually have — and a
demo of eight perfect studio cut-outs tests the easiest case eight times and
proves nothing. `tests/visual/fixture-store.ts` already models seven kinds of
wrong on purpose: landscape when the grid wants portrait, a white cut-out with
no ground, underexposed, extremely wide, a busy phone snap, blown highlights,
and a 200px thumbnail.

Leave at least one product with no photograph at all. The renderer has a
considered answer for that — the initial set large in the display face — and it
should be visible in the demo rather than only in a test.

## Rights

Whatever goes in here ends up on the public marketing site, so it needs a
licence that covers commercial use with no attribution requirement, and one
that survives the photographer's relationship with you ending.

Nothing in here may imply a real customer or merchant. A commissioned or
stock lifestyle shot is fine; the same shot captioned as somebody's store
would fail `tests/marketing.test.tsx`, correctly.
