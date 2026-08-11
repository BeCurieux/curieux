// The annual colour system (brief §5).
//
// One colour per age, so eighteen volumes make a satisfying row rather than
// eighteen unrelated books. Archive and publishing tones — never sugary
// children's colours, and never gendered.
//
// Constrained by the stock: Mohawk Superfine uncoated renders colour less
// saturated, with softer detail and shallower blacks than gloss. So the
// palette avoids anything that depends on ultra-black, neon, or very
// low-contrast beige-on-beige. Every value here is chosen to survive being
// printed slightly softer than it looks on screen — and every one is
// PROVISIONAL until a physical sample comes back (brief §18).

export interface AgeColour {
  /** Stable key. Stored in the database, so it must never be re-spelled. */
  id: string;
  age: number;
  name: string;
  /** Cover field. */
  hex: string;
  /** Type printed on that field — chosen for contrast on uncoated stock. */
  inkHex: string;
}

// The Qotidia spectrum. Warmer and softer than what preceded it, taken from
// the design mockups: terracotta, mustard, dusty blue, olive, oatmeal, with
// the remaining ages built out in the same family so a shelf of eighteen
// still reads as one set rather than a paint chart.
//
// Every value is validated by coverContrastOk() — several here are a shade
// or two deeper than the mockup, because a white name on a pale oatmeal
// spine is unreadable across the room and worse on uncoated stock, which
// flattens contrast further.
export const AGE_COLOURS: AgeColour[] = [
  { id: "oat",          age: 0,   name: "oat",            hex: "#D9CFBE", inkHex: "#2B2721" },
  { id: "eucalypt",     age: 1,   name: "eucalypt",       hex: "#63746B", inkHex: "#F7F8F4" },
  { id: "terracotta",   age: 2,   name: "terracotta",     hex: "#A95C3C", inkHex: "#FDF8F2" },
  { id: "amber",        age: 3,   name: "amber",          hex: "#C08A2E", inkHex: "#2A2210" },
  { id: "dusty_blue",   age: 4,   name: "dusty blue",     hex: "#577388", inkHex: "#F7F6F2" },
  { id: "olive",        age: 5,   name: "olive",          hex: "#6B7455", inkHex: "#FAF8F1" },
  { id: "linen",        age: 6,   name: "linen",          hex: "#CFC3AE", inkHex: "#2A261F" },
  { id: "russet",       age: 7,   name: "russet",         hex: "#95462E", inkHex: "#FBF4EC" },
  { id: "wheat",        age: 8,   name: "wheat",          hex: "#C6A455", inkHex: "#2A2413" },
  { id: "slate_blue",   age: 9,   name: "slate blue",     hex: "#4E6474", inkHex: "#F5F5F1" },
  { id: "moss",         age: 10,  name: "moss",           hex: "#69744A", inkHex: "#F7F6EE" },
  { id: "shell",        age: 11,  name: "shell",          hex: "#DBCFC4", inkHex: "#2C2721" },
  { id: "rust",         age: 12,  name: "rust",           hex: "#9C5334", inkHex: "#FCF6EE" },
  { id: "ochre",        age: 13,  name: "ochre",          hex: "#B08430", inkHex: "#282111" },
  { id: "harbour",      age: 14,  name: "harbour",        hex: "#42596B", inkHex: "#F4F4F0" },
  { id: "fern",         age: 15,  name: "fern",           hex: "#3F5A3E", inkHex: "#F6F6EE" },
  { id: "sand",         age: 16,  name: "sand",           hex: "#C9B79A", inkHex: "#2A251D" },
  { id: "brick",        age: 17,  name: "brick",          hex: "#8E4535", inkHex: "#FBF3EC" },
  { id: "walnut",       age: 18,  name: "walnut",         hex: "#5A4634", inkHex: "#F8F3EA" },
];

export function colourForAge(age: number): AgeColour {
  const found = AGE_COLOURS.find((c) => c.age === age);
  if (found) return found;
  // Past the designed range, cycle rather than fail — the shelf still reads.
  return AGE_COLOURS[age % AGE_COLOURS.length];
}

