/**
 * Shopify products → product rows, with the supplement detection attached.
 * Pure; the handler does the reading and the writing.
 */

import type { ShopifyProduct } from "../shopify/admin/products.js";
import type { ProductRow, ProductSummary } from "../server/store.js";
import { detectCategory } from "./detect.js";

export function toProductRow(product: ShopifyProduct): ProductRow {
  const detection = detectCategory(product);
  return {
    shopifyProductId: product.id,
    title: product.title,
    category: detection.category,
    categoryReason: detection.reason,
    raw: product,
    shopifyUpdatedAt: product.updatedAt,
  };
}

export type CatalogueSummary = {
  total: number;
  supplements: number;
  products: ProductSummary[];
};

export function summarise(products: ProductSummary[]): CatalogueSummary {
  return {
    total: products.length,
    supplements: products.filter((p) => p.category === "supplements").length,
    products,
  };
}
