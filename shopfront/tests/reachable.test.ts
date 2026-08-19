/**
 * Whether a link can possibly go anywhere.
 *
 * The check has to be certain in both directions, and the expensive mistake is
 * the second one. Suppressing a *real* merchant's product link would remove the
 * only way to buy the thing — from the page whose entire job is to sell it —
 * and it would do so silently, on a shop nobody at popuup is looking at. So the
 * default has to be "reachable", and only names the IETF guarantees can never
 * resolve may be treated as dead.
 */

import { describe, expect, it } from "vitest";
import { isReachable } from "@/lib/render/reachable";

describe("deciding whether a link goes anywhere", () => {
  it("treats a real merchant's URL as reachable", () => {
    expect(isReachable("https://merchant.com/products/thing")).toBe(true);
    expect(isReachable("https://shop.merchant.co.uk/products/thing?variant=1")).toBe(true);
    // Nothing about being down, deleted or misspelled is knowable from a
    // string, and guessing would suppress links that work.
    expect(isReachable("https://probably-gone-by-now.com/products/x")).toBe(true);
  });

  it("knows the reserved names can never resolve", () => {
    // RFC 2606 and RFC 6761. This is a fact about the address, not a guess.
    expect(isReachable("https://casalino.example/products/linen-shirt")).toBe(false);
    expect(isReachable("https://example.invalid/casa-lino/products/x")).toBe(false);
    expect(isReachable("https://anything.test/x")).toBe(false);
    expect(isReachable("http://localhost:3000/x")).toBe(false);
  });

  it("matches the reserved label and not a domain that merely contains it", () => {
    // `example` as a whole label at the end, not as a substring. A real store
    // called `example-goods.com` is somebody's business.
    expect(isReachable("https://example-goods.com/products/x")).toBe(true);
    expect(isReachable("https://myexample.com/products/x")).toBe(true);
    expect(isReachable("https://testing.com/products/x")).toBe(true);
    expect(isReachable("https://invalidation.co/products/x")).toBe(true);
  });

  it("allows fragments and same-site paths", () => {
    expect(isReachable("#products")).toBe(true);
    expect(isReachable("/preview/edit-ibiza")).toBe(true);
  });

  it("refuses what it cannot parse, and nothing at all", () => {
    // An anchor around something that does not parse is worse than no anchor.
    expect(isReachable("not a url")).toBe(false);
    expect(isReachable("")).toBe(false);
    expect(isReachable(undefined)).toBe(false);
    expect(isReachable(null)).toBe(false);
  });
});
