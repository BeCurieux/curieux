/**
 * Prices, in the shop's own currency, or without one.
 *
 * The awkward case is the one that matters. When the storefront never declared
 * a currency the ingester leaves it null, and the temptation here is to reach
 * for a dollar sign because a bare number looks unfinished. That would print a
 * price in the wrong currency on a real merchant's page — so a bare number is
 * what gets printed, and it is the honest thing.
 */

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "HUF"]);

export function formatMoney(amount: number, currency: string | null, locale = "en"): string {
  if (!currency) return trimZeros(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits(amount, currency),
      maximumFractionDigits: fractionDigits(amount, currency),
    }).format(amount);
  } catch {
    // An unrecognised ISO code is still better shown than swallowed.
    return `${trimZeros(amount)} ${currency}`;
  }
}

/**
 * Whole prices lose their decimals; £148 reads better than £148.00 on a card,
 * and a catalogue of round numbers should not look like a spreadsheet.
 */
function fractionDigits(amount: number, currency: string): number {
  if (ZERO_DECIMAL.has(currency.toUpperCase())) return 0;
  return Number.isInteger(amount) ? 0 : 2;
}

function trimZeros(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** "from £18" — used when a price range is real and no variant was pinned. */
export function formatFrom(amount: number, currency: string | null, locale = "en"): string {
  return `from ${formatMoney(amount, currency, locale)}`;
}
