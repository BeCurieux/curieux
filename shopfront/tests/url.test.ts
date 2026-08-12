import { describe, expect, it } from "vitest";
import { absoluteUrl, normaliseStoreUrl, productHandleFromUrl, storeCacheKey } from "@/lib/ingest/url";
import { IngestError } from "@/lib/ingest/types";

describe("normaliseStoreUrl", () => {
  it("accepts a store URL in any of the shapes a merchant would type", () => {
    for (const input of [
      "allbirds.com",
      "https://allbirds.com",
      "  https://allbirds.com/  ",
      "https://allbirds.com/collections/mens",
      "HTTPS://ALLBIRDS.COM/",
    ]) {
      expect(normaliseStoreUrl(input).toString()).toBe("https://allbirds.com/");
    }
  });

  it("keeps the subdomain, because www and apex are different origins", () => {
    expect(normaliseStoreUrl("www.allbirds.com").hostname).toBe("www.allbirds.com");
    expect(normaliseStoreUrl("shop.example.co.uk").hostname).toBe("shop.example.co.uk");
  });

  it("drops credentials rather than carrying them into logs and cache keys", () => {
    expect(normaliseStoreUrl("https://user:secret@example.com/").toString()).toBe("https://example.com/");
  });

  it("rejects what is not a public storefront", () => {
    for (const input of ["", "   ", "not a url", "ftp://example.com", "localhost", "file:///etc/passwd"]) {
      expect(() => normaliseStoreUrl(input)).toThrow(IngestError);
    }
  });
});

describe("absoluteUrl", () => {
  const base = new URL("https://shop.example.com/");

  it("resolves the relative and protocol-relative forms real themes emit", () => {
    expect(absoluteUrl("/cdn/logo.png", base)).toBe("https://shop.example.com/cdn/logo.png");
    expect(absoluteUrl("//cdn.shopify.com/a.jpg", base)).toBe("https://cdn.shopify.com/a.jpg");
    expect(absoluteUrl("https://other.com/a.jpg", base)).toBe("https://other.com/a.jpg");
  });

  it("refuses schemes that are not fetchable assets", () => {
    expect(absoluteUrl("data:image/gif;base64,R0lGOD", base)).toBeUndefined();
    expect(absoluteUrl("javascript:void(0)", base)).toBeUndefined();
    expect(absoluteUrl(undefined, base)).toBeUndefined();
    expect(absoluteUrl("  ", base)).toBeUndefined();
  });
});

describe("productHandleFromUrl", () => {
  it("finds the handle whatever the collection prefix or query", () => {
    expect(productHandleFromUrl("https://x.com/products/oat-crew")).toBe("oat-crew");
    expect(productHandleFromUrl("/collections/new/products/oat-crew?variant=41001")).toBe("oat-crew");
    expect(productHandleFromUrl("/en-gb/products/oat-crew#reviews")).toBe("oat-crew");
    expect(productHandleFromUrl("/products/caf%C3%A9-set")).toBe("café-set");
  });

  it("returns nothing for URLs that are not products", () => {
    expect(productHandleFromUrl("/collections/all")).toBeUndefined();
    expect(productHandleFromUrl("/products/")).toBeUndefined();
    expect(productHandleFromUrl("nonsense")).toBeUndefined();
  });
});

describe("storeCacheKey", () => {
  it("is filesystem-safe", () => {
    expect(storeCacheKey(normaliseStoreUrl("https://kelp-and-cotton.myshopify.com"))).toBe(
      "kelp-and-cotton.myshopify.com",
    );
  });
});
