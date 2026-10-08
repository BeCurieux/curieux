# CLAUDE.md — Reelkit

Read README.md first. These are the rules that must not be broken.

## The rule

**An ad says only what the seller's listing says.** The model drafts; `check.ts`
decides. Any number or claim word not in the listing sends that ad back to a
template. Do not loosen the check to let a better-reading draft through: a
fabricated "handmade" or "best-seller" is the seller's legal and platform
problem, created by us. Add claim words to `CLAIM_WORDS` freely; removing one
needs a reason in the commit.

## Boundaries

- `src/product/fetch.ts` is the only network code in the importer, and every
  fetch, redirects included, goes through `assertPublicUrl`. The image proxy
  only serves URLs it signed, and never SVG.
- `src/script/claude.ts` is the only file that imports the Anthropic SDK.
  Without a key, everything still works on templates.
- Rendering is pure above `encode.ts`. The preview and the encoder both draw
  from `buildTimeline` + `drawFrame`, so what the seller previews is what
  they download. Don't fork them.
- Videos are encoded in the browser. Moving encoding to a server is a cost
  decision for the owner, not a refactor.
- Tests run offline with injected transports. Never add a test that needs a
  real store to be up.

## Stack

TypeScript, Next.js (App Router, `--webpack` builds because of `.js` import
specifiers), zod, `@anthropic-ai/sdk`, `mediabunny`, Vercel. No other services
without asking the owner.
