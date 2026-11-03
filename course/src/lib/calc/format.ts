import type { Colour, OutputSpec } from "./types";

// How results read on screen. AUD by default, USD outside Australia
// (SPEC.md → Non-negotiables); never a tax line.

export type Currency = "AUD" | "USD";

export function currencyFor(country: string | null | undefined): Currency {
  return !country || country.toUpperCase() === "AU" ? "AUD" : "USD";
}

const SYMBOL: Record<Currency, string> = { AUD: "A$", USD: "US$" };

export function formatMoney(amount: number, currency: Currency): string {
  const sign = amount < 0 ? "−" : "";
  const value = Math.abs(amount).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${SYMBOL[currency]}${value}`;
}

export const COLOUR_LABEL: Record<Colour, string> = { green: "Green", amber: "Amber", red: "Red" };

export function formatOutput(kind: OutputSpec["kind"], value: unknown, currency: Currency): string {
  if (value === null || value === undefined) return "—";
  if (kind === "yesno") return value ? "Yes" : "No";
  if (kind === "colour") return COLOUR_LABEL[value as Colour] ?? String(value);
  if (kind === "text") return String(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (kind === "money") return formatMoney(n, currency);
  if (kind === "percent") return `${(Math.round(n * 10) / 10).toLocaleString("en-AU")}%`;
  if (kind === "days") return `${n} day${n === 1 ? "" : "s"}`;
  if (kind === "integer") return n.toLocaleString("en-AU");
  return (Math.round(n * 100) / 100).toLocaleString("en-AU");
}
