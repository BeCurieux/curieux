/**
 * The design system, in one file, as strings.
 *
 * The brief asks for gallery-grade: generous whitespace, one expressive serif,
 * a soft-neutral palette with a single confident accent, and a score rendered
 * as a beautiful object. What follows is that, plus one decision the brief
 * implies without stating.
 *
 * **No traffic lights.** Not red for high severity, not green for a pass. Red,
 * amber and green are the visual grammar of an audit tool, and this product's
 * whole position is that it is not one. Severity is carried by a ruled mark
 * and by typographic weight; the single accent is spent on the words the scan
 * is talking about, and on the one pointer saying which market the headline
 * score came from. Nothing else gets it. A page with nothing found is not
 * green — it is quiet.
 *
 * The ground is a violet-tinted near-black rather than white.
 *
 * `inkFaint` is set by contrast rather than by taste: it carries 9px mono
 * labels, and the value that looked right sat at 3.82:1, which is below the
 * 4.5:1 small-text threshold. It is 4.94:1 now. A card nobody can read the
 * dates on is not a nicer card. The artefact is going to be
 * screenshotted into a feed beside somebody's product photography, and white
 * reads as a dialog box — but so, it turned out, does warm paper at thumbnail
 * size, where the texture that carries it disappears. Ink on a dark ground
 * survives the shrink, and it is what the mark looks like at eleven at night,
 * which is when founders actually read their messages.
 *
 * The badge does not follow. It renders on a merchant's own product page,
 * which is somebody else's design and usually light — see `BADGE_PALETTE`.
 */

/**
 * The product's name, and the masthead default.
 *
 * Chosen 2026-08-18, resolving BRIEF.md §11 item 1. *Lingua franca* — the
 * common language — for a product about the language of claims. It matters
 * that it asserts nothing: the badge already says "Claims Verified", and a
 * name that also claimed truth would say it twice and widen the §9 exposure
 * that was read down once already.
 *
 * `--wordmark` still overrides it, because a name is cheaper to change before
 * thirty founders have seen it than after.
 */
export const WORDMARK = "Franca";

export const PALETTE = {
  paper: "#100D16",
  paperRaised: "#1A1623",
  ink: "#F4F0F7",
  inkSoft: "#A9A2B6",
  inkFaint: "#847E93",
  rule: "#302A3D",
  ruleFaint: "#211C2B",
  /** The one accent. Pink: the colour the reader follows, and the only hot
   *  thing on a cool page. Not alarm-red, and not a market. */
  accent: "#FF5CA8",
  /** The accent at wash strength, behind a flagged phrase. Dark enough to keep
   *  the copy readable through it — 13.5:1 for body ink — and saturated enough
   *  to survive a phone screenshot. */
  accentWash: "#3D1A2E",
} as const;

/**
 * The badge, and only the badge.
 *
 * Nothing here follows the reader's colour scheme, and the badge does not
 * follow the product's either. It renders inside a merchant's product page —
 * somebody else's design, usually light, occasionally dark, never ours to
 * predict. A mark that inverts depending on where it lands is a support
 * ticket, and a near-black rectangle dropped into a pale PDP is worse.
 *
 * So the mark keeps the warm paper the rest of the system moved off. It reads
 * as a stamp on the merchant's page rather than a window onto ours, which is
 * what a trust mark is supposed to be.
 */
export const BADGE_PALETTE = {
  paper: "#F4F1EA",
  paperRaised: "#FBF9F5",
  ink: "#17150F",
  inkSoft: "#5C564A",
  inkFaint: "#918A7A",
  rule: "#DCD5C6",
  ruleFaint: "#E9E4D9",
  accent: "#9E3B2A",
  accentWash: "#EBD2C4",
} as const;

/**
 * The mark for a dark product page, chosen by the merchant rather than by us.
 *
 * Not the page palette. A badge is a small object on somebody else's ground,
 * and the values that make a full page comfortable make a 320×78 stamp
 * disappear into a dark PDP: the near-black in `PALETTE` is darker than most
 * dark themes, so the mark would read as a hole. This ground is deliberately
 * *lighter* than the page's — it has to sit on top of a dark page, not match
 * it — and the rule is bright enough to draw the edge of the stamp.
 *
 * Same words, same layout, same forbidden list. A theme is a palette here and
 * nothing else, and `tests/badge.test.ts` asserts that by stripping the colour
 * from both and requiring the remainder to be identical.
 */
export const BADGE_NIGHT_PALETTE = {
  paper: "#1A1A18",
  paperRaised: "#222220",
  ink: "#F5F2EA",
  inkSoft: "#ABA69B",
  inkFaint: "#807A6F",
  rule: "#3C3A34",
  ruleFaint: "#2B2925",
  /**
   * The page's pink, and the only value here that follows it (owner's call,
   * 2026-08-18). It clears 5.58:1 on this ground. The paper mark deliberately
   * did **not** follow: the same pink measures 2.72:1 on its near-white
   * ground, so matching the two would have meant an invisible accent or a
   * second, darker pink — and the accent going grey is the live/lapsed signal,
   * which is worth more than the two grounds rhyming.
   */
  accent: "#FF5CA8",
  accentWash: "#3A1F14",
} as const;

