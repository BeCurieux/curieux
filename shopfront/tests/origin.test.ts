/**
 * Which domain a shared link unfurls against.
 *
 * This is the kind of setting that cannot fail locally and cannot be seen
 * failing in production either: the page renders perfectly and the card next
 * to it in somebody's feed is blank. So the precedence is held here rather
 * than trusted to a chain of `??` that reads fine and orders wrongly.
 */

import { describe, expect, it } from "vitest";
import { resolveOrigin } from "@/lib/origin";

describe("resolveOrigin", () => {
  it("prefers the origin somebody set by hand", () => {
    // The custom-domain case. Nothing the platform reports will ever know
    // about it, so it has to win.
    expect(
      resolveOrigin({
        PUBLIC_ORIGIN: "https://popuup.com",
        VERCEL_PROJECT_PRODUCTION_URL: "popuup.vercel.app",
        VERCEL_URL: "popuup-q9tc.vercel.app",
      }),
    ).toBe("https://popuup.com");
  });

  it("accepts the NEXT_PUBLIC spelling of the same thing", () => {
    expect(resolveOrigin({ NEXT_PUBLIC_ORIGIN: "https://popuup.com" })).toBe("https://popuup.com");
  });

  it("falls back to the project's production domain, so a fresh import is correct", () => {
    // The whole point of the change: a deployment nobody has configured still
    // unfurls with a working image.
    expect(
      resolveOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "popuup.vercel.app", VERCEL_URL: "popuup-q9tc.vercel.app" }),
    ).toBe("https://popuup.vercel.app");
  });

  it("uses the per-deployment URL only when there is no production domain", () => {
    // That is a preview. Its own URL is the right answer there and the wrong
    // one in production, where it changes on every push.
    expect(resolveOrigin({ VERCEL_URL: "popuup-q9tc.vercel.app" })).toBe("https://popuup-q9tc.vercel.app");
  });

  it("gives a bare host a scheme, and leaves one that has it alone", () => {
    expect(resolveOrigin({ PUBLIC_ORIGIN: "popuup.com" })).toBe("https://popuup.com");
    expect(resolveOrigin({ PUBLIC_ORIGIN: "https://popuup.com/" })).toBe("https://popuup.com");
    expect(resolveOrigin({ PUBLIC_ORIGIN: "http://localhost:3000" })).toBe("http://localhost:3000");
  });

  it("does not read an empty variable as an answer", () => {
    // A variable set to "" in a dashboard is how this silently picks the wrong
    // branch: it is present, and it means nothing.
    expect(resolveOrigin({ PUBLIC_ORIGIN: "", VERCEL_PROJECT_PRODUCTION_URL: "popuup.vercel.app" })).toBe(
      "https://popuup.vercel.app",
    );
    expect(resolveOrigin({ PUBLIC_ORIGIN: "   " })).toBe("https://popuup.com");
  });

  it("has an answer when nothing is set at all", () => {
    expect(resolveOrigin({})).toBe("https://popuup.com");
    expect(() => new URL(resolveOrigin({}))).not.toThrow();
  });
});
