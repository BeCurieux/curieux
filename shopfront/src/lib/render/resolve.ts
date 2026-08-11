/**
 * `ProductRef` + the catalogue -> what actually goes on the card.
 *
 * The one line in `schema.ts` that this file exists to honour: "the renderer
 * resolves them at render time so live data (price, availability) always
 * wins." A `ShopConfig` holds handles and merchandising decisions. It holds no
 * prices, no stock, no image URLs — so a shop published in March and opened in
 * June shows June's prices, and a product that sold out in between shows as
 * sold out without anyone regenerating anything.
 *
 * A reference to a product that has left the catalogue resolves to null and is
 * dropped from the page. That is the correct behaviour and it is worth being
 * deliberate about: the alternative is a card that 404s, and a dead card is
 * worse for the merchant than a shorter page.
 */

import type { Catalogue, IngestedImage, IngestedProduct, IngestedVariant } from "@/lib/ingest/types";
import type { ProductRef } from "@/lib/schema";
import type { z } from "zod";

type Ref = z.infer<typeof ProductRef>;

export interface ResolvedProduct {
  handle: string;
  title: string;
  url: string;
  /** The AI's one-liner for this card, if it wrote one. */
  blurb?: string;
  /** The lead image, honouring `leadImageIndex` and a pinned variant's own photo. */
  image?: IngestedImage;
  images: IngestedImage[];
  price: number;
  /** Only when the store is actually running a sale on it. */
  compareAtPrice?: number;
  /** True when a pinned variant did not fix the price and the range is real. */
  priceVaries: boolean;
  available: boolean;
  /** False when the surface we ingested from never reported stock at all. */
  availabilityKnown: boolean;
  variant?: IngestedVariant;
  /**
   * The variant a cart permalink may pre-fill, when there is exactly one right
   * answer. See `chooseCartVariant` — the absence of this is a decision, not a
   * gap.
   */
  cartVariantId?: string;
}

export function resolveProduct(ref: Ref, catalogue: Catalogue): ResolvedProduct | null {
  const product = catalogue.products.find((candidate) => candidate.handle === ref.handle);
  if (!product) return null;

  const variant = ref.variantId ? product.variants.find((v) => v.id === ref.variantId) : undefined;
  const image = leadImage(product, ref, variant);
  const cartVariant = chooseCartVariant(product, variant);

  const price = variant ? variant.price : product.price.min;
  const compareAt = variant?.compareAtPrice ?? bestCompareAt(product);

  return {
    handle: product.handle,
    title: product.title,
    url: product.url,
    ...(ref.blurb ? { blurb: ref.blurb } : {}),
    ...(image ? { image } : {}),
    images: product.images,
    price,
    ...(compareAt !== undefined && compareAt > price ? { compareAtPrice: compareAt } : {}),
    priceVaries: !variant && product.price.min !== product.price.max,
    available: variant ? variant.available : product.available,
    availabilityKnown: product.availabilityKnown,
    ...(variant ? { variant } : {}),
    ...(cartVariant ? { cartVariantId: cartVariant } : {}),
  };
}

/**
 * Which variant a "buy" link may pre-fill — and, mostly, none.
 *
 * A pinned variant is unambiguous: the plan chose it and the card shows its
 * price. A product with a single variant is equally unambiguous, because there
 * is nothing to choose.
 *
 * A product with sizes is neither. Pre-filling a cart with the medium because
 * it happened to be first sends somebody to a checkout holding the wrong thing,
 * and the shopper who does not notice is the expensive case — a return, and a
 * merchant who blames the shop that did it. So a multi-variant product links to
 * its own product page and lets the person choose, which costs one tap.
 */
function chooseCartVariant(product: IngestedProduct, variant: IngestedVariant | undefined): string | undefined {
  if (variant) return variant.id;
  if (product.variants.length === 1) return product.variants[0]!.id;
  return undefined;
}

export function resolveAll(refs: Ref[], catalogue: Catalogue): ResolvedProduct[] {
  return refs.map((ref) => resolveProduct(ref, catalogue)).filter((p): p is ResolvedProduct => p !== null);
}

/**
 * Which photograph leads.
 *
 * A pinned variant's own image beats the merchandiser's index: if the plan
 * pinned the sage colourway, showing the oatmeal photo next to the sage price
 * is a worse error than ignoring an art-direction preference. An out-of-range
 * index falls back rather than blanking the card — the validator rejects those
 * at generation time, but a catalogue can lose an image after publication.
 */
function leadImage(product: IngestedProduct, ref: Ref, variant: IngestedVariant | undefined): IngestedImage | undefined {
  if (variant?.imageUrl) {
    const match = product.images.find((image) => image.url === variant.imageUrl);
    if (match) return match;
    return { url: variant.imageUrl };
  }
  if (ref.leadImageIndex !== undefined) {
    const chosen = product.images[ref.leadImageIndex];
    if (chosen) return chosen;
  }
  return product.images[0];
}

/** The lowest compare-at across variants, so a sale reads as a sale. */
function bestCompareAt(product: IngestedProduct): number | undefined {
  const values = product.variants.map((v) => v.compareAtPrice).filter((v): v is number => v !== undefined);
  return values.length > 0 ? Math.min(...values) : undefined;
}

/**
 * The shopper's stock state, as three cases rather than two.
 *
 * `unknown` exists because some ingest surfaces never report availability.
 * Showing "in stock" there would be a claim nobody checked, and showing "sold
 * out" would cost the merchant a sale — so it shows nothing at all.
 */
export type StockState = "available" | "sold-out" | "unknown";

export function stockState(product: ResolvedProduct): StockState {
  if (!product.availabilityKnown) return "unknown";
  return product.available ? "available" : "sold-out";
}
