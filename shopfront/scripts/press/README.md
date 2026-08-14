# press

Social and press images, generated from the renderer rather than mocked up
beside it. Nothing in here is hand-drawn in a design tool, so a change to the
template — a new mood axis, a card-meta fix, a badge tweak — shows up in the
next set of posters without anybody redrawing anything.

The posters are loud on purpose. Each one shows the sentence somebody typed,
in a white field with a cursor after it, and the shop that came out of it. The
ground is popuup's violet rather than the merchant's colour, on every frame:
it makes the set read as one campaign, and it is the only ground the goods
reliably pop against. The display face is Fraunces with wght, SOFT and WONK
pushed together — heavy, rounded, slightly wrong, and the same roundness as
the wordmark.

Four steps, in order:

| step | what it does |
|---|---|
| `logo.mjs` | renders `wordmark.mjs` in brand colours → `public/brand/popuup.svg` |
| `shops.mjs` | five demo shops with drawn goods and saturated palettes → `.cache/shop/demo-*.json`, plus cutouts of the same goods → `.cache/press/` |
| `capture.mjs` | four phone frames per shop (fold, mid, grid, foot) at 390×845 ×3, plus a clip of the badge → `.cache/press/` |
| `compose.mjs` | posters: claim, typed prompt, device, loose goods → `.cache/press/out/` as PNG and JPEG |

```sh
pnpm dev          # in one terminal; capture.mjs reads a running server
pnpm press        # the four steps above
```

`PRESS_ORIGIN` overrides the server capture.mjs reads (default
`http://localhost:3000`).

Output, all in `.cache/press/out/`:

- `popuup-<mood>.jpg` — 1080×1350, one shop, feed
- `popuup-<mood>-story.jpg` — 1080×1920, the same shop, story
- `popuup-five-feed.jpg` / `-story.jpg` / `-wide.jpg` — all five as a deck,
  the third at 1600×900 for X
- `popuup-badge.jpg` — the free tier's badge, shown in place at the foot of a
  page and again as a clip of those same pixels

## What these may and may not say

The goods are illustrated. A real product photograph belongs to a real
merchant, and inventing one — or dressing a demo shop up as a store that
exists — would put a claim on a poster that nothing behind it can support.
The brands here are invented and read as invented.

The line of type above each device is the shop's own `meta.prompt`, read from
the config that produced the screenshot beneath it. If a poster's sentence and
its shop ever disagree, the poster is lying, and the fix is to regenerate
rather than to retype.

The badge poster shows the badge by cropping it out of a rendered page, not by
setting the words again — so it cannot advertise a badge the renderer does not
actually ship.
