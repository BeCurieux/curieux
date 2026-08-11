/**
 * Shopify cart permalinks.
 *
 * The brief is exact about this: "one tap → pre-filled Shopify checkout via
 * cart permalink. Do not promise fully on-page checkout." A permalink adds the
 * variant to the merchant's own cart and hands the shopper to a checkout that
 * Shopify owns — so the money, the tax, the fraud rules and the compliance all
 * stay where they already work.
 *
 * `/cart/<variantId>:<qty>` lands on the merchant's cart, pre-filled. It is not
 * literally the checkout page and this file does not pretend otherwise; that
 * distinction is the difference between a feature and a promise we cannot keep.
 *
 * The interesting decision is *when not to build one*. See `cartVariantId`.
 */

/** Shopify variant ids are numeric strings. Anything else is not a variant. */
const NUMERIC = /^\d+$/;

export interface PermalinkInput {
  /** The merchant's storefront origin, from the ingest. */
  storeUrl: string;
  variantId: string;
  quantity?: number;
  /** A code from the merchant's own prompt, never an invented one. */
  discount?: string;
}

/**
 * A cart permalink, or null when one would be a guess.
 *
 * Null is a normal answer and the caller falls back to the product page. A
 * permalink built on an id that is not a Shopify variant id is a 404 where a
 * purchase should be, which is strictly worse than one more tap.
 */
export function cartPermalink({ storeUrl, variantId, quantity = 1, discount }: PermalinkInput): string | null {
  if (!NUMERIC.test(variantId)) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;

  let base: URL;
  try {
    base = new URL(storeUrl);
  } catch {
    return null;
  }

  const url = new URL(`/cart/${variantId}:${quantity}`, base.origin);

  // Shopify applies this at checkout. It only ever comes from a code the
  // merchant wrote in their own brief — `validate.ts` rejects invented ones —
  // so a permalink can carry it without the page claiming anything.
  if (discount) url.searchParams.set("discount", discount);

  return url.toString();
}
