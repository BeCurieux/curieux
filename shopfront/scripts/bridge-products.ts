#!/usr/bin/env tsx
/**
 * pnpm tsx scripts/bridge-products.ts <store-url> <products.json>
 *
 * A catalogue that arrived by hand instead of over the wire.
 *
 * The ingester fetches `/products.json` itself and that is the only way this
 * should normally happen. But a machine with no route to the store still needs
 * to be able to run everything downstream of the fetch — the merchandiser, the
 * renderer, the whole shape of the output — against a real merchant's real
 * products rather than against a fixture written to flatter them.
 *
 * So this takes a saved `/products.json` and writes the ingest cache entry the
 * fetch would have written. It normalises through `parseProductList`, the same
 * function the real ladder calls, and validates the result against
 * `IngestResult` before writing: a bridge that produced a subtly different
 * shape would send every bug downstream and blame the merchandiser.
 *
 * What it cannot do is the homepage half of an ingest. Brand name, palette,
 * voice and links come from the storefront's HTML, and there is none here, so
 * those fields are left honestly thin rather than invented. The merchandiser
 * chooses theme tokens anyway; what it will not have is the store's own
 * colours to choose from, and a shop generated this way should be read with
 * that in mind.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseProductList } from "@/lib/ingest/products";
import { normaliseStoreUrl, storeCacheKey } from "@/lib/ingest/url";
import { IngestResult } from "@/lib/ingest/types";

const [rawUrl, file] = process.argv.slice(2);
if (!rawUrl || !file) {
  process.stderr.write("Usage: tsx scripts/bridge-products.ts <store-url> <products.json>\n");
  process.exit(2);
}

const storeUrl = normaliseStoreUrl(rawUrl);
const payload = JSON.parse(await readFile(file, "utf8")) as unknown;
const products = parseProductList(payload, { storeUrl });

if (products.length === 0) {
  process.stderr.write("No products parsed. Is this a /products.json payload?\n");
  process.exit(1);
}

/** The store's name, from the vendor field the products already carry. */
const vendor = (payload as { products?: { vendor?: string }[] }).products?.find((p) => p.vendor)?.vendor;
const name = vendor ? vendor.charAt(0).toUpperCase() + vendor.slice(1) : storeUrl.hostname;

const result = IngestResult.parse({
  store: {
    inputUrl: rawUrl,
    storeUrl: storeUrl.origin,
    platform: "shopify",
    catalogueSource: "products.json",
    ingestedAt: new Date().toISOString(),
  },
  brand: {
    name,
    storeUrl: storeUrl.origin,
    palette: [],
    // Neutral, and deliberately not a guess at their brand. The homepage is
    // where colour comes from and this bridge never saw one.
    suggestedColorway: { background: "#FFFFFF", surface: "#F4F4F5", text: "#18181B", accent: "#18181B" },
    voice: { headings: [], sentences: [], navLabels: [], buttonLabels: [] },
    links: [],
    socialLinks: [],
  },
  catalogue: {
    currency: null,
    products,
    productCount: products.length,
    truncated: false,
  },
  reviews: {
    available: false,
    platformDetected: null,
    note: "Bridged from a saved products.json; no homepage was read.",
  },
  diagnostics: {
    warnings: ["Catalogue bridged from a file. Brand context (name, colours, voice, links) was not ingested."],
    trace: [{ step: "bridge", outcome: "ok", detail: `${products.length} products from ${path.basename(file)}` }],
  },
});

const out = path.join(".cache", "ingest", `${storeCacheKey(storeUrl)}.json`);
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(result, null, 2));

const sold = products.filter((p) => !p.available).length;
process.stdout.write(`${out}\n`);
process.stdout.write(`  ${products.length} products, ${sold} unavailable\n`);
for (const product of products) {
  const price = product.price.min === product.price.max ? `${product.price.min}` : `${product.price.min}–${product.price.max}`;
  process.stdout.write(`  ${product.available ? " " : "×"} ${price.padStart(7)}  ${product.title}\n`);
}
