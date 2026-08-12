/**
 * The deterministic merchandiser.
 *
 * It does not pretend to merchandise. It reads the two constraints a regular
 * expression can honestly extract from a brief — a price cap and an in-stock
 * request — and assembles the most defensible default shop the ingest allows:
 * the brand's own words as the headline, products that have photographs, the
 * colourway read off the brand's own stylesheet, and no copy it cannot source.
 *
 * Three jobs. It makes the whole pipeline testable without a key or a network.
 * It gives the renderer in step 3 something to consume without a model call
 * per reload. And it is the baseline — if the model's shop is not obviously
 * better than this, the merchandising is not earning its cost.
 */

import type { IngestedProduct, IngestResult } from "@/lib/ingest/types";
import { contrastRatio, parseColour } from "@/lib/ingest/colour";
import type { MerchandisingPlan, PlannedBlock } from "./plan";
import type { GenerateRequest, GenerateResult, MerchandiseProvider } from "./provider";

const MAX_PRODUCTS = 8;

const SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  AUD: "$",
  CAD: "$",
  NZD: "$",
  JPY: "¥",
  INR: "₹",
};

export function createMockProvider(): MerchandiseProvider {
  return {
    name: "mock",
    async generate(request: GenerateRequest): Promise<GenerateResult> {
      return { plan: buildPlan(request.ingest, request.prompt), model: "mock" };
    },
  };
}

export function buildPlan(ingest: IngestResult, prompt: string): MerchandisingPlan {
  const cap = priceCapFrom(prompt);
  const inStockOnly = /\bin[- ]stock\b|\bexclude sold[- ]out\b|\bavailable only\b/i.test(prompt);

  const products = selectProducts(ingest.catalogue.products, { cap, inStockOnly });
  const blocks: { id: string; block: PlannedBlock }[] = [];

  const lead = products[0];
  blocks.push({
    id: "hero",
    block: {
      type: "hero",
      headline: headlineFor(ingest),
      ...(lead && lead.images.length > 0
        ? { media: { kind: "productImage" as const, handle: lead.handle, imageIndex: 0 } }
        : {}),
    },
  });

  if (products.length > 0) {
    blocks.push({
      id: "edit",
      block: {
        type: "productGrid",
        title: gridTitle(cap, ingest.catalogue.currency),
        products: products.map((product) => ({ handle: product.handle })),
        layout: products.length >= 4 ? "grid" : "stack",
      },
    });
  }

  const links = ingest.brand.links.slice(0, 6);
  if (links.length > 0) {
    blocks.push({
      id: "links",
      block: { type: "linkList", links: links.map((link) => ({ label: clip(link.label, 40), url: link.url })) },
    });
  }

  return {
    audience: clip(prompt.replace(/\s+/g, " ").trim(), 200),
    theme: {
      colorway: legibleColorway(ingest),
      typography: "editorial-serif",
      mood: "editorial",
      density: "regular",
      cornerRadius: "soft",
    },
    blocks,
  };
}

/**
 * Products with photographs first, then catalogue order.
 *
 * Sold-out products are not filtered out — they are shown and marked by the
 * renderer, and dropping them here would make that impossible downstream.
 * They only leave when the brief actually asked for in-stock only.
 */
function selectProducts(
  all: IngestedProduct[],
  { cap, inStockOnly }: { cap: number | null; inStockOnly: boolean },
): IngestedProduct[] {
  const eligible = all.filter((product) => {
    if (cap !== null && product.price.min > cap) return false;
    if (inStockOnly && product.availabilityKnown && !product.available) return false;
    return true;
  });

  const withImages = eligible.filter((p) => p.images.length > 0);
  const withoutImages = eligible.filter((p) => p.images.length === 0);
  return [...withImages, ...withoutImages].slice(0, MAX_PRODUCTS);
}

/**
 * The brand's own line, or its name.
 *
 * The tagline is checked before it is used: an ingested tagline carrying a
 * price or a sync claim would fail validation, and the mock's contract is that
 * it always produces a valid plan.
 */
function headlineFor(ingest: IngestResult): string {
  const tagline = ingest.brand.tagline;
  const usable =
    tagline &&
    tagline.length <= 80 &&
    !/[$£€¥₹]\s?\d|\b\d[\d,.]*\s?(USD|GBP|EUR)\b/i.test(tagline) &&
    !/\bsync|\breal-?time|\d\s*(reviews?|stars?)/i.test(tagline);
  return usable ? tagline : clip(ingest.brand.name, 80);
}

function gridTitle(cap: number | null, currency: string | null): string {
  // No currency means no symbol may appear anywhere in copy, and "Under 80" is
  // a number without a unit — which is worse than not making the claim.
  if (cap === null || !currency) return "The edit";
  const symbol = SYMBOLS[currency] ?? "";
  return symbol ? clip(`Under ${symbol}${cap}`, 60) : "The edit";
}

function priceCapFrom(prompt: string): number | null {
  // "nothing over £80" is a cap; a bare "over £80" is the opposite, so the
  // negation has to be part of the match rather than the word "over" alone.
  const match =
    /(?:under|below|less than|up to|no more than|(?:nothing|none|nowt)\s+(?:over|above))\s*[$£€¥₹]?\s?(\d[\d,]*(?:\.\d{1,2})?)/i.exec(
      prompt,
    );
  if (!match?.[1]) return null;
  const value = Number.parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function legibleColorway(ingest: IngestResult): MerchandisingPlan["theme"]["colorway"] {
  const colorway = { ...ingest.brand.suggestedColorway };
  const background = parseColour(colorway.background);
  const text = parseColour(colorway.text);
  if (!background || !text || contrastRatio(text, background) < 4.5) {
    return { background: "#ffffff", surface: "#f4f4f4", text: "#111111", accent: "#111111" };
  }
  const accent = parseColour(colorway.accent);
  if (!accent || contrastRatio(accent, background) < 3) colorway.accent = colorway.text;
  return colorway;
}

function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