/**
 * A hue per market, and the one place colour is allowed to multiply.
 *
 * Added 2026-08-18 on the owner's call — the card wanted more colour. What it
 * does **not** do is the thing CLAUDE.md forbids: no hue here tracks severity
 * or band. A market keeps its colour whether the finding under it is high or
 * low, and a page with nothing found shows the same three hues as a page with
 * seventeen findings. That is the difference between colour as identity and
 * colour as verdict, and only the second one turns this into an audit tool.
 *
 * Aqua, blue, purple: one arc of the wheel, containing no red, no amber and no
 * green, so nobody has to reason about whether a chip means "pass".
 *
 * The arc rotated cooler when the accent went pink (owner's call, 2026-08-18),
 * and that was the condition of the change rather than a side effect. Pink was
 * a market before it was the accent, and the one colour a reader is meant to
 * follow must never be mistakable for a label. So pink belongs to the accent
 * alone: every market is cool, the accent is the only hot thing on the page,
 * and no chip can be confused for a flagged phrase.
 */
export const MARKET_ACCENT: Record<string, string> = {
  AU: "#5FD4E8",
  EU: "#6FA8FF",
  US: "#B77DFF",
  GB: "#8FC4FF",
  CA_QC: "#D3A0FF",
};

/** The market's hue, or the muted ink for one we have no colour for. */
export function marketAccent(market: string): string {
  return MARKET_ACCENT[market] ?? PALETTE.inkSoft;
}

/** Which ground the mark is being dropped onto. The merchant's call. */
export type BadgeTheme = "paper" | "night";

export const BADGE_THEME = {
  paper: BADGE_PALETTE,
  night: BADGE_NIGHT_PALETTE,
} as const;

/**
 * Display is Instrument Serif — high contrast and tight, and at display size
 * it makes the score the object the brief asks for rather than a number in a
 * box. Text is Newsreader, drawn for reading, which matters because half this
 * page is somebody else's product copy set as a reading column. Mono is the
 * register the apparatus speaks in: rule ids, section numbers, pack versions.
 */
export const FONTS = {
  display: `"Instrument Serif", "Hoefler Text", Didot, Georgia, serif`,
  text: `"Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, serif`,
  mono: `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace`,
} as const;

export type EmbeddedFonts = {
  /** woff2 as a data: URI. Absent means the fallback stack, which is fine. */
  display?: string;
  text?: string;
};

/** `@font-face` for whichever faces the caller managed to inline. */
export function fontFaces(fonts: EmbeddedFonts | undefined): string {
  if (!fonts) return "";
  const faces: string[] = [];
  if (fonts.display) {
    faces.push(
      `@font-face{font-family:"Instrument Serif";font-style:normal;font-weight:400;` +
        `font-display:swap;src:url(${fonts.display}) format("woff2")}`,
    );
  }
  if (fonts.text) {
    faces.push(
      `@font-face{font-family:"Newsreader";font-style:normal;font-weight:200 800;` +
        `font-display:swap;src:url(${fonts.text}) format("woff2")}`,
    );
  }
  return faces.join("");
}

function vars(palette: typeof PALETTE | typeof BADGE_PALETTE): string {
  return Object.entries(palette)
    .map(([key, value]) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
    .join(";");
}

/** The custom properties, light by default and swapped under a dark scheme. */
export function paletteCss(): string {
  // One palette, no media query. The page does not follow the reader's scheme
  // any more: it is the artefact, and an artefact that looks different in
  // everybody's screenshot is not one. `color-scheme` tells the browser to
  // match its own furniture — scrollbars, form controls, the flash before CSS
  // lands — to a page it can no longer infer from the media query.
  return `html{color-scheme:dark}:root{${vars(PALETTE)}}`;
}

/**
 * Band words, in the product's voice rather than a grading voice.
 *
 * "Needs a rewrite" rather than "Fail". The difference is the whole brief: one
 * of them is a verdict on a brand and the other is a piece of work with an
 * obvious next step, which is the thing this product actually sells.
 */
export const BAND_LABEL = {
  clear: "Clear",
  review: "Worth a look",
  rework: "Needs a rewrite",
} as const;

const BAND_NOTE = {
  clear: "Nothing here draws attention reliably. The notes below are narrowings rather than problems.",
  review: "A few phrases here are worth revisiting before this copy goes further.",
  rework: "Several phrases here are the kind that draw attention.",
} as const;

/**
 * The line under the band, which has to be true and not merely reassuring.
 *
 * "Clear" and "nothing was found" are different states and the copy used to
 * conflate them: a page could score 96, carry one low-severity narrowing, and
 * be told nothing in it tripped a rule — with the note describing that rule
 * printed eight centimetres below. A product whose entire pitch is that it
 * reads language carefully cannot be careless in its own.
 */
export function bandNote(band: keyof typeof BAND_NOTE, findingCount: number): string {
  if (findingCount === 0) return "Nothing in this copy trips a rule in the markets checked.";
  return BAND_NOTE[band];
}

/** Severity as a ruled mark: three strokes, two, one. Never a colour. */
export const SEVERITY_MARK = { high: "▬▬▬", medium: "▬▬", low: "▬" } as const;

export const SEVERITY_LABEL = {
  high: "Draws attention reliably",
  medium: "Worth revisiting",
  low: "A narrowing, not a problem",
} as const;

export const MARKET_LABEL: Record<string, string> = {
  AU: "Australia",
  US: "United States",
  EU: "European Union",
  GB: "United Kingdom",
  CA_QC: "Quebec",
};

/** Long-form dates, in the one format that is unambiguous on both sides of
 *  the Atlantic. Taken as an argument everywhere rather than read from the
 *  clock, so a card renders identically in a test and in a year. */
export function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function monthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
