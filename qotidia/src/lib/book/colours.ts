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
  { age: 0,  name: "oat",            hex: "#D9CFBE", inkHex: "#2B2721" },
  { age: 1,  name: "eucalypt",       hex: "#63746B", inkHex: "#F7F8F4" },
  { age: 2,  name: "terracotta",     hex: "#A95C3C", inkHex: "#FDF8F2" },
  { age: 3,  name: "amber",          hex: "#C08A2E", inkHex: "#2A2210" },
  { age: 4,  name: "dusty blue",     hex: "#577388", inkHex: "#F7F6F2" },
  { age: 5,  name: "olive",          hex: "#6B7455", inkHex: "#FAF8F1" },
  { age: 6,  name: "linen",          hex: "#CFC3AE", inkHex: "#2A261F" },
  { age: 7,  name: "russet",         hex: "#95462E", inkHex: "#FBF4EC" },
  { age: 8,  name: "wheat",          hex: "#C6A455", inkHex: "#2A2413" },
  { age: 9,  name: "slate blue",     hex: "#4E6474", inkHex: "#F5F5F1" },
  { age: 10, name: "moss",           hex: "#69744A", inkHex: "#F7F6EE" },
  { age: 11, name: "shell",          hex: "#DBCFC4", inkHex: "#2C2721" },
  { age: 12, name: "rust",           hex: "#9C5334", inkHex: "#FCF6EE" },
  { age: 13, name: "ochre",          hex: "#B08430", inkHex: "#282111" },
  { age: 14, name: "harbour",        hex: "#42596B", inkHex: "#F4F4F0" },
  { age: 15, name: "fern",           hex: "#3F5A3E", inkHex: "#F6F6EE" },
  { age: 16, name: "sand",           hex: "#C9B79A", inkHex: "#2A251D" },
  { age: 17, name: "brick",          hex: "#8E4535", inkHex: "#FBF3EC" },
  { age: 18, name: "walnut",         hex: "#5A4634", inkHex: "#F8F3EA" },
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
