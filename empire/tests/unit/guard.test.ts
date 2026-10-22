import { describe, expect, it } from "vitest";
import { checkClaims } from "@/lib/ai/guard";
import { profile, product } from "./fixtures";

describe("claims guard", () => {
  it("flags reviews, certifications, delivery promises and pressure that weren't supplied", () => {
    const warnings = checkClaims(
      {
        a: "Our customers love it! “Best apron ever” — Sarah",
        b: "Certified organic cotton, free shipping, ships in 2 days.",
        c: "Only 3 left — hurry!",
      },
      profile(),
      product(),
    );
    const text = warnings.join("\n");
    expect(text).toMatch(/review or testimonial/);
    expect(text).toMatch(/certification/);
    expect(text).toMatch(/delivery promise/);
    expect(text).toMatch(/pressure/);
  });

  it("accepts a claim that is in her verified facts", () => {
    const p = profile({ verifiedClaims: ["Handmade in Melbourne", "Certified organic cotton"] });
    expect(checkClaims({ a: "Handmade in Melbourne from certified organic cotton." }, p)).toEqual([]);
  });

  it("always flags income claims", () => {
    const p = profile({ verifiedClaims: ["passive income"] });
    expect(checkClaims({ a: "Build passive income with this." }, p)).toHaveLength(1);
  });

  it("flags anything she prohibited", () => {
    const warnings = checkClaims({ a: "A lovely eco friendly apron" }, profile());
    expect(warnings.some((w) => w.includes("asked us never to say"))).toBe(true);
  });

  it("ignores placeholders", () => {
    expect(checkClaims({ a: "[Add whether it ships in 2 days]" }, profile())).toEqual([]);
  });
});
