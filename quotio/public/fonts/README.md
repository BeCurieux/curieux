# Bricolage Grotesque

Self-hosted rather than loaded from Google Fonts, for three reasons:

1. **No third-party request.** The widget runtime ships on other people's
   sites. A font fetched from a CDN would hand every one of their visitors'
   IP addresses to a third party — which sits badly next to what the docs
   page promises about what a visitor's browser talks to.
2. **It can't fail separately from the app.** A blocked or slow CDN meant a
   flash of fallback type on every page, including inside a customer's embed.
3. **One request, not three.** No `preconnect` pair, no CSS round-trip before
   the font file is even discovered.

Two subsets of the variable font (weight 400–800, optical size 12–96):

| File | Covers |
| --- | --- |
| `bricolage-grotesque-latin.woff2` | Latin |
| `bricolage-grotesque-latin-ext.woff2` | Latin Extended |

Vietnamese is deliberately left out. Add the file here and a matching
`@font-face` in `src/app/globals.css` if it is ever needed.

Licensed under the SIL Open Font License 1.1 — see `OFL.txt`. Copyright 2022
The Bricolage Grotesque Project Authors,
https://github.com/ateliertriay/bricolage
