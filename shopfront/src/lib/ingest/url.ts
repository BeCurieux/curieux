import { IngestError } from "./types";

/**
 * A store URL as a merchant would type it into a DM: "allbirds.com",
 * "www.allbirds.com/", "https://shop.example.com/collections/all".
 *
 * All three mean the same thing to us — the storefront origin. Paths are
 * dropped rather than honoured: someone pasting a collection URL is telling
 * us which store, not which subset, and the merchandiser wants the whole
 * catalogue to select from.
 */
export function normaliseStoreUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new IngestError("bad-url", "No store URL given.");

  // A bare host has no scheme. Prepending https rather than trying http first
  // is deliberate: every Shopify storefront is https, and an http attempt is
  // one extra redirect on every single ingest.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new IngestError("bad-url", `Not a URL: ${input}`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new IngestError("bad-url", `Unsupported scheme: ${url.protocol}`);
  }
  if (!url.hostname.includes(".")) {
    throw new IngestError("bad-url", `Not a public hostname: ${url.hostname}`);
  }

  // Credentials in a store URL are somebody's mistake; carrying them into
  // logs and cache filenames would be ours.
  const origin = new URL(`${url.protocol}//${url.hostname.toLowerCase()}`);
  if (url.port) origin.port = url.port;
  return origin;
}

/** Resolve a possibly-relative URL found in HTML. Returns undefined if it isn't usable. */
export function absoluteUrl(href: string | undefined, base: URL | string): string | undefined {
  if (!href) return undefined;
  const raw = href.trim();
  // Protocol-relative and data URIs both show up in real theme markup.
  if (!raw || raw.startsWith("data:") || raw.startsWith("javascript:")) return undefined;
  try {
    const resolved = new URL(raw, base);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}

/** A filesystem-safe key for caching one store's ingest. */
export function storeCacheKey(storeUrl: URL): string {
  return storeUrl.host.replace(/[^a-z0-9.-]/gi, "_");
}

/**
 * The handle out of a Shopify product URL, ignoring collection prefixes and
 * query strings: /collections/new/products/wool-runner?variant=1 -> wool-runner
 */
export function productHandleFromUrl(href: string): string | undefined {
  let path: string;
  try {
    path = new URL(href, "https://example.com").pathname;
  } catch {
    return undefined;
  }
  const match = /\/products\/([^/?#]+)/.exec(path);
  if (!match?.[1]) return undefined;
  const handle = decodeURIComponent(match[1]).toLowerCase();
  return handle && handle !== "products" ? handle : undefined;
}
