/**
 * Reading a brand's colours off its own storefront.
 *
 * The ingester does not choose a palette — `ThemeTokens` is the merchandiser's
 * to fill. What it does is gather candidates and rank them, plus one
 * contrast-checked suggestion so that when the model has nothing to say about
 * colour, the fallback is still the brand's own rather than a stock scheme.
 *
 * The signal that matters most is CSS custom properties. Shopify themes emit
 * their colour schemes as `--color-background: 255 255 255;` style
 * declarations in the document head, which is a far better source than
 * counting every hex in a stylesheet — those are dominated by the theme's own
 * greys and by third-party widgets.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ColourCandidate {
  hex: string;
  weight: number;
  saturation: number;
  luminance: number;
  /** Custom-property names this colour was declared under, e.g. "color-accent". */
  roles: string[];
}

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  navy: "#000080",
  cream: "#fffdd0",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  gold: "#ffd700",
  pink: "#ffc0cb",
  purple: "#800080",
  orange: "#ffa500",
  brown: "#a52a2a",
  grey: "#808080",
  gray: "#808080",
  teal: "#008080",
  transparent: "",
};

export function parseColour(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  const named = NAMED[value];
  if (named !== undefined) return named ? parseColour(named) : null;

  const hex = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hex?.[1]) return fromHex(hex[1]);

  const fn = /^(rgba?|hsla?)\(([^)]+)\)$/.exec(value);
  if (fn?.[2]) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    if (fn[1]?.startsWith("rgb")) return fromRgbParts(parts);
    return fromHslParts(parts);
  }

  // Shopify's own convention: `--color-background: 255 255 255` — three bare
  // numbers, composed into rgb() by the theme at use site. Without this case
  // the richest colour source on a modern Shopify storefront reads as noise.
  const bare = value.split(/[\s,]+/).filter(Boolean);
  if (bare.length === 3 && bare.every((p) => /^\d{1,3}$/.test(p))) return fromRgbParts(bare);

  return null;
}

function fromHex(digits: string): Rgb | null {
  const expand = (s: string) => Number.parseInt(s.length === 1 ? s + s : s, 16);
  if (digits.length === 3 || digits.length === 4) {
    return { r: expand(digits[0]!), g: expand(digits[1]!), b: expand(digits[2]!) };
  }
  if (digits.length === 6 || digits.length === 8) {
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
    };
  }
  return null;
}

function fromRgbParts(parts: string[]): Rgb | null {
  const channel = (raw: string | undefined): number | null => {
    if (raw === undefined) return null;
    const percent = raw.endsWith("%");
    const n = Number.parseFloat(percent ? raw.slice(0, -1) : raw);
    if (!Number.isFinite(n)) return null;
    return clamp(Math.round(percent ? (n / 100) * 255 : n), 0, 255);
  };
  const r = channel(parts[0]);
  const g = channel(parts[1]);
  const b = channel(parts[2]);
  if (r === null || g === null || b === null) return null;
  return { r, g, b };
}

function fromHslParts(parts: string[]): Rgb | null {
  const h = Number.parseFloat(parts[0] ?? "");
  const s = Number.parseFloat((parts[1] ?? "").replace("%", "")) / 100;
  const l = Number.parseFloat((parts[2] ?? "").replace("%", "")) / 100;
  if (![h, s, l].every(Number.isFinite)) return null;

  const c = (1 - Math.abs(2 * l - 1)) * clamp(s, 0, 1);
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = clamp(l, 0, 1) - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const pair = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${pair(r)}${pair(g)}${pair(b)}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = clamp(v, 0, 255) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * How colourful, 0 (grey) to 1.
 *
 * Deliberately *not* HSL saturation, which is the obvious choice and is wrong
 * here: HSL's S spikes towards 1 for near-whites, so a warm off-white like
 * #faf8f4 scores 0.375 — higher than plenty of real brand colours — and any
 * "is this a neutral or the accent?" test built on it picks the background as
 * the accent. This is HSV saturation with an absolute-chroma floor, which
 * answers the question we are actually asking.
 */
const CHROMA_FLOOR = 0.04;

export function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const chroma = max - min;
  if (max === 0 || chroma < CHROMA_FLOOR) return 0;
  return chroma / max;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const CUSTOM_PROPERTY = /--([\w-]*(?:colou?r|bg|background|accent|text|brand|scheme)[\w-]*)\s*:\s*([^;{}]+)/gi;
const ANY_COLOUR = /(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/gi;

/**
 * Rank the colours a set of CSS sources actually declares.
 *
 * Custom properties are weighted far above loose colour literals because they
 * are the theme's *decisions*; the literals are its implementation, plus
 * whatever a reviews widget shipped.
 */
export function collectColours(cssSources: string[]): ColourCandidate[] {
  const weights = new Map<string, number>();
  const roles = new Map<string, Set<string>>();

  const add = (raw: string, weight: number, role?: string) => {
    const rgb = parseColour(raw);
    if (!rgb) return;
    const hex = toHex(rgb);
    weights.set(hex, (weights.get(hex) ?? 0) + weight);
    if (!role) return;
    const set = roles.get(hex) ?? new Set<string>();
    set.add(role.toLowerCase());
    roles.set(hex, set);
  };

  for (const css of cssSources) {
    CUSTOM_PROPERTY.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CUSTOM_PROPERTY.exec(css))) add(match[2] ?? "", 10, match[1]);

    ANY_COLOUR.lastIndex = 0;
    while ((match = ANY_COLOUR.exec(css))) add(match[1] ?? "", 1);
  }

  return [...weights.entries()]
    .map(([hex, weight]) => {
      const rgb = parseColour(hex)!;
      return {
        hex,
        weight,
        saturation: round(saturation(rgb)),
        luminance: round(luminance(rgb)),
        roles: [...(roles.get(hex) ?? [])].slice(0, 6),
      };
    })
    .sort((a, b) => b.weight - a.weight || b.saturation - a.saturation);
}

