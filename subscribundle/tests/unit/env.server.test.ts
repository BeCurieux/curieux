import { describe, expect, it } from "vitest";
import { MissingEnvError, readServerEnv } from "../../app/env.server";

const complete = {
  SHOPIFY_API_KEY: "key",
  SHOPIFY_API_SECRET: "secret",
  SHOPIFY_APP_URL: "https://example.trycloudflare.com",
  SCOPES: "write_products, read_orders",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/subscribundle",
};

describe("readServerEnv", () => {
  it("reads a complete environment", () => {
    const env = readServerEnv(complete);
    expect(env.shopifyApiKey).toBe("key");
    expect(env.appUrl).toBe("https://example.trycloudflare.com");
    expect(env.scopes).toEqual(["write_products", "read_orders"]);
    expect(env.shopCustomDomain).toBeUndefined();
  });

  it("names every missing variable at once", () => {
    const partial = {
      ...complete,
      SHOPIFY_API_SECRET: "",
      DATABASE_URL: undefined,
    };
    try {
      readServerEnv(partial);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError);
      expect((error as MissingEnvError).missing).toEqual([
        "SHOPIFY_API_SECRET",
        "DATABASE_URL",
      ]);
    }
  });

  it("treats whitespace as missing", () => {
    expect(() => readServerEnv({ ...complete, SCOPES: "  " })).toThrow(
      MissingEnvError,
    );
  });

  it("rejects an app URL that is not a URL", () => {
    expect(() =>
      readServerEnv({ ...complete, SHOPIFY_APP_URL: "not a url" }),
    ).toThrow(/SHOPIFY_APP_URL/);
  });

  it("passes through an optional custom shop domain", () => {
    const env = readServerEnv({
      ...complete,
      SHOP_CUSTOM_DOMAIN: "shop.example.com",
    });
    expect(env.shopCustomDomain).toBe("shop.example.com");
  });
});
