/**
 * A product, as much of it as an ad needs and nothing it does not.
 *
 * Every field here is something the seller wrote on their own listing. The ad
 * writer is only ever allowed to say what is in this object, so anything that
 * is not here — a review count, a material, a shipping promise — is something
 * the ad cannot claim.
 */

export type ProductSource = "shopify" | "etsy" | "page" | "manual";

export type Price = {
  /** As the store wrote it, e.g. "24.00". Never re-rounded. */
  amount: string;
  /** ISO 4217. A price without a currency is not shown at all: a "$" on a
   *  pound-sterling listing is worse than no price. */
  currency: string;
};

export type Product = {
  source: ProductSource;
  /** The listing the seller pasted, after redirects. Absent for manual entry. */
  url?: string;
  title: string;
  /** Plain text, paragraphs separated by blank lines. */
  description: string;
  price?: Price;
  /** Shop or brand name, when the listing names one. */
  shop?: string;
  /** Original image URLs, best first. */
  images: string[];
};

export const MAX_DESCRIPTION_CHARS = 4000;
export const MAX_IMAGES = 8;