export interface Colorway {
  background: string;
  surface: string;
  text: string;
  accent: string;
}

const NEAR_BLACK = "#111111";
const NEAR_WHITE = "#fafafa";

/** What a theme calls the thing, mapped to what we need it for. */
const ROLE_PATTERNS = {
  background: /back-?ground|(^|[-_])bg([-_]|$)|canvas|page|body/,
  text: /text|fore-?ground|copy|ink/,
  accent: /accent|primary|brand|highlight|link|button/,
  surface: /surface|card|panel|secondary|subdued|shade/,
} as const;

function byRole(candidates: ColourCandidate[], role: keyof typeof ROLE_PATTERNS): ColourCandidate[] {
  const pattern = ROLE_PATTERNS[role];
  // A property named `--color-background-text` is about text, not background,
  // so a more specific role always wins over a looser one.
  return candidates.filter((c) =>
    c.roles.some((name) => {
      if (!pattern.test(name)) return false;
      if (role === "background" && ROLE_PATTERNS.text.test(name)) return false;
      if (role === "surface" && ROLE_PATTERNS.text.test(name)) return false;
      return true;
    }),
  );
}

/**
 * One contrast-checked colourway from the candidates.
 *
 * The theme's own naming is the best evidence there is: a colour declared as
 * `--color-accent` is the brand's accent, and no amount of counting hexes
 * will beat being told. Frequency heuristics are the fallback for themes that
 * declare nothing.
 *
 * Rules, in order of how much they matter:
 *  - background is the colour named as one, else the dominant near-neutral;
 *  - text must clear 4.5:1 against it whatever it is named. A shop nobody can
 *    read is worse than a shop that ignored the brand's grey;
 *  - accent needs only 3:1 — it carries buttons and rules, not body copy, and
 *    holding it to body-text contrast rejects almost every real brand colour;
 *  - surface is the named one, else a small computed step off the background.
 */
export function suggestColorway(candidates: ColourCandidate[], themeColor?: string): Colorway {
  const neutrals = candidates.filter((c) => c.saturation < 0.2);
  const backgroundCandidate =
    byRole(candidates, "background")[0] ??
    neutrals.find((c) => c.luminance > 0.75) ??
    neutrals.find((c) => c.luminance < 0.15) ??
    candidates[0];

  const background = (backgroundCandidate ? parseColour(backgroundCandidate.hex) : null) ?? { r: 255, g: 255, b: 255 };
  const isDark = luminance(background) < 0.4;

  const legible = (hex: string, minimum: number): boolean => {
    const rgb = parseColour(hex);
    return rgb !== null && contrastRatio(rgb, background) >= minimum;
  };

  const text =
    byRole(candidates, "text").find((c) => legible(c.hex, 4.5))?.hex ??
    candidates.find((c) => c.saturation < 0.35 && legible(c.hex, 4.5))?.hex ??
    (isDark ? NEAR_WHITE : NEAR_BLACK);

  const themeRgb = themeColor ? parseColour(themeColor) : null;
  const accent =
    byRole(candidates, "accent").find((c) => c.saturation > 0 && legible(c.hex, 3))?.hex ??
    (themeRgb && saturation(themeRgb) > 0 && legible(toHex(themeRgb), 3) ? toHex(themeRgb) : undefined) ??
    candidates.find((c) => c.saturation >= 0.25 && legible(c.hex, 3))?.hex ??
    text;

  const surface =
    byRole(candidates, "surface").find((c) => c.hex !== toHex(background))?.hex ??
    toHex(shift(background, isDark ? 0.06 : -0.04));

  return { background: toHex(background), surface, text, accent };
}

/** Nudge a colour towards white (positive) or black (negative). */
function shift({ r, g, b }: Rgb, amount: number): Rgb {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return {
    r: r + (target - r) * t,
    g: g + (target - g) * t,
    b: b + (target - b) * t,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
