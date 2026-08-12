/**
 * The two Genome fields a model must not be asked for.
 *
 * Both are questions about measurements rather than about language, and a model
 * answering them produces confident nonsense — every £200 product reads as
 * "premium" right up until you notice the store's cheapest thing is £180.
 * Computing them here also means they are the same numbers every time, for free,
 * and auditable after the fact.
 */

import type { Catalogue, IngestedProduct } from "@/lib/ingest/types";
import type { PhotographyRead, PriceBands, PriceTier } from "./types";

/**
 * Price tier, relative to this store and no other.
 *
 * Quantiles of the catalogue's own prices, not absolute thresholds: "premium"
 * for a £14 tea towel in a homewares store and for a £900 coat in a tailor's are
 * both correct, and any fixed band would get one of them wrong. Below four
 * distinct prices there is no distribution to speak of, so everything is `core`
 * — an honest "we cannot tell" rather than a split of three products into four
 * tiers.
 */
export function computePriceBands(catalogue: Catalogue): PriceBands {
  const prices = catalogue.products
    .map((product) => product.price.min)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  const distinct = new Set(prices).size;
  if (prices.length < 4 || distinct < 4) {
    return { entryBelow: null, coreBelow: null, premiumBelow: null, sampled: prices.length };
  }

  return {
    entryBelow: quantile(prices, 0.25),
    coreBelow: quantile(prices, 0.6),
    premiumBelow: quantile(prices, 0.9),
    sampled: prices.length,
  };
}

export function priceTierFor(product: IngestedProduct, bands: PriceBands): PriceTier {
  if (bands.entryBelow === null || bands.coreBelow === null || bands.premiumBelow === null) return "core";
  const price = product.price.min;
  if (price < bands.entryBelow) return "entry";
  if (price < bands.coreBelow) return "core";
  if (price < bands.premiumBelow) return "premium";
  return "flagship";
}

/** Linear interpolation between the two nearest ranks. */
function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower]!;
  if (lower === upper) return round(low);
  return round(low + (sorted[upper]! - low) * (position - lower));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The shortest side the card plate actually asks for on a 3× phone.
 *
 * `CARD_WIDTHS` in render/image.ts tops out around 720 for a two-up grid; below
 * roughly 500px on the short side a photograph is being upscaled into the plate,
 * which is visible and is exactly the "mediocre photography" the renderer is
 * meant to flatter rather than magnify.
 */
const MIN_USABLE_SHORT_SIDE = 500;
const COMFORTABLE_SHORT_SIDE = 900;

/** Beyond this the crop to a 4:5 or 1:1 plate throws away most of the frame. */
const EXTREME_RATIO = 2.2;

/**
 * How well this product's imagery will survive the renderer.
 *
 * Deliberately not an aesthetic judgement — we never fetch the pixels, and a
 * flag that claimed to know a photograph was ugly would be inventing. This reads
 * count, resolution and shape, which is all the ingest actually measured, and
 * says which of those it could not measure.
 */
export function readPhotography(product: IngestedProduct): PhotographyRead {
  const images = product.images;
  const notes: string[] = [];

  if (images.length === 0) {
    return {
      rating: "none",
      imageCount: 0,
      dimensionsKnown: false,
      notes: ["No image in the catalogue — the renderer draws an initial plate instead."],
    };
  }

  const measured = images.filter((image) => image.width !== undefined && image.height !== undefined);
  const dimensionsKnown = measured.length > 0;

  const lead = measured[0];
  const shortSide = lead ? Math.min(lead.width!, lead.height!) : undefined;
  const ratio = lead ? Math.max(lead.width!, lead.height!) / Math.min(lead.width!, lead.height!) : undefined;

  if (shortSide !== undefined && shortSide < MIN_USABLE_SHORT_SIDE) {
    notes.push(`Lead image is ${lead!.width}×${lead!.height}; the card upscales anything under ${MIN_USABLE_SHORT_SIDE}px.`);
  }
  if (ratio !== undefined && ratio > EXTREME_RATIO) {
    notes.push(`Lead image is ${ratio.toFixed(1)}:1; cropping to the plate ratio will discard most of the frame.`);
  }
  if (images.length === 1) {
    notes.push("Only one image, so there is no alternative if it crops badly.");
  }
  if (!dimensionsKnown) {
    // The same discipline as `availabilityKnown` on the catalogue: not measured
    // is not the same as measured and found wanting.
    notes.push("Image dimensions were not reported by the ingest surface, so resolution is unknown.");
  }

  return { rating: rate({ count: images.length, shortSide, ratio, dimensionsKnown }), imageCount: images.length, dimensionsKnown, notes };
}

function rate({
  count,
  shortSide,
  ratio,
  dimensionsKnown,
}: {
  count: number;
  shortSide: number | undefined;
  ratio: number | undefined;
  dimensionsKnown: boolean;
}): PhotographyRead["rating"] {
  if (shortSide !== undefined && shortSide < MIN_USABLE_SHORT_SIDE) return "weak";
  if (ratio !== undefined && ratio > EXTREME_RATIO) return "weak";

  // Unmeasured imagery caps out at "adequate". Calling it strong would be
  // asserting a resolution nobody read, and the merchandiser leans on `strong`
  // to pick a hero.
  if (!dimensionsKnown) return count >= 2 ? "adequate" : "weak";

  if (shortSide !== undefined && shortSide >= COMFORTABLE_SHORT_SIDE && count >= 3) return "strong";
  if (shortSide !== undefined && shortSide >= COMFORTABLE_SHORT_SIDE) return "adequate";
  return "adequate";
}
