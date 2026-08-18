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
 * The ground is warm uncoated paper rather than white, because the artefact is
 * going to be screenshotted into a feed beside somebody's product photography,
 * and white reads as a dialog box.
 */

export const PALETTE = {
  paper: "#F4F1EA",
  paperRaised: "#FBF9F5",
  ink: "#17150F",
  inkSoft: "#5C564A",
  inkFaint: "#918A7A",
  rule: "#DCD5C6",
  ruleFaint: "#E9E4D9",
  /** The one accent. Deep madder: warm, editorial, confident, not alarm-red. */
  accent: "#9E3B2A",
  /** The accent at wash strength, behind a flagged phrase. Light enough to
   *  read through, dark enough to survive a screenshot on a phone. */
  accentWash: "#EBD2C4",
} as const;

/**
 * The result page adapts to the reader's scheme; the share card and the badge
 * do not. An artefact somebody screenshots has to look the same in everyone's
 * screenshot, and a badge that changes colour on a merchant's dark PDP is a
 * support ticket.
 */
export const DARK = {
  paper: "#15130F",
  paperRaised: "#1D1A15",
  ink: "#F2EEE4",
  inkSoft: "#B5AD9C",
  inkFaint: "#7E7768",
  rule: "#332E25",
  ruleFaint: "#26221B",
  accent: "#D4715C",
  accentWash: "#3A241E",
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

function vars(palette: typeof PALETTE | typeof DARK): string {
  return Object.entries(palette)
    .map(([key, value]) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
    .join(";");
}

/** The custom properties, light by default and swapped under a dark scheme. */
export function paletteCss(): string {
  return `:root{${vars(PALETTE)}}@media (prefers-color-scheme:dark){:root{${vars(DARK)}}}`;
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
