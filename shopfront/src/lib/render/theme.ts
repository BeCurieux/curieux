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
 * Fonts that are already on the device.
 *
 * A bio-link shop is opened on a phone, on mobile data, from an app's in-app
 * browser. A webfont there costs a round trip before the first word is
 * readable, and the first word is most of what we have. So these stacks lead
 * with genuinely characterful faces that ship on real devices — Hoefler Text
 * and Iowan Old Style are lovely, `ui-rounded` maps to SF Rounded — and only
 * bottom out in a generic.
 *
 * The seam for a self-hosted variable font is exactly here: replace the head
 * of a stack and nothing else changes.
 */
const FONTS = {
  "editorial-serif": {
    display: `"Hoefler Text", "Iowan Old Style", "Apple Garamond", Baskerville, "Times New Roman", serif`,
    body: `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`,
  },
  "modern-sans": {
    display: `"Avenir Next", Avenir, "Futura", "Century Gothic", "Segoe UI", "Helvetica Neue", sans-serif`,
    body: `"Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, sans-serif`,
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

const RADIUS = {
  none: { plate: "0px", control: "0px" },
  soft: { plate: "4px", control: "6px" },
  round: { plate: "20px", control: "999px" },
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

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
