import { describe, expect, it } from "vitest";
import { importProduct, ImportFailed, type Transport } from "../src/product/fetch.js";
import { BlockedAddress, isPrivateAddress, assertPublicUrl } from "../src/product/guard.js";
import { fromEtsyApi, fromHtml, fromShopifyJson, mergeShopify } from "../src/product/parse.js";
import { decodeEntities, htmlToText } from "../src/product/text.js";
import { BadLink, parseLink } from "../src/product/url.js";
import { ETSY_IMAGES, ETSY_LISTING, LD_PAGE, SHOPIFY_JSON, SHOPIFY_PAGE } from "./fixtures.js";

const publicLookup = async () => ["93.184.216.34"];

function fakeNet(routes: Record<string, () => Response>): { transport: Transport; seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    transport: async (url) => {
      seen.push(url);
      const route = routes[url];
      return route ? route() : new Response("nope", { status: 404 });
    },
  };
}

describe("parseLink", () => {
  it("recognises Shopify by path on any domain, including collection and locale paths", () => {
    const a = parseLink("fernandkiln.com/collections/vases/products/bud-vase?variant=12#top");
    expect(a.kind).toBe("shopify");
    if (a.kind === "shopify") expect(a.jsonUrl).toBe("https://fernandkiln.com/products/bud-vase.json");
    const b = parseLink("https://shop.example.co.uk/en-gb/products/bud-vase");
    expect(b.kind === "shopify" && b.handle).toBe("bud-vase");
  });

  it("pulls the listing id out of Etsy links", () => {
    const l = parseLink("https://www.etsy.com/uk/listing/123456789/personalised-name-necklace?ref=shop");
    expect(l.kind === "etsy" && l.listingId).toBe("123456789");
  });

  it("explains an Etsy shop link rather than importing nothing", () => {
    expect(() => parseLink("https://www.etsy.com/shop/FernAndKiln")).toThrow(BadLink);
  });

  it("refuses non-web schemes", () => {
    expect(() => parseLink("javascript:alert(1)")).toThrow(BadLink);
    expect(() => parseLink("file:///etc/passwd")).toThrow(BadLink);
  });
});

describe("text", () => {
  it("decodes named and numeric entities and leaves nonsense alone", () => {
    expect(decodeEntities("Fern &amp; Kiln&#39;s &#x2014; &bogus; &#99999999;")).toBe("Fern & Kiln's — &bogus; &#99999999;");
  });

  it("keeps list items as lines and drops scripts", () => {
    const t = htmlToText("<p>Hi</p><script>evil()</script><ul><li>One</li><li>Two</li></ul>");
    expect(t).toBe("Hi\n\n• One\n• Two");
  });
});

describe("parsers", () => {
  it("reads Shopify's .json, prefers an available variant, de-duplicates photos", () => {
    const p = fromShopifyJson(SHOPIFY_JSON, "https://fernandkiln.com/products/bud-vase")!;
    expect(p.amount).toBe("32.00");
    expect(p.images).toEqual([
      "https://cdn.shopify.com/s/files/1/vase-front.jpg?v=1",
      "https://cdn.shopify.com/s/files/1/vase-side.jpg?v=1",
    ]);
    expect(p.description).toContain("• Speckled oatmeal glaze");
  });

  it("takes the currency from the page, and drops the price when there is none", () => {
    const json = fromShopifyJson(SHOPIFY_JSON, "https://x.com/products/v");
    const page = fromHtml(SHOPIFY_PAGE, "https://x.com/products/v");
    expect(mergeShopify(json, page)!.price).toEqual({ amount: "32.00", currency: "GBP" });
    expect(mergeShopify(json, null)!.price).toBeUndefined();
  });

  it("finds a Product inside an @graph past a broken block, and fills gaps from meta tags", () => {
    const p = fromHtml(LD_PAGE, "https://threadroom.com/p/apron")!;
    expect(p.title).toBe("Linen Apron &amp; Pocket"); // decoded once, in finish()
    expect(p.price).toEqual({ amount: "45", currency: "USD" });
    expect(p.shop).toBe("Thread Room");
    expect(p.images).toEqual(["https://threadroom.com/img/apron.jpg", "https://cdn.example.com/apron-2.jpg"]);
    // The meta description is longer than the JSON-LD one, so it wins.
    expect(p.description).toMatch(/cross-back straps/);
  });

  it("reads Etsy's API price as amount over divisor, and orders photos by rank", () => {
    const p = fromEtsyApi(ETSY_LISTING, ETSY_IMAGES)!;
    expect(p.price).toEqual({ amount: "34.50", currency: "EUR" });
    expect(p.images[0]).toContain("/1/");
  });
});

describe("guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe"])(
    "refuses %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );

  it("refuses names that resolve privately, odd ports, and credentials", async () => {
    await expect(assertPublicUrl("https://sneaky.example/", async () => ["10.0.0.5"])).rejects.toThrow(BlockedAddress);
    await expect(assertPublicUrl("https://example.com:8080/", publicLookup)).rejects.toThrow(BlockedAddress);
    await expect(assertPublicUrl("https://a:b@example.com/", publicLookup)).rejects.toThrow(BlockedAddress);
    await expect(assertPublicUrl("http://localhost/", publicLookup)).rejects.toThrow(BlockedAddress);
  });
});

describe("importProduct", () => {
  it("imports a Shopify product from .json plus the page's currency", async () => {
    const net = fakeNet({
      "https://fernandkiln.com/products/bud-vase.json": () => Response.json(SHOPIFY_JSON),
      "https://fernandkiln.com/products/bud-vase": () => new Response(SHOPIFY_PAGE),
    });
    const p = await importProduct("fernandkiln.com/products/bud-vase", { transport: net.transport, lookup: publicLookup });
    expect(p).toMatchObject({
      source: "shopify",
      title: "Ceramic Bud Vase | Speckled Stoneware",
      shop: "Fern & Kiln",
      price: { amount: "32.00", currency: "GBP" },
    });
  });

  it("uses Etsy's API when a key is set", async () => {
    const net = fakeNet({
      "https://openapi.etsy.com/v3/application/listings/123456789": () => Response.json(ETSY_LISTING),
      "https://openapi.etsy.com/v3/application/listings/123456789/images": () => Response.json(ETSY_IMAGES),
    });
    const p = await importProduct("https://www.etsy.com/listing/123456789/necklace", {
      transport: net.transport,
      lookup: publicLookup,
      etsyKey: "key:secret",
    });
    expect(p.source).toBe("etsy");
    expect(p.price?.currency).toBe("EUR");
    expect(net.seen).not.toContain("https://www.etsy.com/listing/123456789/necklace");
  });

  it("offers manual entry when Etsy blocks the page", async () => {
    const net = fakeNet({
      "https://www.etsy.com/listing/123456789/necklace": () => new Response("captcha", { status: 403 }),
    });
    const err = await importProduct("https://www.etsy.com/listing/123456789/necklace", {
      transport: net.transport,
      lookup: publicLookup,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ImportFailed);
    expect(err.manual).toBe(true);
  });

  it("does not follow a redirect into a private network", async () => {
    const net = fakeNet({
      "https://shop.example/p": () => new Response(null, { status: 302, headers: { location: "http://internal.example/" } }),
      "http://internal.example/": () => new Response("<title>secret</title>"),
    });
    const lookup = async (host: string) => (host === "internal.example" ? ["10.0.0.1"] : ["93.184.216.34"]);
    await expect(importProduct("https://shop.example/p", { transport: net.transport, lookup })).rejects.toThrow(ImportFailed);
    expect(net.seen).not.toContain("http://internal.example/");
  });
});