/**
 * Relative luminance, used to check ink/field contrast survives a stock that
 * prints softer than the screen suggests.
 */
export function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Where a colour sits on the wheel, 0–360.
 *
 * Contrast answers "can this be read"; hue answers "do these two look like
 * the same decision". Two warm reds a few degrees apart read as a mistake
 * even when both are perfectly legible, which is a thing no contrast check
 * can catch.
 */
export function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma === 0) return 0;
  const h =
    max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return (h * 60 + 360) % 360;
}

/** The shorter way round the wheel between two colours, in degrees. */
export function huesApart(a: string, b: string): number {
  const d = Math.abs(hueOf(a) - hueOf(b)) % 360;
  return Math.min(d, 360 - d);
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Uncoated stock flattens contrast, so the on-screen ratio needs headroom.
 * 4.5:1 on screen holds up as legible cover type in print; below that the
 * name stops reading across a room, which is the whole job of the cover.
 */
export const MIN_COVER_CONTRAST = 4.5;

export function coverContrastOk(colour: AgeColour): boolean {
  return contrastRatio(colour.hex, colour.inkHex) >= MIN_COVER_CONTRAST;
}

/**
 * The cover field colour is chosen to carry reversed-out type, which makes it
 * far too pale to set small labels on white paper — faded butter on white is
 * about 1.7:1, i.e. invisible. This darkens the same hue until it is legible
 * as 7pt type, so the interior can use the volume's colour without becoming
 * unreadable.
 */
export function accentForPaper(colour: AgeColour, target = 4.5): string {
  const v = colour.hex.replace("#", "");
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  for (let i = 0; i < 40; i++) {
    const hex = `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
    if (contrastRatio(hex, "#FFFFFF") >= target) return hex;
    [r, g, b] = [r * 0.92, g * 0.92, b * 0.92];
  }
  return "#4A4A48";
}

// --------------------------------------------------------- chosen colours
//
// The spectrum is the default, not the rule. Two things parents actually
// want and the age-mapping alone cannot give them:
//
//   "I want this one darker." A single book, changed, with the rest of the
//   shelf left alone.
//
//   "I want them all the same." A row of identical spines is a legitimate
//   taste, and for some shelves it looks better than a gradient.
//
// So there are two levels of override and a default underneath both, and the
// order between them is the whole design: a choice made about one book must
// not be silently undone by a later change to the child's default.

/** Stored on a subject: every book this colour. Null means the spectrum. */
export type SubjectColourPreference = string | null;

/** Stored on a book: this volume only. Null means "whatever the rule says". */
export type BookColourChoice = string | null;

export function colourById(id: string | null | undefined): AgeColour | null {
  if (!id) return null;
  return AGE_COLOURS.find((c) => c.id === id) ?? null;
}

/**
 * Which colour a given book is actually printed in.
 *
 * Precedence, most specific first:
 *
 *   1. this book's own choice — someone opened this volume and picked
 *   2. the child's standing preference — "make them all walnut"
 *   3. the age spectrum — the default, and what most shelves will be
 *
 * An unrecognised id falls through rather than failing. Colours may be
 * retired from the palette; a book printed in one four years ago should not
 * stop rendering because of it, and the shelf reading slightly differently
 * is a far better outcome than a render job that throws at print time.
 */
export function colourForBook(input: {
  bookColour?: BookColourChoice;
  subjectColour?: SubjectColourPreference;
  age: number;
}): AgeColour {
  return (
    colourById(input.bookColour) ??
    colourById(input.subjectColour) ??
    colourForAge(input.age)
  );
}

/**
 * Whether a book is following the rule or has been set by hand.
 *
 * The picker needs this to show "following the spectrum" as a state rather
 * than as a highlighted swatch — otherwise a parent who has changed nothing
 * appears to have made a choice, and cannot tell how to get back.
 */
export function isFollowingDefault(bookColour: BookColourChoice): boolean {
  return colourById(bookColour) === null;
}

/** Every colour offered in the picker, in shelf order. */
export const COLOUR_CHOICES: AgeColour[] = AGE_COLOURS;
