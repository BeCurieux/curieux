/**
 * Is this product a dietary supplement? The deterministic first pass.
 *
 * BUILD_BRIEF.md §7.1: "title/tags/type heuristics + model classification".
 * This is the heuristic half; the model's half arrives with extraction (M2)
 * and only ever adds a suggestion the merchant confirms. Detection decides
 * which products are offered for a scan — never a verdict — so the cost of a
 * miss is a merchant ticking a box, and the cost of a false positive is a
 * cosmetic scanned against supplement rules. Hence the exclusions: "vitamin C
 * serum" is skincare.
 *
 * Returns a reason either way, so "why is this (not) here?" has an answer.
 */

import type { ShopifyProduct } from "../shopify/admin/products.js";
import { containsPhrase } from "../engine/text.js";

export type Detection = { category: "supplements" | null; reason: string };

/** Enough on their own. */
const STRONG = [
  "dietary supplement",
  "food supplement",
  "supplement",
  "supplements",
  "multivitamin",
  "probiotic",
  "probiotics",
  "nahrungsergänzungsmittel",
  "nahrungsergänzung",
  "complément alimentaire",
  "compléments alimentaires",
  "softgel",
  "softgels",
];

/** A nutrient or botanical — only counts alongside a dose form. */
const NUTRIENT = [
  "vitamin",
  "vitamins",
  "magnesium",
  "zinc",
  "iron",
  "calcium",
  "omega-3",
  "fish oil",
  "collagen",
  "ashwagandha",
  "turmeric",
  "melatonin",
  "biotin",
  "elderberry",
  "creatine",
];

const DOSE_FORM = ["capsule", "capsules", "tablet", "tablets", "gummy", "gummies", "caps", "tabs", "drops", "sachets", "kapseln", "gélules"];

/** Topicals and the rest: never a supplement, whatever else matched. */
const EXCLUDE = ["serum", "cream", "lotion", "shampoo", "conditioner", "cleanser", "moisturiser", "moisturizer", "toner", "lipstick", "balm", "body wash", "soap", "candle", "gift card"];

export function detectCategory(product: Pick<ShopifyProduct, "title" | "productType" | "tags" | "description">): Detection {
  const fields: [string, string][] = [
    ["product type", product.productType],
    ["tag", product.tags.join(" · ")],
    ["title", product.title],
  ];
  const all = [...fields, ["description", product.description] as [string, string]];

  const excluded = firstMatch(fields, EXCLUDE);
  if (excluded) return { category: null, reason: `${excluded.where} says "${excluded.term}"` };

  const strong = firstMatch(fields, STRONG);
  if (strong) return { category: "supplements", reason: `${strong.where} says "${strong.term}"` };

  const nutrient = firstMatch(fields, NUTRIENT);
  const form = nutrient ? firstMatch(all, DOSE_FORM) : null;
  if (nutrient && form) {
    return { category: "supplements", reason: `${nutrient.where} says "${nutrient.term}" and ${form.where} says "${form.term}"` };
  }
  return { category: null, reason: "no supplement signal in type, tags or title" };
}

function firstMatch(fields: [string, string][], terms: string[]): { where: string; term: string } | null {
  for (const [where, text] of fields) {
    if (!text) continue;
    for (const term of terms) if (containsPhrase(text, term)) return { where, term };
  }
  return null;
}
