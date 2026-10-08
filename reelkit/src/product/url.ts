/**
 * What kind of link did the seller paste?
 *
 * Shopify is recognised by path, not host: most Shopify stores run on their
 * own domain, and `/products/<handle>` is the shape every one of them shares.
 * The `.json` twin of that path is public on every Shopify store and is the
 * most reliable source we have — structured, complete, and no HTML to guess at.
 */

export type LinkKind =
  | { kind: "shopify"; url: URL; handle: string; jsonUrl: string }
  | { kind: "etsy"; url: URL; listingId: string }
  | { kind: "page"; url: URL };

export class BadLink extends Error {}

export function parseLink(raw: string): LinkKind {
  let input = raw.trim();
  if (!input) throw new BadLink("Paste a link to one of your product pages.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) input = `https://${input}`;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BadLink("That doesn't look like a web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BadLink("Only web links (https://…) can be imported.");
  }
  url.hash = "";

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "etsy.com" || host.endsWith(".etsy.com")) {
    const m = url.pathname.match(/\/listing\/(\d+)/);
    if (!m?.[1]) {
      throw new BadLink(
        "That's an Etsy link, but not to a single listing. Open the product and copy its link.",
      );
    }
    return { kind: "etsy", url, listingId: m[1] };
  }

  // Collection-scoped product URLs (/collections/x/products/y) are the same
  // product, and so are localised ones (/en-gb/products/y).
  const shop = url.pathname.match(/\/products\/([^/?#.]+)/);
  if (shop?.[1]) {
    const json = new URL(url.origin);
    json.pathname = `/products/${shop[1]}.json`;
    return { kind: "shopify", url, handle: shop[1], jsonUrl: json.toString() };
  }

  return { kind: "page", url };
}
