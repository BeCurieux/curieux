/**
 * `ThemeTokens` -> CSS custom properties.
 *
 * The model picks five tokens. This turns them into forty variables, and that
 * asymmetry is the whole design system: the model makes a small number of
 * decisions it can actually reason about, and every consequence of those
 * decisions is worked out here, once, by hand.
 *
 * Two things follow from that. Mood has to *mean* something — if `luxe` and
 * `playful` differ only by a corner radius, the token was decoration and the
 * shops all look the same. And every derived colour is computed rather than
 * left to CSS `color-mix`, so the contrast maths that decides whether a label
 * is readable is the same arithmetic the ingester and the validator use.
 */

import { contrastRatio, mix, parseColour, toHex, type Rgb } from "@/lib/ingest/colour";
import { ThemeTokens as ThemeTokensSchema } from "@/lib/schema";
import type { z } from "zod";

type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

/**
 * The type stacks.
 *
 * Two of these lead with the brand's own faces, loaded in `app/fonts.ts`:
 * a warm editorial serif for display and Space Grotesk underneath it. The
 * pairing is the board's — a serif that carries the headline and a clean sans
 * that carries everything a shopper has to actually read at 14px, which is a
 * better division of labour than the serif-on-serif this used to be.
 *
 * Every stack still ends in a device font, and that is load-bearing rather
 * than tidy: the brand faces arrive with `font-display: swap`, so what these
 * tails name is what a shopper reads for the first few hundred milliseconds.
 * A stack that bottomed out in `serif` would hand that moment to whatever
 * Times variant the phone happens to ship.
 *
 * `soft-rounded` and `mono-utility` are deliberately still device-only. A shop
 * that picks either is not wearing the brand's face anyway, and the browser
 * never fetches a family the page does not use — so those shops load no fonts
 * at all.
 */
const FONTS = {
  "editorial-serif": {
    display: `var(--font-brand-display), "Hoefler Text", "Iowan Old Style", Baskerville, Georgia, serif`,
    body: `var(--font-brand-sans), "Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, sans-serif`,
  },
  "modern-sans": {
    display: `var(--font-brand-sans), "Avenir Next", Avenir, "Futura", "Segoe UI", "Helvetica Neue", sans-serif`,
    body: `var(--font-brand-sans), "Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, sans-serif`,
  },
  "soft-rounded": {
    display: `ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Varela Round", "Trebuchet MS", sans-serif`,
    body: `ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Trebuchet MS", sans-serif`,
  },
  "mono-utility": {
    display: `ui-monospace, "SF Mono", "JetBrains Mono", "IBM Plex Mono", Menlo, monospace`,
    body: `ui-monospace, "SF Mono", "IBM Plex Mono", Menlo, Consolas, monospace`,
  },
} satisfies Record<ThemeTokens["typography"], { display: string; body: string }>;

/** How much air. Multiplies the whole spacing scale. */
const DENSITY = { airy: 1.3, regular: 1, compact: 0.78 } satisfies Record<ThemeTokens["density"], number>;

/**
 * "Rounded everything," says the board, and it is right — softness is most of
 * what separates this from a theme. So `soft` is genuinely soft rather than the
 * 4px that reads as an accident of rendering, and controls are pills at every
 * setting above `none`. `none` stays a true square: a merchant whose brand is
 * hard edges gets hard edges, and that is what the token is for.
 */
const RADIUS = {
  none: { plate: "0px", control: "0px" },
  soft: { plate: "14px", control: "999px" },
  round: { plate: "26px", control: "999px" },
} satisfies Record<ThemeTokens["cornerRadius"], { plate: string; control: string }>;

/**
 * What each mood actually changes.
 *
 * `plateRatio` is the one that matters most: every product photograph on the
 * page is cropped to it, and a single ratio is what turns a pile of
 * mismatched supplier shots into something that looks art-directed.
 */
export interface MoodShape {
  /** aspect-ratio for every image plate. */
  plateRatio: string;
  /** The hero runs to the edges of the screen rather than sitting in the margin. */
  heroFullBleed: boolean;
  /** vh the hero occupies on a phone. */
  heroHeight: number;
  eyebrowCase: "uppercase" | "none";
  eyebrowTracking: string;
  eyebrowFont: "display" | "body" | "mono";
  ruleWeight: string;
  /** Multiplies the display type scale. */
  displayScale: number;
  displayTracking: string;
  displayWeight: number;
}

const MOOD = {
  clean: {
    plateRatio: "4 / 5",
    heroFullBleed: false,
    heroHeight: 58,
    eyebrowCase: "uppercase",
    eyebrowTracking: "0.1em",
    eyebrowFont: "body",
    ruleWeight: "1px",
    displayScale: 1,
    displayTracking: "-0.01em",
    displayWeight: 500,
  },
  editorial: {
    plateRatio: "4 / 5",
    heroFullBleed: true,
    heroHeight: 74,
    eyebrowCase: "none",
    eyebrowTracking: "0.02em",
    eyebrowFont: "display",
    ruleWeight: "1px",
    displayScale: 1.12,
    displayTracking: "-0.025em",
    displayWeight: 400,
  },
  playful: {
    plateRatio: "1 / 1",
    heroFullBleed: true,
    heroHeight: 66,
    eyebrowCase: "none",
    eyebrowTracking: "0",
    eyebrowFont: "display",
    ruleWeight: "2px",
    displayScale: 1.08,
    displayTracking: "-0.015em",
    displayWeight: 700,
  },
  luxe: {
    plateRatio: "4 / 5",
    heroFullBleed: true,
    heroHeight: 82,
    eyebrowCase: "uppercase",
    eyebrowTracking: "0.24em",
    eyebrowFont: "body",
    ruleWeight: "0.5px",
    displayScale: 1.04,
    displayTracking: "0.01em",
    displayWeight: 300,
  },
  utility: {
    plateRatio: "1 / 1",
    heroFullBleed: false,
    heroHeight: 46,
    eyebrowCase: "uppercase",
    eyebrowTracking: "0.08em",
    eyebrowFont: "mono",
    ruleWeight: "1px",
    displayScale: 0.92,
    displayTracking: "-0.005em",
    displayWeight: 600,
  },
} satisfies Record<ThemeTokens["mood"], MoodShape>;

