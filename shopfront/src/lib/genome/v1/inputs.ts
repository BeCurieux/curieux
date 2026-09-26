/**
 * What the classifier sees, and the hash that says when it has changed.
 *
 * The model is shown one product and nothing else: not the rest of the
 * catalogue, and never another merchant's data (HANDOFF §6.1). It is not shown
 * the price either. Price bands are computed against references, never asked
 * of a model, and leaving price out of the input means a price change does not
 * trigger a five-run reclassification of something whose *use* did not change.
 *
 * `inputsHash` covers exactly these fields. The deterministic dimensions hash
 * their own inputs (price, stock, cost) separately, for the same reason.
 */

import { createHash } from "node:crypto";
import type { IngestedProduct } from "@/lib/ingest/types";
import { sizedImageUrl } from "@/lib/render/image";

export interface ClassifierInput {
  handle: string;
  title: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  /** Distinct variant option values, e.g. ["S", "M", "Navy"]. */
  options: string[];
  description: string;
  /** One image, sized down: enough to see what the thing is. Null when none. */
  imageUrl: string | null;
}

/** ~400px is what the model needs to tell a mug from a vase; it costs ~200 tokens. */
const IMAGE_WIDTH = 400;

/** Long descriptions are mostly shipping policy and care instructions. */
const DESCRIPTION_LIMIT = 1_500;

export function classifierInput(product: IngestedProduct, options: { images?: boolean } = {}): ClassifierInput {
  const optionValues = new Set<string>();
  for (const variant of product.variants) for (const value of variant.options) optionValues.add(value.trim());
  optionValues.delete("Default Title");
  optionValues.delete("");

  const firstImage = product.images[0]?.url;
  return {
    handle: product.handle,
    title: product.title.trim(),
    productType: product.productType?.trim() || null,
    vendor: product.vendor?.trim() || null,
    tags: [...new Set(product.tags.map((t) => t.trim()).filter(Boolean))].sort(),
    options: [...optionValues].sort(),
    description: product.description.trim().slice(0, DESCRIPTION_LIMIT),
    imageUrl: options.images === false || !firstImage || firstImage.startsWith("/") ? null : sizedImageUrl(firstImage, IMAGE_WIDTH),
  };
}

/** Stable across key order, so the same inputs always hash the same. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashOf(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 32);
}

export function inputsHash(input: ClassifierInput): string {
  return hashOf(input);
}
