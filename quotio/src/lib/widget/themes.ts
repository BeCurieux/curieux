// Widget themes (brief §17).
//
// Customisation is deliberately constrained: six presets, a brand colour, a
// curated font list, four roundness steps and three button styles. There is no
// CSS editor, because the promise of the product is that a widget is
// "difficult to make ugly" (§2). Everything a user can change is a token, and
// every token lands on one CSS custom property that the renderer reads.
//
// The renderer therefore contains no theme conditionals at all — it styles
// itself from `var(--w-*)` and works for themes that don't exist yet.

import type { WidgetTheme } from "./schema";

export interface ThemePresetDefinition {
  id: WidgetTheme["preset"];
  label: string;
  /** One line shown under the swatch in the Design tab. */
  hint: string;
  /** Preview swatch colours for the theme picker: [page, surface, accent]. */
  swatch: [string, string, string];
  vars: Record<string, string>;
}

/** Font stacks, chosen to stay legible if the webfont never loads (§6). */
export const THEME_FONTS: Record<WidgetTheme["font"], { label: string; stack: string }> = {
  "dm-sans": { label: "DM Sans", stack: '"DM Sans", "Poppins", system-ui, sans-serif' },
  inter: { label: "Inter", stack: '"Inter", system-ui, -apple-system, sans-serif' },
  poppins: { label: "Poppins", stack: '"Poppins", "DM Sans", system-ui, sans-serif' },
  fraunces: { label: "Fraunces", stack: '"Fraunces", Georgia, "Times New Roman", serif' },
  system: { label: "System", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
};

/** Corner roundness, S → XL (§17). Panels stay a step ahead of buttons. */
export const RADIUS_SCALE: Record<WidgetTheme["radius"], { card: string; option: string; button: string }> = {
  s: { card: "12px", option: "10px", button: "8px" },
  m: { card: "18px", option: "14px", button: "12px" },
  l: { card: "24px", option: "18px", button: "14px" },
  xl: { card: "32px", option: "24px", button: "18px" },
};

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: "playful",
    label: "Playful",
    hint: "Warm white, soft lavender panels, illustrations welcome.",
    swatch: ["#FFFFFF", "#F7F8FC", "#7657F6"],
    vars: {
      "--w-bg": "#FFFFFF",
      "--w-panel": "#F7F8FC",
      "--w-surface": "#FFFFFF",
      "--w-text": "#18233A",
      "--w-muted": "#4A5568",
      "--w-faint": "#A3AED0",
      "--w-border": "#E7EAF6",
      "--w-shadow": "0 1px 2px rgba(27,31,59,0.04), 0 12px 32px -16px rgba(27,31,59,0.14)",
      "--w-ink": "#18233A",
      "--w-on-ink": "#FFFFFF",
      "--w-celebrate": "#E7F7F3",
      "--w-celebrate-border": "#A9E3D8",
      "--w-celebrate-strong": "#2E9C8B",
      "--w-done": "#73DDB5",
      "--w-option-weight": "1px",
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    hint: "Quiet greys, hairline borders, no decoration.",
    swatch: ["#FFFFFF", "#FAFAFA", "#18233A"],
    vars: {
      "--w-bg": "#FFFFFF",
      "--w-panel": "#FAFAFA",
      "--w-surface": "#FFFFFF",
      "--w-text": "#16181D",
      "--w-muted": "#5B6270",
      "--w-faint": "#9AA1AE",
      "--w-border": "#E6E7EB",
      "--w-shadow": "none",
      "--w-ink": "#16181D",
      "--w-on-ink": "#FFFFFF",
      "--w-celebrate": "#F5F6F7",
      "--w-celebrate-border": "#E2E4E8",
      "--w-celebrate-strong": "#3D4A45",
      "--w-done": "#6E7B76",
      "--w-option-weight": "1px",
    },
  },
  {
    id: "bold",
    label: "Bold",
    hint: "Heavy borders, big type, high contrast.",
    swatch: ["#FFFFFF", "#FFF4DE", "#18233A"],
    vars: {
      "--w-bg": "#FFFFFF",
      "--w-panel": "#FFF4DE",
      "--w-surface": "#FFFFFF",
      "--w-text": "#12142B",
      "--w-muted": "#3A4152",
      "--w-faint": "#7C869C",
      "--w-border": "#12142B",
      "--w-shadow": "4px 4px 0 rgba(18,20,43,1)",
      "--w-ink": "#12142B",
      "--w-on-ink": "#FFFFFF",
      "--w-celebrate": "#FFF4DE",
      "--w-celebrate-border": "#12142B",
      "--w-celebrate-strong": "#12142B",
      "--w-done": "#12142B",
      "--w-option-weight": "2px",
    },
  },
  {
    id: "soft",
    label: "Soft",
    hint: "Pastel wash, gentle edges, calm.",
    swatch: ["#FBFAFF", "#F1F0FE", "#7C7BF0"],
    vars: {
      "--w-bg": "#FBFAFF",
      "--w-panel": "#F1F0FE",
      "--w-surface": "#FFFFFF",
      "--w-text": "#2A2A46",
      "--w-muted": "#5F6183",
      "--w-faint": "#A9AAC9",
      "--w-border": "#E9E7FB",
      "--w-shadow": "0 10px 30px -18px rgba(80,72,180,0.35)",
      "--w-ink": "#2A2A46",
      "--w-on-ink": "#FFFFFF",
      "--w-celebrate": "#EAF6F3",
      "--w-celebrate-border": "#BCE4DC",
      "--w-celebrate-strong": "#37907F",
      "--w-done": "#73DDB5",
      "--w-option-weight": "1px",
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    hint: "Cream paper, serif headings, magazine calm.",
    swatch: ["#FBF8F2", "#F3EEE4", "#1F2A24"],
    vars: {
      "--w-bg": "#FBF8F2",
      "--w-panel": "#F3EEE4",
      "--w-surface": "#FFFDF9",
      "--w-text": "#1F2A24",
      "--w-muted": "#4E5952",
      "--w-faint": "#93968D",
      "--w-border": "#E2DACB",
      "--w-shadow": "0 1px 0 rgba(31,42,36,0.06)",
      "--w-ink": "#1F2A24",
      "--w-on-ink": "#FFFDF9",
      "--w-celebrate": "#EFF3EC",
      "--w-celebrate-border": "#D7E0D1",
      "--w-celebrate-strong": "#3A5A44",
      "--w-done": "#6E8C77",
      "--w-option-weight": "1px",
    },
  },
  {
    id: "dark",
    label: "Dark",
    hint: "Deep navy, luminous accent.",
    swatch: ["#14172B", "#1D2140", "#8C8FFF"],
    vars: {
      "--w-bg": "#14172B",
      "--w-panel": "#1D2140",
      "--w-surface": "#1A1E38",
      "--w-text": "#F4F5FF",
      "--w-muted": "#B9BEDC",
      "--w-faint": "#7B82AC",
      "--w-border": "#2C3157",
      "--w-shadow": "0 18px 40px -20px rgba(0,0,0,0.6)",
      "--w-ink": "#F4F5FF",
      "--w-on-ink": "#14172B",
      "--w-celebrate": "#1D3B38",
      "--w-celebrate-border": "#2F5A54",
      "--w-celebrate-strong": "#8FE0D2",
      "--w-done": "#5FBFB0",
      "--w-option-weight": "1px",
    },
  },
];

const PRESET_BY_ID = new Map(THEME_PRESETS.map((preset) => [preset.id, preset]));

export function presetFor(theme: WidgetTheme): ThemePresetDefinition {
  return PRESET_BY_ID.get(theme.preset) ?? THEME_PRESETS[0];
}

/* ------------------------------------------------------------------ */
/* Accent derivation                                                   */
/* ------------------------------------------------------------------ */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

/** WCAG relative luminance — used to keep button labels readable (§37). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Pick black or white for text on the brand colour, whichever is more
 * readable. A user who picks bright yellow gets dark text automatically
 * instead of an unreadable button.
 */
export function readableOn(background: string): string {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#12142B")
    ? "#FFFFFF"
    : "#12142B";
}

function mix(hex: string, target: { r: number; g: number; b: number }, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const blend = (from: number, to: number) => Math.round(from + (to - from) * amount);
  const value = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${value(blend(r, target.r))}${value(blend(g, target.g))}${value(blend(b, target.b))}`;
}

export function tint(hex: string, amount: number): string {
  return mix(hex, { r: 255, g: 255, b: 255 }, amount);
}

export function shade(hex: string, amount: number): string {
  return mix(hex, { r: 0, g: 0, b: 0 }, amount);
}

/* ------------------------------------------------------------------ */
/* The style object                                                    */
/* ------------------------------------------------------------------ */

/**
 * Every visual decision a theme makes, as inline CSS custom properties.
 *
 * Returned as a plain object so it can be spread onto the wrapper element in
 * a server component, a client preview or an embed iframe identically — and
 * so two differently-themed widgets can sit on the same page without
 * fighting over a stylesheet.
 */
export function themeStyle(theme: WidgetTheme): Record<string, string> {
  const preset = presetFor(theme);
  const radius = RADIUS_SCALE[theme.radius];
  const accent = theme.brandColour;
  const isDark = preset.id === "dark";

  // On dark themes the "soft" accent wash has to be a shade, not a tint,
  // or a selected answer glows white.
  const accentSoft = isDark ? shade(accent, 0.62) : tint(accent, 0.9);
  const accentMid = isDark ? shade(accent, 0.35) : tint(accent, 0.62);

  return {
    ...preset.vars,
    "--w-font": THEME_FONTS[theme.font].stack,
    "--w-accent": accent,
    "--w-accent-soft": accentSoft,
    "--w-accent-mid": accentMid,
    "--w-accent-strong": isDark ? tint(accent, 0.15) : shade(accent, 0.14),
    "--w-on-accent": readableOn(accent),
    "--w-radius-card": radius.card,
    "--w-radius-option": radius.option,
    "--w-radius-button": radius.button,
  };
}

/**
 * Button styling is a token too, so the renderer stays free of branches.
 *
 * "Filled" is the theme's ink — deep navy on light themes, near-white on dark
 * — rather than the brand colour. The brand colour still marks every piece of
 * *state* in the widget: the selected answer, the progress bar, the slider,
 * the toggle, the focus ring. Separating "press this" from "you chose this"
 * is what keeps a busy question screen readable.
 *
 * An author who wants their brand colour on the button itself picks "Soft" or
 * "Outline", both of which are accent-driven.
 */
export function buttonVars(theme: WidgetTheme): Record<string, string> {
  switch (theme.buttonStyle) {
    case "soft":
      return {
        "--w-btn-bg": "var(--w-accent-soft)",
        "--w-btn-fg": "var(--w-accent-strong)",
        "--w-btn-border": "transparent",
        "--w-btn-hover": "var(--w-accent-mid)",
      };
    case "outline":
      return {
        "--w-btn-bg": "transparent",
        "--w-btn-fg": "var(--w-accent)",
        "--w-btn-border": "var(--w-accent)",
        "--w-btn-hover": "var(--w-accent-soft)",
      };
    case "filled":
    default: {
      const preset = presetFor(theme);
      const ink = preset.vars["--w-ink"] ?? "#18233A";
      const isDark = preset.id === "dark";
      return {
        "--w-btn-bg": "var(--w-ink)",
        "--w-btn-fg": "var(--w-on-ink)",
        "--w-btn-border": "transparent",
        "--w-btn-hover": isDark ? shade(ink, 0.1) : tint(ink, 0.18),
      };
    }
  }
}

/** Everything the renderer needs, in one object to spread onto the root. */
export function widgetStyleVars(theme: WidgetTheme): Record<string, string> {
  return { ...themeStyle(theme), ...buttonVars(theme) };
}
