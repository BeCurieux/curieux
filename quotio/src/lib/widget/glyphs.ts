// Which line mark the step rail draws beside a question.
//
// Data only (no JSX), for the same reason illustrations.ts is: the mapping is
// worth testing on its own, and the drawings live next to the React that
// renders them (src/components/widget/StepGlyph.tsx).
//
// Two passes, in order:
//
//   1. The illustration matcher. If a question is concrete enough to earn a
//      picture on an answer card ("And bathrooms?"), the rail shows the line
//      version of that same picture, so rail and cards agree.
//
//   2. Question shapes. Most generated questions aren't about an object at
//      all — "When do you need it?", "How should it look?" — and the
//      illustration matcher rightly declines to guess, because a wrong
//      picture at 44px in full colour is loud. An 18px line mark in the rail
//      is quiet enough to afford the looser guess, so this pass reads the
//      *shape* of the question instead of its nouns.
//
// Anything both passes decline gets a dot, which is honest.

import { guessIllustration, type IllustrationKey } from "@/lib/widget/illustrations";

export type GlyphName =
  | "home"
  | "bed"
  | "bath"
  | "sparkle"
  | "brush"
  | "person"
  | "people"
  | "calendar"
  | "coins"
  | "chart"
  | "camera"
  | "box"
  | "clock"
  | "question"
  | "screen"
  | "dot";

/** Many illustrations, a dozen glyphs — several pictures share a mark. */
const GLYPH_FOR: Partial<Record<IllustrationKey, GlyphName>> = {
  house: "home",
  window: "home",
  bed: "bed",
  bath: "bath",
  droplet: "bath",
  couch: "home",
  sparkle: "sparkle",
  star: "sparkle",
  heart: "sparkle",
  gift: "sparkle",
  plant: "sparkle",
  sun: "sparkle",
  shield: "sparkle",
  balloons: "sparkle",
  cake: "sparkle",
  person: "person",
  people: "people",
  calendar: "calendar",
  coins: "coins",
  wallet: "coins",
  graph: "chart",
  chart: "chart",
  target: "chart",
  camera: "camera",
  music: "camera",
  box: "box",
  truck: "box",
  oven: "box",
  bucket: "box",
  sponge: "box",
  clock: "clock",
  question: "question",
  browser: "screen",
  cursor: "screen",
  palette: "brush",
  phone: "screen",
  rocket: "screen",
};

/**
 * Second pass: the shape of the question rather than the things in it.
 *
 * Ordered — "how long" is a duration before "how many" is a quantity, and
 * both come before the catch-all interrogatives at the bottom.
 */
const SHAPES: Array<[RegExp, GlyphName]> = [
  [/how long|how many hours|how many days|duration|turnaround/, "clock"],
  [/\bwhen\b|deadline|timeline|timescale|due |by when|how soon|urgen/, "calendar"],
  [/\blook|style|styling|vibe|aesthetic|mood|tone of voice|branding/, "brush"],
  [/\bbuild|building|make|create|working on|kind of project|need done/, "box"],
  [/beyond the basics|anything else|add-?ons?\b|\bextras?\b|additional|on top/, "sparkle"],
  [/\bwho\b|about you|your name|get in touch|contact/, "person"],
  [/\bwhere\b|location|address|which area|postcode|zip/, "home"],
  [/how many|how much|how big|what size|number of/, "chart"],
  // Anything still unmatched but plainly a question keeps the question mark.
  [/\bwhich\b|what kind|what sort|what type|\bwhy\b/, "question"],
];

export function glyphForTitle(title: string): GlyphName {
  const illustration = guessIllustration(title);
  const fromIllustration = illustration ? GLYPH_FOR[illustration] : undefined;
  if (fromIllustration) return fromIllustration;

  const haystack = title.toLowerCase();
  for (const [pattern, glyph] of SHAPES) {
    if (pattern.test(haystack)) return glyph;
  }
  return "dot";
}
