import { describe, expect, it } from "vitest";
import { detectCategory } from "@/catalogue/detect.js";
import { createAdminClient } from "@/shopify/admin/client.js";
import { htmlToText, idFromNumeric, productFromWebhook, readCatalogue } from "@/shopify/admin/products.js";

const p = (title: string, productType = "", tags: string[] = [], description = "") => ({ title, productType, tags, description });

describe("detectCategory", () => {
  it.each([
    [p("Daily Multivitamin"), 'title says "multivitamin"'],
    [p("Sleep Support", "Dietary Supplement"), 'product type says "dietary supplement"'],
    [p("Calm", "", ["Nahrungsergänzungsmittel"]), 'tag says "nahrungsergänzungsmittel"'],
    [p("Magnesium Glycinate", "", [], "60 capsules"), 'title says "magnesium" and description says "capsules"'],
    [p("Omega-3 Softgels"), 'title says "softgels"'],
  ])("detects %o", (product, reason) => {
    expect(detectCategory(product)).toEqual({ category: "supplements", reason });
  });

  it.each([
    [p("Vitamin C Brightening Serum", "Skincare")],
    [p("Collagen Body Cream", "", ["supplement-inspired"])],
    [p("Magnesium Bath Flakes")],
    [p("Ironwood Candle")],
    [p("Gift card")],
  ])("does not detect %o", (product) => {
    expect(detectCategory(product).category).toBeNull();
  });
});

describe("products", () => {
  it("reads up to a limit and says it was truncated", async () => {
    const pages: number[] = [];
    const admin = createAdminClient({
      shopDomain: "a.myshopify.com",
      accessToken: "t",
      transport: async (_url, init) => {
        const { variables } = JSON.parse(init.body) as { variables: { first: number; after: string | null } };
        pages.push(variables.first);
        const start = Number(variables.after ?? 0);
        const nodes = Array.from({ length: variables.first }, (_, i) => ({ id: `gid://shopify/Product/${start + i}`, variants: { nodes: [] } }));
        return Response.json({ data: { products: { nodes, pageInfo: { hasNextPage: true, endCursor: String(start + variables.first) } } } });
      },
    });
    const read = await readCatalogue(admin, { limit: 250, pageSize: 100 });
    expect(pages).toEqual([100, 100, 50]);
    expect(read.products).toHaveLength(250);
    expect(read.truncated).toBe(true);
  });

  it("maps a REST-shaped webhook payload", () => {
    expect(
      productFromWebhook({
        id: 42,
        title: "Iron",
        handle: "iron",
        status: "active",
        product_type: "Supplements",
        vendor: "V",
        tags: "iron, energy ,",
        body_html: "<p>Take one&nbsp;daily.</p><script>x()</script><ul><li>Vegan &amp; GF</li></ul>",
        updated_at: "2026-10-08T00:00:00Z",
        variants: [{ id: 1, admin_graphql_api_id: "gid://shopify/ProductVariant/1", sku: "IR-1", title: "60", barcode: null }],
      }),
    ).toEqual({
      id: "gid://shopify/Product/42",
      title: "Iron",
      handle: "iron",
      status: "ACTIVE",
      productType: "Supplements",
      vendor: "V",
      tags: ["iron", "energy"],
      description: "Take one daily.\nVegan & GF",
      updatedAt: "2026-10-08T00:00:00Z",
      variants: [{ id: "gid://shopify/ProductVariant/1", sku: "IR-1", title: "60", barcode: null }],
    });
    expect(productFromWebhook(null)).toBeNull();
    expect(productFromWebhook({ title: "no id" })).toBeNull();
  });

  it("numeric ids", () => {
    expect(idFromNumeric(7)).toBe("gid://shopify/Product/7");
    expect(idFromNumeric("7")).toBe("gid://shopify/Product/7");
    expect(idFromNumeric("x")).toBeNull();
    expect(htmlToText("a<br>b")).toBe("a\nb");
  });
});
