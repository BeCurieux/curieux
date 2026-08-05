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

export const AGE_COLOURS: AgeColour[] = [
  { age: 0,  name: "warm parchment",     hex: "#E4DCC8", inkHex: "#26241D" },
  { age: 1,  name: "dusty clay",         hex: "#A0603F", inkHex: "#FBF7F0" },
  { age: 2,  name: "faded butter",       hex: "#DEC474", inkHex: "#2A2618" },
  { age: 3,  name: "chalky blue",        hex: "#93A9B6", inkHex: "#1B2228" },
  { age: 4,  name: "muted tomato",       hex: "#B05341", inkHex: "#FBF5F0" },
  { age: 5,  name: "sage",               hex: "#8C9A7E", inkHex: "#1E2419" },
  { age: 6,  name: "tobacco",            hex: "#6F5335", inkHex: "#FAF4EA" },
  { age: 7,  name: "washed ultramarine", hex: "#5A6B96", inkHex: "#F6F5F2" },
  { age: 8,  name: "ochre",              hex: "#C2913C", inkHex: "#2A2416" },
  { age: 9,  name: "slate green",        hex: "#5E7169", inkHex: "#F4F4EE" },
  { age: 10, name: "oxblood",            hex: "#7E3F42", inkHex: "#F7F0EC" },
  { age: 11, name: "pale eucalypt",      hex: "#B7C0A8", inkHex: "#23281D" },
  { age: 12, name: "indigo",             hex: "#414B69", inkHex: "#F2F3F1" },
  { age: 13, name: "terracotta",         hex: "#8F4A2C", inkHex: "#FBF4EC" },
  { age: 14, name: "stone",              hex: "#A9A69A", inkHex: "#22221C" },
  { age: 15, name: "deep teal",          hex: "#3F5D5E", inkHex: "#F1F4F2" },
  { age: 16, name: "mustard",            hex: "#B79433", inkHex: "#28230F" },
  { age: 17, name: "plum",               hex: "#6A4A63", inkHex: "#F5F0F3" },
  { age: 18, name: "graphite",           hex: "#4A4A48", inkHex: "#F2F2EE" },
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
