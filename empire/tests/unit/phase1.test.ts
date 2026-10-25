import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/next-path";
import { catalogueIdProblems, suggestMappings } from "@/lib/billing/gumroad-match";

describe("after sign-in, back to the page she asked for", () => {
  it("allows our own signed-in pages", () => {
    expect(safeNext("/studio/fit")).toBe("/studio/fit");
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/studio/fit?x=1")).toBe("/studio/fit?x=1");
  });

  it("refuses anything else, falling back to the studio", () => {
    for (const bad of [
      undefined,
      "",
      "https://evil.example/studio",
      "//evil.example/studio",
      "/\\evil.example",
      "/studio/../admin",
      "/admin",
      "/sign-in",
      "/studiox",
      "javascript:alert(1)",
      " /studio fit",
    ])
      expect(safeNext(bad), String(bad)).toBe("/studio");
  });
});

describe("Gumroad product mapping", () => {
  it("matches by permalink first, then by title, and leaves the rest unmatched", () => {
    const s = suggestMappings([
      {
        id: "abc123==",
        name: "Income Fit Test (2026)",
        short_url: "https://herlittleempireco.gumroad.com/l/income-fit-test",
      },
      { id: "def456==", name: "The Empire Bundle", formatted_price: "$39" },
      { id: "ghi789==", name: "Your Little Offer Kit" },
      { id: "zzz000==", name: "Something new", published: false },
    ]);
    expect(s.map((x) => [x.slug, x.how])).toEqual([
      ["income-fit-test", "permalink"],
      ["empire-bundle", "title"],
      ["little-offer-kit", "title"],
      [null, "none"],
    ]);
    expect(s[3]!.published).toBe(false);
  });

  it("the catalogue's ids are well-formed and never shared between two products", () => {
    expect(catalogueIdProblems()).toEqual([]);
  });
});
