# Reelkit

*Working name.* Paste an Etsy or Shopify product link, get three short video
ads (a scroll-stopper, a gift angle, a close-up on details) made from the
seller's own photos and words, ready for Reels, TikTok and Facebook.

## What works today

1. **Import.** Shopify product links on any domain (`/products/<handle>`) read
   the store's public `.json`, plus the page for the currency. Etsy listings
   use the Etsy Open API when `ETSY_API_KEY` is set; without it Etsy usually
   blocks the request and the seller gets the manual form. Any other product
   page is read from its JSON-LD and meta tags. Manual entry (type details,
   upload photos) always works.
2. **Write.** Three ad scripts: hook, 2–4 captions, call to action. Claude
   drafts them when `ANTHROPIC_API_KEY` is set; templates write them
   otherwise. Every draft is checked against the listing (`src/script/check.ts`)
   and replaced by a template if it mentions a number or a claim word
   ("handmade", "best-seller", "free shipping", …) the listing doesn't contain.
3. **Preview, edit, download.** Live canvas previews, editable copy, three
   shapes (9:16, 4:5, 1:1). Videos are encoded **in the seller's browser**
   (WebCodecs via `mediabunny`): H.264 MP4 in Chrome, Edge and Safari, VP9
   WebM as a fallback elsewhere. No server render cost, and uploaded photos
   never leave the device.

## Not yet

- Accounts, saved projects, credits and payments. The only spend control is a
  per-instance rate limit on the Claude endpoint (`src/server/limit.ts`).
- Voiceover and music: videos are silent. Needs a TTS provider decision.
- AI avatars and AI-generated clips (phase 2).
- Proving the seller owns the listing they import.

## Run it

```sh
pnpm install
cp .env.example .env.local   # all optional locally
pnpm dev                     # http://localhost:3000
pnpm test && pnpm typecheck
```

`pnpm smoke` drives a real browser through manual entry → ads → download
against a running server (see `scripts/e2e-smoke.ts`). It is not in CI,
because it needs a browser that can encode video.

## Configuration

| Variable | Needed | What happens without it |
|---|---|---|
| `IMAGE_PROXY_SECRET` | production | Throws on Vercel. Locally, a per-process secret is generated. |
| `ANTHROPIC_API_KEY` | no | Ads come from templates. |
| `ETSY_API_KEY` | no | Etsy links mostly fall back to manual entry. Register an app at developers.etsy.com and use `keystring:shared_secret`. |

## Layout

```
src/product/   link → Product. fetch.ts is the only file that touches the network;
               guard.ts refuses private addresses on every hop.
src/script/    Product → three AdScripts. claude.ts is the only file that calls a model.
src/render/    AdScript → frames (pure timeline, layout, draw) → video (encode.ts, browser only).
src/server/    request handlers with injected dependencies; routes in src/app/api are one line.
src/app/       the single-page studio.
```
