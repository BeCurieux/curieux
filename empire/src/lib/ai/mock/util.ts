import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";

// Helpers for the offline generator. Everything it writes is assembled from
// what the customer told us; where it needs a fact it doesn't have, it
// writes a [bracketed placeholder] — the same rule the model follows.

export const clip = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

export const sentence = (value: string) => {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const capped = trimmed[0]!.toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capped) ? capped : `${capped}.`;
};

export const lower = (value: string) =>
  value && value[0] === value[0]!.toUpperCase() && value[1] !== value[1]?.toUpperCase()
    ? value[0]!.toLowerCase() + value.slice(1)
    : value;

/** "warm, witty and calm" → ["warm", "witty", "calm"] */
export function listFrom(value: string): string[] {
  return value
    .split(/,|;|\n|\band\b|\//i)
    .map((item) => item.trim().replace(/[.]+$/, ""))
    .filter((item) => item.length > 1);
}

export const firstClause = (value: string, max = 90) => {
  const clause = value.split(/[.;\n]/)[0]?.trim() ?? value;
  return clip(clause, max);
};

const US = /\b(united states|usa|us|america)\b/i;
export const isUS = (market: string) => US.test(market);

/** British/Australian spelling unless she sells in the US. */
export function spell(market: string, word: "colour" | "favourite" | "personalise" | "organise") {
  if (!isUS(market)) return word;
  return {
    colour: "color",
    favourite: "favorite",
    personalise: "personalize",
    organise: "organize",
  }[word];
}

export function audienceShort(profile: BusinessProfile): string {
  return lower(firstClause(profile.audience, 80));
}

export function productsShort(profile: BusinessProfile): string {
  return lower(firstClause(profile.productsSummary, 90));
}

export function traitWords(profile: BusinessProfile): string[] {
  const given = listFrom(profile.personality).slice(0, 5);
  if (given.length >= 3) return given;
  const fallback = ["warm", "clear", "considered", "quietly confident", "practical"];
  return [...given, ...fallback.filter((t) => !given.includes(t))].slice(
    0,
    Math.max(3, given.length),
  );
}

const NAMED: Record<string, string> = {
  black: "#1E1C1E",
  ink: "#282528",
  charcoal: "#3A3638",
  white: "#FFFFFF",
  ivory: "#F8F4ED",
  cream: "#F5EFE3",
  oat: "#E9E0D0",
  beige: "#E4D6C1",
  sand: "#D9C6A5",
  blush: "#EACED1",
  pink: "#E8819F",
  rose: "#C9737F",
  oxblood: "#632B39",
  burgundy: "#6B2234",
  red: "#B23A3A",
  terracotta: "#B8643F",
  rust: "#A4502E",
  orange: "#D9783A",
  mustard: "#C9A227",
  yellow: "#E8C547",
  gold: "#B8963E",
  sage: "#9AAA8C",
  olive: "#6B6E3A",
  green: "#3F6B4E",
  forest: "#2F4A3A",
  teal: "#2F6F6B",
  blue: "#3A5A8C",
  navy: "#1F2E4A",
  sky: "#A9C6DE",
  lavender: "#B9A9D6",
  lilac: "#C8B6DB",
  purple: "#5E3F7A",
  grey: "#8C8789",
  gray: "#8C8789",
  stone: "#B5ADA3",
  brown: "#6B4A35",
  chocolate: "#4A3326",
};

export interface Swatch {
  name: string;
  hex: string;
}

/** Colours she named (words or hex codes), in her order. */
export function namedColours(profile: BusinessProfile): Swatch[] {
  const out: Swatch[] = [];
  for (const match of profile.colours.matchAll(/#([0-9a-f]{6})\b/gi)) {
    out.push({ name: `Colour ${out.length + 1}`, hex: `#${match[1]!.toUpperCase()}` });
  }
  for (const word of profile.colours.toLowerCase().split(/[^a-z]+/)) {
    const hex = NAMED[word];
    if (hex && !out.some((s) => s.hex === hex)) {
      out.push({ name: word[0]!.toUpperCase() + word.slice(1), hex });
    }
  }
  return out;
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A usable palette: her colours first, padded with neutrals that pass contrast. */
export function buildPalette(
  profile: BusinessProfile,
): { name: string; hex: string; use: string }[] {
  const named = namedColours(profile);
  const light = named.filter((s) => luminance(s.hex) > 0.6);
  const dark = named.filter((s) => luminance(s.hex) < 0.08);
  const mid = named.filter((s) => !light.includes(s) && !dark.includes(s));

  const background = light[0] ?? { name: "Warm white", hex: "#FAF7F2" };
  let text = dark[0] ?? { name: "Ink", hex: "#262326" };
  if (contrast(text.hex, background.hex) < 7) text = { name: "Ink", hex: "#262326" };
  const accent = mid[0] ?? dark[1] ?? { name: "Deep accent", hex: "#632B39" };
  const soft = light[1] ?? mid[1] ?? { name: "Soft tint", hex: "#EFE6DE" };

  const palette = [
    { ...background, use: "Page background and generous empty space." },
    { ...text, use: "Body text and headings — the most readable pairing on the page." },
    {
      ...accent,
      use:
        contrast(accent.hex, background.hex) >= 4.5
          ? "Buttons, links and small highlights. Passes contrast on the background."
          : "Decoration only (dividers, icons, illustration). Too light for text — keep buttons in the text colour.",
    },
    { ...soft, use: "Section backgrounds, cards and the announcement bar." },
  ];
  for (const extra of [...mid.slice(1), ...dark.slice(1), ...light.slice(2)].slice(0, 2)) {
    if (!palette.some((p) => p.hex === extra.hex)) {
      palette.push({ ...extra, use: "Secondary accent for seasonal or product-specific moments." });
    }
  }
  return palette;
}

export type StyleFamily = "minimal" | "earthy" | "playful" | "luxe" | "classic";

export function styleFamily(profile: BusinessProfile): StyleFamily {
  const s = `${profile.visualStyle} ${profile.personality}`.toLowerCase();
  if (/minimal|clean|simple|modern|scandi/.test(s)) return "minimal";
  if (/earthy|natural|organic|rustic|botanical|boho|handmade/.test(s)) return "earthy";
  if (/playful|bright|fun|bold|colourful|colorful|quirky/.test(s)) return "playful";
  if (/luxe|luxury|elegant|premium|editorial|sophisticated/.test(s)) return "luxe";
  return "classic";
}

export const FONTS: Record<StyleFamily, { headings: string; body: string; notes: string }> = {
  minimal: {
    headings:
      "A clean grotesque such as Work Sans or Inter, medium weight, generous letter spacing on small caps labels.",
    body: "The same family at regular weight, 16px or larger.",
    notes: "One family keeps it calm. Use weight and size, not extra fonts, for hierarchy.",
  },
  earthy: {
    headings: "A soft, slightly old-style serif such as Lora or Cormorant Garamond.",
    body: "A humanist sans such as Nunito Sans or Karla, 16px or larger.",
    notes: "Pair the warm serif with plenty of space and natural textures in photos.",
  },
  playful: {
    headings:
      "A rounded or chunky display face such as Fredoka or DM Serif Display at large sizes.",
    body: "A friendly, highly legible sans such as DM Sans, 16px or larger.",
    notes: "Let headings carry the personality; keep body text plain so it stays easy to read.",
  },
  luxe: {
    headings: "A high-contrast editorial serif such as Playfair Display or Cormorant.",
    body: "A refined sans such as Jost or Montserrat at regular weight, 16px or larger.",
    notes: "Large headings, small uppercase labels and lots of space read as premium.",
  },
  classic: {
    headings: "A dependable serif such as Libre Baskerville or Lora.",
    body: "A clear sans such as Source Sans or Open Sans, 16px or larger.",
    notes: "Classic and trustworthy. Keep to two fonts across the store.",
  },
};

export function brandName(profile: BusinessProfile) {
  return profile.brandName.trim();
}

export function verifiedFacts(profile: BusinessProfile, product?: Product): string[] {
  return [...profile.verifiedClaims, ...(product?.verifiedClaims ?? [])];
}

export function price(profile: BusinessProfile, product: Product | undefined): string {
  if (!product || product.price === null) return "[add price]";
  try {
    return new Intl.NumberFormat(isUS(profile.market) ? "en-US" : "en-AU", {
      style: "currency",
      currency: profile.currency,
    }).format(product.price);
  } catch {
    return `${profile.currency} ${product.price.toFixed(2)}`;
  }
}

export const isDigital = (profile: BusinessProfile) => profile.fulfilment === "digital";
