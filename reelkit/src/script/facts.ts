/**
 * The fact sheet: everything an ad may say, drawn from the listing.
 *
 * Both writers — the templates and the model — work from this and nothing
 * else, and `check.ts` holds the model to it.
 */

import type { Product } from "../product/types.js";
import { clip } from "../product/text.js";

export type Facts = {
  title: string;
  /** The title without the keyword-stuffing marketplaces encourage:
   *  "Personalised Mug | Custom Name Mug | Gift for Her" → "Personalised Mug". */
  name: string;
  price?: string;
  shop?: string;
  /** Short lines from the description that read like selling points. */
  highlights: string[];
  description: string;
  imageCount: number;
  marketplace: "etsy" | "shop";
};

export function formatPrice(amount: string, currency: string, locale = "en-US"): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  try {
    const whole = Number.isInteger(n);
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function shortName(title: string): string {
  const first = title.split(/\s+[|•·–—-]\s+|\s*\|\s*|,\s+(?=[A-Z])/)[0]?.trim() || title;
  return clip(first, 40);
}

const BULLET = /^(?:[•*·▪◦✓✔︎✔★☆♥❤-]|\d+[.)])\s*/u;

/** Lines that are about the order, not the product. True, but not an ad. */
const LOGISTICS = /^(shipping|ships?|dispatch(?:es|ed)?|delivery|returns?|refunds?|processing|care|faq|note|please|contact|message)\b/i;

export function highlights(description: string, max = 6): string[] {
  const candidates = description.split(/\n+/).map((raw) => ({
    bulleted: BULLET.test(raw),
    line: raw.replace(BULLET, "").replace(/[:;,.\s]+$/, "").trim(),
  }));
  const usable = candidates.filter(
    ({ line, bulleted }) =>
      line.length >= 8 &&
      line.length <= 70 &&
      !LOGISTICS.test(line) &&
      !/https?:\/\/|@|\bwww\./i.test(line) &&
      // A heading ("DETAILS") is not a selling point.
      (bulleted || line !== line.toUpperCase()),
  );

  // A seller who wrote a list wrote their selling points; take those alone.
  const bullets = usable.filter((c) => c.bulleted).map((c) => c.line);
  if (bullets.length >= 2) return bullets.slice(0, max);

  const out = usable.map((c) => c.line).slice(0, max);
  if (out.length >= 2) return out;

  // No list and no short lines: fall back to the first short sentences.
  for (const s of description.split(/(?<=[.!?])\s+/)) {
    const line = s.replace(/[.!?]+$/, "").trim();
    if (line.length >= 12 && line.length <= 70 && !LOGISTICS.test(line) && !out.includes(line)) out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

export function factsFrom(product: Product): Facts {
  return {
    title: product.title,
    name: shortName(product.title),
    ...(product.price ? { price: formatPrice(product.price.amount, product.price.currency) } : {}),
    ...(product.shop ? { shop: product.shop } : {}),
    highlights: highlights(product.description),
    description: product.description,
    imageCount: Math.max(1, product.images.length),
    marketplace: product.source === "etsy" ? "etsy" : "shop",
  };
}
