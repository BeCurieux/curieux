/**
 * The wordmark, drawn rather than set.
 *
 * One skeleton for every letter: x-height 104, stroke 26, bowl radius 39 on
 * the centreline, letters on a 120 advance. Drawing it as stroked paths rather
 * than converting outlines keeps the file legible, puts the colour split on
 * letter boundaries instead of inside a path nobody can edit, and lets the
 * rays be positioned against the second u by arithmetic.
 *
 * The one rule: caps are round and centred, so a letter's ink runs from its
 * origin to origin + 104 exactly. Break that and the letterspacing stops being
 * even.
 *
 * It takes its two colours because it has to survive two different jobs. On
 * white it is the brand's own navy and violet. On a poster whose ground is
 * near-black, that navy is invisible, so the dark letters take the poster's
 * ink and only the double-u keeps the violet — the same trade the in-page
 * badge makes for the same reason.
 */

export const BRAND_INK = "#130A3D";
export const BRAND_ACCENT_FROM = "#5B23F5";
export const BRAND_ACCENT_TO = "#8341F5";

/** Wide enough for the descenders and the rays, so nothing clips. */
export const VIEWBOX = "-8 -78 720 250";

export function wordmark({ ink = BRAND_INK, accent, id = "uu" } = {}) {
  // A flat accent draws flat; the brand file wants the gradient it ships with.
  const gradient = !accent;
  const stroke = gradient ? `url(#${id})` : accent;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-label="popuup">
  <title>popuup</title>
  ${gradient ? `<defs>
    <linearGradient id="${id}" x1="360" y1="0" x2="584" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${BRAND_ACCENT_FROM}"/>
      <stop offset="1" stop-color="${BRAND_ACCENT_TO}"/>
    </linearGradient>
  </defs>` : ""}
  <g fill="none" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="${ink}">
      <path d="M13 13V143"/><circle cx="52" cy="52" r="39"/>
      <circle cx="172" cy="52" r="39"/>
      <path d="M253 13V143"/><circle cx="292" cy="52" r="39"/>
      <path d="M613 13V143"/><circle cx="652" cy="52" r="39"/>
    </g>
    <g stroke="${stroke}">
      <path d="M373 13v39a39 39 0 0 0 78 0V13"/>
      <path d="M493 13v39a39 39 0 0 0 78 0V13"/>
    </g>
    <!-- The rays, over the second u: the same three strokes the in-page badge
         draws, at four times the size and thinner in proportion, because at
         wordmark scale the badge's ratio reads as a fourth letter. -->
    <g stroke="${gradient ? BRAND_ACCENT_TO : accent}" stroke-width="17">
      <path d="M532 -28v-32"/><path d="M498 -22l-9-18"/><path d="M566 -22l9-18"/>
    </g>
  </g>
</svg>`;
}
