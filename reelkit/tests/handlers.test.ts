import { describe, expect, it } from "vitest";
import { handleImage, handleImport, handleWrite, type Deps } from "../src/server/handlers.js";
import { proxiedImage } from "../src/product/sign.js";
import { windowLimiter } from "../src/server/limit.js";
import { SHOPIFY_JSON, SHOPIFY_PAGE } from "./fixtures.js";

const SECRET = "test-secret";

function deps(routes: Record<string, () => Response> = {}, over: Partial<Deps> = {}): Deps {
  return {
    transport: async (url) => routes[url]?.() ?? new Response("nope", { status: 404 }),
    lookup: async () => ["93.184.216.34"],
    imageSecret: SECRET,
    importLimit: () => true,
    writeLimit: () => true,
    ...over,
  };
}

const post = (path: string, body: unknown) =>
  new Request(`http://app.test${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("import", () => {
  it("returns the product and signed same-origin photo URLs", async () => {
    const d = deps({
      "https://shop.test/products/vase.json": () => Response.json(SHOPIFY_JSON),
      "https://shop.test/products/vase": () => new Response(SHOPIFY_PAGE),
    });
    const res = await handleImport(post("/api/import", { url: "https://shop.test/products/vase" }), d);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.views).toHaveLength(2);
    expect(data.views[0]).toBe(proxiedImage(data.product.images[0], SECRET));
  });

  it("says when manual entry is the way forward", async () => {
    const res = await handleImport(post("/api/import", { url: "https://www.etsy.com/listing/1/x" }), deps());
    expect(res.status).toBe(422);
    expect((await res.json()).manual).toBe(true);
  });

  it("rate limits", async () => {
    const res = await handleImport(post("/api/import", { url: "https://x.test/" }), deps({}, { importLimit: () => false }));
    expect(res.status).toBe(429);
  });
});

describe("write", () => {
  const product = { source: "shopify", title: "Ceramic Bud Vase", description: "• Wheel-thrown stoneware\n• Speckled glaze", imageCount: 2 };

  it("writes three ads from templates with no model configured", async () => {
    const res = await handleWrite(post("/api/scripts", product), deps());
    const data = await res.json();
    expect(data.ads).toHaveLength(3);
  });

  it("does not spend the model budget once the limit is hit, but still answers", async () => {
    let called = 0;
    const d = deps({}, { drafter: async () => (called++, []), writeLimit: () => false });
    const res = await handleWrite(post("/api/scripts", product), d);
    expect(res.status).toBe(200);
    expect(called).toBe(0);
  });

  it("refuses malformed input", async () => {
    const res = await handleWrite(post("/api/scripts", { ...product, imageCount: 99 }), deps());
    expect(res.status).toBe(400);
  });
});

describe("image proxy", () => {
  const img = "https://cdn.shopify.com/a.jpg";
  const jpeg = () => new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { "content-type": "image/jpeg" } });

  it("serves a signed image with a locked-down policy", async () => {
    const res = await handleImage(new Request(`http://app.test${proxiedImage(img, SECRET)}`), deps({ [img]: jpeg }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'");
  });

  it("refuses anything it did not sign", async () => {
    const forged = `http://app.test/api/image?u=${encodeURIComponent("http://169.254.169.254/")}&s=xxxx`;
    expect((await handleImage(new Request(forged), deps())).status).toBe(404);
    const otherKey = proxiedImage(img, "another-secret");
    expect((await handleImage(new Request(`http://app.test${otherKey}`), deps({ [img]: jpeg }))).status).toBe(404);
  });

  it("refuses SVG, which would run as a document on our origin", async () => {
    const svg = () => new Response("<svg onload=alert(1)>", { headers: { "content-type": "image/svg+xml" } });
    const res = await handleImage(new Request(`http://app.test${proxiedImage(img, SECRET)}`), deps({ [img]: svg }));
    expect(res.status).toBe(502);
  });
});

describe("limiter", () => {
  it("allows a budget per window, then refuses, then recovers", () => {
    const allow = windowLimiter(2, 1000);
    expect([allow("a", 0), allow("a", 10), allow("a", 20), allow("b", 20)]).toEqual([true, true, false, true]);
    expect(allow("a", 1500)).toBe(true);
  });
});