export interface RenderTheme {
  /** Inline `style` for the shop root. */
  variables: Record<string, string>;
  shape: MoodShape;
  /** True when the page is light-on-dark; a few components need to know. */
  dark: boolean;
}

export function buildTheme(tokens: ThemeTokens): RenderTheme {
  const shape = MOOD[tokens.mood];
  const fonts = FONTS[tokens.typography];
  const radius = RADIUS[tokens.cornerRadius];
  const step = DENSITY[tokens.density];

  // Anything unparseable is the validator's job to have caught; falling back
  // rather than throwing means a bad token degrades to a plain page instead of
  // a blank one.
  const bg = parseColour(tokens.colorway.background) ?? { r: 255, g: 255, b: 255 };
  const text = parseColour(tokens.colorway.text) ?? { r: 17, g: 17, b: 17 };
  const surface = parseColour(tokens.colorway.surface) ?? mix(bg, text, 0.05);
  const accent = parseColour(tokens.colorway.accent) ?? text;
  const dark = contrastRatio(bg, { r: 255, g: 255, b: 255 }) > contrastRatio(bg, { r: 0, g: 0, b: 0 });
  const accentSoft = mix(accent, bg, 0.8);

  return {
    dark,
    shape,
    variables: {
      "--bg": toHex(bg),
      "--surface": toHex(surface),
      "--text": toHex(text),
      "--accent": toHex(accent),

      // Derived tones. `soft` is for supporting copy, `faint` for metadata,
      // `line` for hairlines — all mixed towards the background so they sit in
      // the same family rather than reading as a second grey.
      "--text-soft": toHex(mix(text, bg, 0.32)),
      "--text-faint": toHex(mix(text, bg, 0.55)),
      "--line": toHex(mix(text, bg, 0.82)),
      "--line-strong": toHex(mix(text, bg, 0.62)),
      "--on-accent": toHex(readableOn(accent)),
      // Always black. A scrim exists to make white type readable over an
      // unknown photograph, and that is true whichever way the page is lit.
      "--scrim": "0, 0, 0",

      // A tint of the accent, for bands and hovers that should not shout.
      "--accent-wash": toHex(mix(accent, bg, 0.88)),
      // The stronger tint the soft controls sit on, and a colour that can
      // actually be read on it. A pale pill with the accent's own hue in the
      // label is the whole look; it only works if the label clears 4.5:1, and
      // an accent that is already pale cannot carry its own label.
      "--accent-soft": toHex(accentSoft),
      "--accent-ink": toHex(readableInk(accent, accentSoft, text)),

      // Soft, wide, and barely there. Built on the scrim so the same rule
      // works on a dark page, where a black shadow is invisible and a heavy
      // one looks like a bug.
      "--shadow": `0 1px 2px rgb(var(--scrim) / 0.04), 0 10px 28px -14px rgb(var(--scrim) / 0.18)`,
      "--shadow-lift": `0 2px 6px rgb(var(--scrim) / 0.06), 0 22px 48px -20px rgb(var(--scrim) / 0.26)`,

      "--font-display": fonts.display,
      "--font-body": fonts.body,
      "--font-mono": FONTS["mono-utility"].body,

      "--space-1": `${round(4 * step)}px`,
      "--space-2": `${round(8 * step)}px`,
      "--space-3": `${round(14 * step)}px`,
      "--space-4": `${round(22 * step)}px`,
      "--space-5": `${round(34 * step)}px`,
      "--space-6": `${round(54 * step)}px`,
      "--space-7": `${round(84 * step)}px`,
      "--gutter": `${round(20 * step)}px`,

      "--radius-plate": radius.plate,
      "--radius-control": radius.control,

      "--plate-ratio": shape.plateRatio,
      "--hero-height": `${shape.heroHeight}svh`,
      "--rule": shape.ruleWeight,

      "--eyebrow-case": shape.eyebrowCase,
      "--eyebrow-tracking": shape.eyebrowTracking,
      "--eyebrow-font":
        shape.eyebrowFont === "mono"
          ? "var(--font-mono)"
          : shape.eyebrowFont === "display"
            ? "var(--font-display)"
            : "var(--font-body)",

      "--display-scale": String(shape.displayScale),
      "--display-tracking": shape.displayTracking,
      "--display-weight": String(shape.displayWeight),
    },
  };
}

/** Black or white on this colour, whichever a reader can actually see. */
function readableOn(colour: Rgb): Rgb {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 17, g: 17, b: 17 };
  return contrastRatio(colour, white) >= contrastRatio(colour, black) ? white : black;
}

/**
 * The accent's own hue, dark enough to read on its own pale tint.
 *
 * Walked towards the page's text colour in small steps rather than jumped to
 * it, so a green brand keeps a green label instead of getting a black one. If
 * even the text colour cannot clear 4.5:1 on that tint — a page whose text and
 * accent are both pale — the text colour is still the best available answer,
 * and the caller gets a readable label rather than a pretty unreadable one.
 */
function readableInk(accent: Rgb, on: Rgb, text: Rgb): Rgb {
  for (let step = 0; step <= 10; step++) {
    const candidate = mix(accent, text, step / 10);
    if (contrastRatio(candidate, on) >= 4.5) return candidate;
  }
  return text;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
