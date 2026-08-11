/**
 * The deterministic catalogue read.
 *
 * No key, no network, no cost, and it always validates. It exists for the same
 * three reasons the merchandiser's mock does: the pipeline has to be testable
 * end to end, the merchandiser needs a Genome to consume without a model call
 * per run, and there has to be a baseline to judge the real read against. If the
 * model's relationship graph is not obviously better than tag overlap, the pass
 * is not earning its cost.
 *
 * It infers from structure only — product type, tags, shared vocabulary in
 * titles. It never writes a sentence it cannot source, which is why every
 * `problemSolved` here is visibly mechanical. That is the honest shape of what a
 * heuristic knows, and dressing it up would make the baseline flattering.
 */

import type { IngestedProduct } from "@/lib/ingest/types";
import type { GenomeProvider, GenomeRequest, GenomeResult } from "./provider";
import type { Confidence, ProductInference, ProductRole } from "./types";

export function createMockGenomeProvider(products: IngestedProduct[]): GenomeProvider {
  return {
    name: "mock",
    async read(_request: GenomeRequest): Promise<GenomeResult> {
      return { inference: readCatalogue(products), model: "mock" };
    },
  };
}

export function readCatalogue(products: IngestedProduct[]): {
  catalogueRead: string;
  products: ProductInference[];
} {
  const types = new Set(products.map((product) => product.productType).filter((t): t is string => Boolean(t)));
  const catalogueRead = types.size
    ? `A catalogue of ${products.length} products across ${[...types].slice(0, 5).join(", ")}.`
    : `A catalogue of ${products.length} products.`;

  return {
    catalogueRead,
    products: products.map((product) => infer(product, products)),
  };
}

function infer(product: IngestedProduct, all: IngestedProduct[]): ProductInference {
  const siblings = all.filter((other) => other.handle !== product.handle);

  // Same product type is the closest thing to "the same decision" that
  // structure alone can tell you. Sorted by price distance, because two coats
  // at similar prices substitute more readily than a coat and a scarf.
  const substitutes = siblings
    .filter((other) => other.productType && other.productType === product.productType)
    .sort((a, b) => Math.abs(a.price.min - product.price.min) - Math.abs(b.price.min - product.price.min))
    .slice(0, 3)
    .map((other) => other.handle);

  const substituteSet = new Set(substitutes);

  // Shared tags across *different* types is the weakest defensible signal for
  // "used together" — a wool jumper and a wool throw share a material and a
  // customer without being the same purchase.
  const tags = new Set(product.tags.map(normalise));
  const complements = siblings
    .filter((other) => !substituteSet.has(other.handle))
    .filter((other) => other.productType !== product.productType)
    .map((other) => ({ other, shared: other.tags.map(normalise).filter((tag) => tags.has(tag)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3)
    .map(({ other }) => other.handle);

  return {
    handle: product.handle,
    problemSolved: product.productType
      ? `A ${product.productType.toLowerCase()} from this catalogue.`
      : "A product from this catalogue.",
    audience: "Not inferred without a model pass.",
    occasions: [],
    role: role(product, all),
    giftability: "medium",
    complements,
    substitutes,
    confidence: confidence(product),
  };
}

/**
 * Photography and price, which is all structure can say about whether something
 * can lead a page. A product with several large images and a price at the top of
 * the catalogue is the store's own bet; a product with one small image is not.
 */
function role(product: IngestedProduct, all: IngestedProduct[]): ProductRole {
  const prices = all.map((p) => p.price.min).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)] ?? 0;

  if (product.images.length === 0) return "add-on";
  if (product.images.length >= 3 && product.price.min >= median) return "hero";
  if (product.price.min < median / 2) return "add-on";
  return "supporting";
}

function confidence(product: IngestedProduct): Confidence {
  // A heuristic never has more than a low-confidence read of what something is
  // for, and saying "medium" would be the baseline flattering itself.
  return product.description.trim().length > 80 ? "medium" : "low";
}

function normalise(tag: string): string {
  return tag.trim().toLowerCase();
}
