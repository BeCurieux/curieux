/**
 * A store's products, read and scanned.
 *
 * The Admin client is a fake that serves pages from memory, so pagination,
 * the product allowance and the mapping are tested without Shopify. The scan
 * is the real engine: a product's score here is the score `pnpm scan` gives
 * the same words.
 */

import { describe, expect, it } from "vitest";
import type { AdminClient } from "@/shopify/admin/client.js";
import { readCatalogueCopy, readProductCopy, toProductCopy, type ProductCopy } from "@/shopify/admin/products.js";
import { scanCatalogue, scanProduct, withProduct } from "@/shopify/catalogue.js";
import { scan } from "@/engine/evaluate.js";

type Raw = Parameters<typeof toProductCopy>[0];

function raw(n: number, overrides: Partial<Raw> = {}): Raw {
  return {
    id: `gid://shopify/Product/${n}`,
    legacyResourceId: String(n),
    handle: `product-${n}`,
    title: `Product ${n}`,
    descriptionHtml: "<p>A gentle cleanser for everyday use.</p>",
    status: "ACTIVE",
    onlineStoreUrl: `https://aurelia.example/products/product-${n}`,
    updatedAt: "2026-09-28T00:00:00Z",
    seo: { title: null, description: null },
    ...overrides,
  };
}

function fakeClient(all: Raw[]): AdminClient & { calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  return {
    shopDomain: "aurelia-skin.myshopify.com",
    apiVersion: "2026-07",
    endpoint: "https://aurelia-skin.myshopify.com/admin/api/2026-07/graphql.json",
    calls,
    async request<T>(query: string, variables: Record<string, unknown> = {}) {
      calls.push(variables);
      if (query.includes("FrancaOneProduct")) {
        const found = all.find((p) => p.id === variables["id"]) ?? null;
        return { data: { product: found } as T, requestedQueryCost: 1, actualQueryCost: 1, throttle: null };
      }
      const start = variables["after"] ? Number(variables["after"]) : 0;
      const first = Number(variables["first"]);
      const nodes = all.slice(start, start + first);
      const end = start + nodes.length;
      const data = {
        products: { nodes, pageInfo: { hasNextPage: end < all.length, endCursor: nodes.length ? String(end) : null } },
      };
      return { data: data as T, requestedQueryCost: 1, actualQueryCost: 1, throttle: null };
    },
  };
}

describe("toProductCopy", () => {
  it("joins title, description text and a search description the page does not already say", () => {
    const copy = toProductCopy(
      raw(1, {
        title: "Night Serum",
        descriptionHtml: "<p>Wake up <strong>brighter</strong>.</p>",
        seo: { title: null, description: "Clinically proven to clear acne in 7 days." },
      }),
    );
    expect(copy.text).toBe("Night Serum\n\nWake up brighter.\n\nClinically proven to clear acne in 7 days.");
  });

  it("drops the search description when it repeats the description, as theme defaults do", () => {
    const copy = toProductCopy(raw(1, { seo: { title: null, description: "a gentle  cleanser for everyday use." } }));
    expect(copy.text).toBe("Product 1\n\nA gentle cleanser for everyday use.");
  });

  it("keeps a 64-bit legacy id exactly, as the string the API sends", () => {
    expect(toProductCopy(raw(1, { legacyResourceId: "9007199254740993" })).legacyId).toBe("9007199254740993");
  });
});

describe("readCatalogueCopy", () => {
  it("follows every page", async () => {
    const client = fakeClient(Array.from({ length: 7 }, (_, i) => raw(i + 1)));
    const result = await readCatalogueCopy(client, { pageSize: 3 });
    expect(result.products.map((p) => p.legacyId)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(result.truncated).toBe(false);
    expect(client.calls).toHaveLength(3);
  });

  it("stops at the plan's allowance and says it stopped", async () => {
    const client = fakeClient(Array.from({ length: 7 }, (_, i) => raw(i + 1)));
    const result = await readCatalogueCopy(client, { pageSize: 3, limit: 5 });
    expect(result.products).toHaveLength(5);
    expect(result.truncated).toBe(true);
    expect(client.calls.map((c) => c["first"])).toEqual([3, 2]);
  });

  it("does not call a catalogue truncated when the allowance is exactly its size", async () => {
    const client = fakeClient(Array.from({ length: 5 }, (_, i) => raw(i + 1)));
    expect((await readCatalogueCopy(client, { pageSize: 5, limit: 5 })).truncated).toBe(false);
  });

  it("reads one product, and null for one that is gone", async () => {
    const client = fakeClient([raw(1)]);
    expect((await readProductCopy(client, "gid://shopify/Product/1"))?.handle).toBe("product-1");
    expect(await readProductCopy(client, "gid://shopify/Product/2")).toBeNull();
  });
});

describe("scanCatalogue", () => {
  const markets = ["AU", "US", "EU"] as const;
  const clean = toProductCopy(raw(1));
  const loud = toProductCopy(raw(2, { descriptionHtml: "<p>Clinically proven to clear acne in 7 days.</p>" }));
  const empty: ProductCopy = { ...toProductCopy(raw(3)), title: "", text: "" };
  const draft = toProductCopy(raw(4, { status: "DRAFT", onlineStoreUrl: null }));

  it("scores each product exactly as the single-page scan scores the same words", () => {
    const result = scanProduct(loud, [...markets]).result;
    const direct = scan({ text: loud.text, source: { kind: "paste" }, jurisdictions: [...markets] });
    expect(result.score).toEqual(direct.score);
    expect(result.findings.map((f) => f.ruleId)).toEqual(direct.findings.map((f) => f.ruleId));
  });

  it("reports the weakest product as the store's headline, not an average", () => {
    const { summary } = scanCatalogue([clean, loud], [...markets]);
    expect(summary.weakest?.handle).toBe("product-2");
    expect(summary.weakest?.score).toBe(scanProduct(loud, [...markets]).result.score.value);
  });

  it("counts a product with no copy as unread, never as clear, and never badges it", () => {
    const { summary, products } = scanCatalogue([clean, empty], [...markets]);
    expect(summary.unread).toBe(1);
    expect(summary.byBand.clear).toBe(1);
    expect(products.find((p) => p.product.gid === empty.gid)?.badge).toBe(false);
  });

  it("badges a clean live product and not a clean draft", () => {
    const { products } = scanCatalogue([clean, draft], [...markets]);
    expect(products.find((p) => p.product.gid === clean.gid)?.badge).toBe(true);
    expect(products.find((p) => p.product.gid === draft.gid)?.badge).toBe(false);
  });

  it("does not badge a product the rules flag", () => {
    expect(scanProduct(loud, [...markets]).badge).toBe(false);
  });

  it("has no weakest product when nothing had copy", () => {
    expect(scanCatalogue([empty], [...markets]).summary.weakest).toBeNull();
  });

  it("swaps one product's scan in and drops a deleted one", () => {
    const before = scanCatalogue([clean, loud], [...markets], () => new Date("2026-09-28T00:00:00Z"));
    const fixed = scanProduct({ ...loud, text: "A gentle cleanser for everyday use." }, [...markets]);
    const after = withProduct(before, loud.gid, fixed);
    expect(after.summary.byBand.rework + after.summary.byBand.review).toBe(0);
    expect(withProduct(after, loud.gid, null).summary.products).toBe(1);
  });
});
