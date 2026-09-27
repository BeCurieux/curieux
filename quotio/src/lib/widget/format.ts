// Number and text formatting for result screens (brief §19).

import type { ValueFormat } from "./schema";

/**
 * Format a computed number the way the widget author asked for.
 *
 * Intl does the heavy lifting so "$1,240" and "1 240 €" both come out right,
 * but currency codes arrive from user data, so an unknown code falls back to
 * a plain number rather than throwing on a customer's screen.
 */
export function formatValue(value: number, format: ValueFormat): string {
  const safe = Number.isFinite(value) ? value : 0;
  const decimals = format.decimals;
  let body: string;

  switch (format.style) {
    case "currency":
      try {
        body = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: format.currency || "USD",
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(safe);
      } catch {
        body = fixed(safe, decimals);
      }
      break;

    case "percent":
      body = `${fixed(safe, decimals)}%`;
      break;

    case "duration":
      body = formatDuration(safe);
      break;

    case "number":
    default:
      body = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(safe);
      break;
  }

  return `${format.prefix ?? ""}${body}${format.suffix ?? ""}`;
}

function fixed(value: number, decimals: number): string {
  return value.toFixed(Math.max(0, Math.min(4, decimals)));
}

/** Hours as friendly English: 3 → "3 hours", 3.5 → "3½ hours". */
export function formatDuration(hours: number): string {
  const safe = Math.max(0, hours);
  const whole = Math.floor(safe);
  const fraction = safe - whole;
  const half = fraction >= 0.25 && fraction < 0.75;
  const rounded = fraction >= 0.75 ? whole + 1 : whole;
  const label = half ? `${rounded}½` : `${rounded}`;
  return `${label} ${rounded === 1 && !half ? "hour" : "hours"}`;
}

/**
 * Replace `{{field}}` tokens in author-written copy with the visitor's
 * answers. Unknown tokens are removed rather than left as raw braces — the
 * result screen should never leak template syntax to a customer.
 */
export function interpolate(text: string, scope: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, (_match, key: string) => {
    const value = scope[key];
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? "yes" : "no";
    return String(value);
  });
}

/** "cleaning estimate" → "cleaning-estimate", for slugs and ids. */
export function slugify(input: string, fallback = "widget"): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

/** Same, but legal as an expression variable: "5+ bedrooms" → "bedrooms". */
export function fieldise(input: string, fallback = "field"): string {
  const base = slugify(input, fallback).replace(/-/g, "_").replace(/^[^a-z]+/, "");
  return base || fallback;
}
