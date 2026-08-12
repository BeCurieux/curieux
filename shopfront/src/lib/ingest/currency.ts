/**
 * Which currency the prices are in.
 *
 * `/products.json` gives numbers with no unit, which is the single most
 * dangerous omission in the whole feed: a shop priced in NZD rendered with a
 * `$` and read as USD misrepresents every product on the page. So currency is
 * detected from the storefront's own declarations, and when none of them are
 * present it stays `null` and the renderer shows the number without a symbol
 * rather than picking one.
 */

import { extractJsonLd, extractMeta, jsonLdOfType } from "./html";

const ISO_4217 = /^[A-Z]{3}$/;

export function detectCurrency(html: string): string | null {
  // 1. The Shopify runtime's own object. Present on essentially every theme
  //    and set by the platform rather than by the theme author.
  const runtime =
    /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/.exec(html) ??
    /"currency"\s*:\s*"([A-Z]{3})"/.exec(html) ??
    /"currencyCode"\s*:\s*"([A-Z]{3})"/.exec(html);
  if (runtime?.[1] && ISO_4217.test(runtime[1])) return runtime[1];

  // 2. Open Graph product tags, set by the theme's product template.
  const meta = extractMeta(html);
  const tagged = meta.first("product:price:currency", "og:price:currency", "pricecurrency");
  if (tagged && ISO_4217.test(tagged.toUpperCase())) return tagged.toUpperCase();

  // 3. JSON-LD offers.
  for (const node of jsonLdOfType(extractJsonLd(html), "Product", "Offer", "AggregateOffer")) {
    const found = currencyFromOffers(node);
    if (found) return found;
  }

  return null;
}

function currencyFromOffers(node: Record<string, unknown>): string | null {
  const direct = node["priceCurrency"];
  if (typeof direct === "string" && ISO_4217.test(direct.toUpperCase())) return direct.toUpperCase();

  const offers = node["offers"];
  for (const offer of Array.isArray(offers) ? offers : [offers]) {
    if (!offer || typeof offer !== "object") continue;
    const currency = (offer as Record<string, unknown>)["priceCurrency"];
    if (typeof currency === "string" && ISO_4217.test(currency.toUpperCase())) return currency.toUpperCase();
  }
  return null;
}
