/**
 * Holding an ad to the listing.
 *
 * An ad says things about a product in public, under the seller's name, to
 * people deciding whether to pay. A caption claiming "handmade", "organic" or
 * "best-seller" that the seller never wrote is a claim they now have to stand
 * behind — and on Etsy and Meta, a claim that can get the listing or the ad
 * account pulled. So the rule is simple and deliberately over-broad: no number
 * and no claim word appears in an ad unless it appears in the listing.
 *
 * A rejected draft costs one fallback to a template. A fabricated one costs
 * the seller. That trade is the whole design.
 */

import type { Facts } from "./facts.js";
import { LIMITS, type AdScript } from "./types.js";

/** Words that make a factual claim about the product, its sales, or its
 *  provenance. Each is fine when the listing says it, and only then. */
export const CLAIM_WORDS = [
  "best[- ]?sell(?:er|ing)",
  "#\\s?1",
  "number one",
  "award(?:[- ]winning)?",
  "clinically",
  "proven",
  "guarantee[ds]?",
  "free shipping",
  "free delivery",
  "on sale",
  "discount",
  "% off",
  "limited (?:edition|stock|time)",
  "(?:only|just) \\d+ left",
  "selling (?:out|fast)",
  "sold out",
  "viral",
  "trending",
  "five[- ]star",
  "5[- ]star",
  "reviews?",
  "customers? love",
  "loved by",
  "organic",
  "eco[- ]?friendly",
  "sustainabl[ey]",
  "recycled",
  "hand ?made",
  "handcrafted",
  "hand[- ]painted",
  "vegan",
  "cruelty[- ]free",
  "waterproof",
  "dishwasher[- ]safe",
  "non[- ]toxic",
  "hypoallergenic",
  "all[- ]natural",
  "100%",
  "lifetime",
  "warranty",
  "made in [a-z]+",
  "solid (?:gold|silver)",
  "sterling",
  "genuine",
  "real leather",
];

const claimRes = CLAIM_WORDS.map((w) => new RegExp(`(?<![a-z])${w}(?![a-z])`, "i"));

function sourceText(f: Facts): string {
  return [f.title, f.description, f.price ?? "", f.shop ?? "", ...f.highlights].join("\n");
}

const NUM = /\d+(?:[.,]\d+)*/g;

function numbers(s: string): Set<number> {
  const out = new Set<number>();
  for (const m of s.matchAll(NUM)) {
    const raw = m[0];
    const n = Number(raw.replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

export function scriptText(s: AdScript): string {
  return [s.hook, ...s.scenes.map((x) => x.caption), s.cta].join("\n");
}

export function problems(script: AdScript, facts: Facts): string[] {
  const out: string[] = [];
  const src = sourceText(facts);
  const allowed = numbers(src);
  const text = scriptText(script);

  for (const n of numbers(text)) {
    if (!allowed.has(n)) out.push(`mentions ${n}, which the listing doesn't`);
  }
  for (const [i, re] of claimRes.entries()) {
    const said = text.match(re);
    if (said && !re.test(src)) out.push(`says "${said[0]}" (${CLAIM_WORDS[i]}), which the listing doesn't`);
  }
  if (script.hook.length > LIMITS.hook) out.push("hook too long");
  for (const s of script.scenes) {
    if (s.caption.length > LIMITS.caption) out.push(`caption too long: ${s.caption}`);
  }
  return out;
}

/** Image indices past the end wrap around instead of failing the script. */
export function fitImages(script: AdScript, imageCount: number): AdScript {
  const n = Math.max(1, imageCount);
  return {
    ...script,
    hookImage: script.hookImage % n,
    scenes: script.scenes.map((s) => ({ ...s, image: s.image % n })),
  };
}
