/**
 * The two faces from the brand board, self-hosted.
 *
 * This reverses an earlier decision, deliberately. The renderer originally ran
 * on device fonts alone, on the argument that a bio-link shop is opened on
 * mobile data from an app's in-app browser and a webfont costs a round trip
 * before the first word is readable. That argument is still true; it just does
 * not outrank a brand. So the cost is paid properly rather than avoided:
 *
 * - Self-hosted from npm, not Google Fonts. No third-party connection, no DNS
 *   hop, no request to a stranger's CDN carrying a shopper's IP.
 * - Latin subset, variable, woff2. Fraunces is 62KB across its whole weight
 *   and softness range; Space Grotesk is 22KB across 300-700. Two files, not
 *   the eight a static family would need.
 * - `swap` with a metric-adjusted fallback, so the first paint is readable and
 *   the swap does not move the layout under a thumb that is already scrolling.
 * - Only the display face is preloaded. It sets the hero headline, which is
 *   the one piece of text worth a preload; body copy swaps in behind it
 *   without anybody noticing.
 *
 * A shop whose theme picks `soft-rounded` or `mono-utility` pulls neither
 * file — the browser only fetches a family something on the page actually
 * uses, so those shops stay on device fonts and cost nothing.
 */

import localFont from "next/font/local";

/**
 * Standing in for Recoleta.
 *
 * Recoleta is a commercial licence (Latinotype) and is not something this
 * repository can vendor. Fraunces is the closest thing under an open licence
 * and is not a compromise: its SOFT axis gives the same rounded terminals that
 * make Recoleta read as warm rather than literary, and the file here is the
 * wght+SOFT variable cut so that axis is actually available.
 *
 * Swapping in the real thing is this one block: drop the woff2 in, change the
 * `src`. Nothing else in the codebase names a font file.
 */
export const display = localFont({
  src: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2",
  variable: "--font-brand-display",
  display: "swap",
  weight: "100 900",
  fallback: ["Hoefler Text", "Iowan Old Style", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
  preload: true,
});

/**
 * The same family with the rest of its axes.
 *
 * Fraunces ships WONK (alternate letterforms) and a wider optical size range
 * in a bigger file. A shop does not need them — a merchant's headline wants to
 * read, not to perform — but popuup's own front door does, and it is the one
 * place the brand gets to be loud. Scoped to the landing page so no shopper
 * ever downloads it.
 */
export const displayWonk = localFont({
  src: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2",
  variable: "--font-brand-wonk",
  display: "swap",
  weight: "100 900",
  fallback: ["Hoefler Text", "Iowan Old Style", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
  preload: true,
});

export const sans = localFont({
  src: "../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-brand-sans",
  display: "swap",
  weight: "300 700",
  fallback: ["Avenir Next", "Segoe UI", "Helvetica Neue", "Helvetica", "sans-serif"],
  adjustFontFallback: "Arial",
  preload: false,
});
