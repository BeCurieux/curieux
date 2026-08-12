/**
 * The claims no generated text may make, wherever it was generated.
 *
 * These started in the merchandiser's validator. They live here because the
 * Genome is a second place a model writes prose, and prose written for internal
 * use has a way of becoming prose on a page — a Genome that says "the £48 serum"
 * is a price the merchandiser can echo without inventing anything itself. Two
 * copies of these rules would drift, and the failure mode of drift is a claim
 * getting through.
 *
 * Each rule carries its own reason, because the reason is what gets sent back
 * to the model on a retry and "banned pattern 3" fixes nothing.
 */

export interface Claim {
  pattern: RegExp;
  why: string;
}

export const BANNED_CLAIMS: Claim[] = [
  {
    pattern: /\b(synced?|syncing|in sync|auto-?updat\w*|always up to date|live inventory|real-?time|updates? automatically)\b/i,
    why: "claims the shop syncs with the store. It does not yet — nothing on the page may say it does",
  },
  {
    pattern: /(\b\d[\d,.]*\s*(reviews?|ratings?|five-?star)\b)|(\b\d(\.\d)?\s*stars?\b)|(★)|(\brated\s+\d)/i,
    why: "states review or rating data. No review data was ingested for this store",
  },
  {
    pattern: /\b(only \d+ left|selling fast|almost gone|nearly sold out|limited stock|\d+ in stock|back in stock)\b/i,
    why: "states a stock level. Stock is resolved live by the renderer and must not appear in copy",
  },
];

/** A currency amount: $24, £1,299.00, 40 USD. */
const MONEY = /(?:[$£€¥₹]\s?\d[\d,]*(?:\.\d{1,2})?)|(?:\b\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|GBP|EUR|AUD|CAD|NZD|JPY)\b)/gi;

/** A threshold the merchant asked for, rather than a price we are asserting. */
const THRESHOLD = /(under|below|beneath|over|above|from|up to|less than|starting at|no more than)\s*$/i;

/**
 * Currency amounts that are being asserted rather than quoted as a limit.
 *
 * "under £80" is the merchant's own constraint and is allowed to appear.
 * "£80" on its own is a price, and prices are the renderer's to resolve at the
 * moment the page loads — one written into copy is wrong from the first time
 * the merchant runs a sale.
 */
export function unqualifiedAmounts(text: string): string[] {
  const out: string[] = [];
  MONEY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MONEY.exec(text))) {
    const before = text.slice(Math.max(0, match.index - 24), match.index);
    if (!THRESHOLD.test(before.trimEnd() + " ")) out.push(match[0]);
  }
  return out;
}
