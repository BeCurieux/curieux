/**
 * The only file in the product importer that touches the network.
 *
 * Everything it calls is pure and every dependency is injected, so the test
 * suite runs offline and never depends on somebody's store being up.
 */

import { assertPublicUrl, type Lookup } from "./guard.js";
import {
  finish,
  fromEtsyApi,
  fromHtml,
  fromShopifyJson,
  mergeShopify,
  type Partial,
} from "./parse.js";
import type { Product } from "./types.js";
import { parseLink } from "./url.js";

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export type ImportDeps = {
  transport: Transport;
  lookup: Lookup;
  /** Etsy Open API v3 key, as `keystring:shared_secret`. Etsy refuses most
   *  server requests for listing pages, so without this an Etsy import
   *  usually falls back to manual entry. */
  etsyKey?: string;
  /** Says who we are. Stores can block a named agent; they cannot ask one
   *  that hides its name to stop. */
  agent?: string;
};

export const AGENT = "ReelkitBot/0.1 (product import for the store's own seller)";
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;

/** Import failed in a way the seller can act on. `manual` means: offer the
 *  form where they type the details and upload photos themselves. */
export class ImportFailed extends Error {
  constructor(
    message: string,
    readonly manual = true,
  ) {
    super(message);
  }
}

type Got = { status: number; finalUrl: string; body: string };

async function get(url: string, accept: string, deps: ImportDeps, headers: Record<string, string> = {}): Promise<Got> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current, deps.lookup);
    const res = await deps.transport(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": deps.agent ?? AGENT, accept, ...headers },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { status: res.status, finalUrl: current, body: "" };
      current = new URL(next, current).toString();
      continue;
    }
    return { status: res.status, finalUrl: current, body: await readCapped(res) };
  }
  throw new ImportFailed("That link redirects too many times.", false);
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const settle = <T,>(p: Promise<T>) => p.then((v) => v, () => null);

function json(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function importProduct(raw: string, deps: ImportDeps): Promise<Product> {
  const link = parseLink(raw);

  if (link.kind === "shopify") {
    const [j, page] = await Promise.all([
      settle(get(link.jsonUrl, "application/json", deps)),
      settle(get(link.url.toString(), "text/html", deps)),
    ]);
    const fromJson = j && j.status === 200 ? fromShopifyJson(json(j.body), link.url.toString()) : null;
    const fromPage = page && page.status === 200 ? fromHtml(page.body, page.finalUrl) : null;
    const merged = mergeShopify(fromJson, fromPage);
    const product = merged && finish("shopify", page?.finalUrl ?? link.url.toString(), merged);
    if (product) return product;
    throw new ImportFailed(
      j?.status === 404 || page?.status === 404
        ? "That product page wasn't found. Is it published, and is the link complete?"
        : "We couldn't read that product page. You can add the details yourself below.",
    );
  }

  if (link.kind === "etsy") {
    if (deps.etsyKey) {
      const id = link.listingId;
      const headers = { "x-api-key": deps.etsyKey };
      const [listing, images] = await Promise.all([
        settle(get(`https://openapi.etsy.com/v3/application/listings/${id}`, "application/json", deps, headers)),
        settle(get(`https://openapi.etsy.com/v3/application/listings/${id}/images`, "application/json", deps, headers)),
      ]);
      if (listing?.status === 200) {
        const partial = fromEtsyApi(json(listing.body), images?.status === 200 ? json(images.body) : null);
        const product = partial && finish("etsy", link.url.toString(), partial);
        if (product) return product;
      }
      if (listing?.status === 404) {
        throw new ImportFailed("Etsy says that listing doesn't exist, or it isn't active.");
      }
    }
    const page = await settle(get(link.url.toString(), "text/html", deps));
    const partial: Partial | null = page && page.status === 200 ? fromHtml(page.body, page.finalUrl) : null;
    const product = partial && finish("etsy", link.url.toString(), partial);
    if (product) return product;
    throw new ImportFailed(
      "Etsy didn't let us read that listing (it often blocks automated visits). Add your photos and description below instead — it takes a minute.",
    );
  }

  const page = await settle(get(link.url.toString(), "text/html", deps));
  if (!page) throw new ImportFailed("We couldn't reach that page. Check the link, or add the details yourself below.");
  if (page.status !== 200) {
    throw new ImportFailed(`That page answered with an error (${page.status}). Add the details yourself below.`);
  }
  const partial = fromHtml(page.body, page.finalUrl);
  const product = partial && finish("page", page.finalUrl, partial);
  if (product) return product;
  throw new ImportFailed("We couldn't find a product on that page. Add the details yourself below.");
}
