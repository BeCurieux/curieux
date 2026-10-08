import { describe, expect, it } from "vitest";
import { problems } from "../src/script/check.js";
import { factsFrom, formatPrice, highlights, shortName } from "../src/script/facts.js";
import { templateScript } from "../src/script/templates.js";
import { AdScriptSchema, ANGLES, type AdScript } from "../src/script/types.js";
import { writeAds } from "../src/script/write.js";
import type { Product } from "../src/product/types.js";

const vase: Product = {
  source: "shopify",
  title: "Ceramic Bud Vase | Speckled Stoneware",
  description: "A small vase for a single stem.\n\n• Wheel-thrown stoneware\n• Speckled oatmeal glaze\n• Stands 12 cm tall\n\nSHIPPING\nShips in 3–5 days.",
  price: { amount: "32.00", currency: "GBP" },
  shop: "Fern & Kiln",
  images: ["a", "b", "c"],
};

const necklace: Product = {
  source: "etsy",
  title: "Personalised Name Necklace | Gold Name Necklace | Gift for Her",
  description: "Dainty name necklace, handmade to order.\n\n• 14k gold filled chain\n• Up to 10 letters\n• Gift box included",
  price: { amount: "34.50", currency: "EUR" },
  images: ["a"],
};

const bare: Product = { source: "manual", title: "Tote bag", description: "", images: [] };

const CORPUS = [vase, necklace, bare];

describe("facts", () => {
  it("strips marketplace keyword stuffing from the name", () => {
    expect(shortName(necklace.title)).toBe("Personalised Name Necklace");
    expect(shortName("Linen Apron - Natural")).toBe("Linen Apron");
  });

  it("formats whole prices without decimals and keeps cents when there are some", () => {
    expect(formatPrice("32.00", "GBP")).toBe("£32");
    expect(formatPrice("34.50", "EUR")).toBe("€34.50");
    expect(formatPrice("12", "XXX")).toMatch(/12/);
  });

  it("takes bullets as highlights and skips headings and shipping lines", () => {
    expect(highlights(vase.description)).toEqual(["Wheel-thrown stoneware", "Speckled oatmeal glaze", "Stands 12 cm tall"]);
  });
});

describe("templates", () => {
  it.each(CORPUS.map((p) => [p.title, p] as const))("write three valid ads that pass the check — %s", (_, product) => {
    const facts = factsFrom(product);
    for (const angle of ANGLES) {
      const ad = templateScript(angle, facts);
      expect(AdScriptSchema.safeParse(ad).success, `${angle} schema`).toBe(true);
      expect(problems(ad, facts), angle).toEqual([]);
      for (const s of [ad.hookImage, ...ad.scenes.map((x) => x.image)]) expect(s).toBeLessThan(facts.imageCount);
    }
  });

  it("only says Etsy for Etsy listings", () => {
    expect(templateScript("showcase", factsFrom(necklace)).cta).toMatch(/Etsy/);
    expect(templateScript("showcase", factsFrom(vase)).cta).not.toMatch(/Etsy/);
  });
});

describe("check", () => {
  const facts = factsFrom(vase);
  const base: AdScript = {
    angle: "showcase",
    hook: "Meet the bud vase",
    hookImage: 0,
    scenes: [
      { caption: "Wheel-thrown stoneware", image: 1 },
      { caption: "12 cm of calm · £32", image: 2 },
    ],
    cta: "Shop now",
  };

  it("passes copy that only uses the listing's facts", () => {
    expect(problems(base, facts)).toEqual([]);
  });

  it.each([
    ["Handmade in small batches", /handmade/i],
    ["Our best-seller", /best/],
    ["Loved by 2,000 customers", /2000|loved/],
    ["50% off this week", /50/],
    ["Free shipping today", /free shipping/],
  ])("rejects an invented claim: %s", (caption, why) => {
    const ad = { ...base, scenes: [...base.scenes, { caption, image: 0 }] };
    expect(problems(ad, facts).join(" ")).toMatch(why);
  });

  it("allows a claim word the seller wrote themselves", () => {
    const f = factsFrom(necklace);
    const ad = { ...base, scenes: [{ caption: "Handmade to order", image: 0 }, { caption: "14k gold filled", image: 0 }] };
    expect(problems(ad, f)).toEqual([]);
  });
});

describe("writeAds", () => {
  const facts = factsFrom(vase);
  const good = { angle: "gift", hook: "A gift for one perfect stem", hookImage: 1, scenes: [{ caption: "Speckled oatmeal glaze", image: 0 }, { caption: "Wheel-thrown stoneware", image: 2 }], cta: "Get yours" };
  const invents = { ...good, angle: "showcase", scenes: [{ caption: "Handmade and dishwasher safe", image: 0 }, { caption: "x", image: 0 }] };
  const tooLong = { ...good, angle: "details", hook: "x".repeat(200) };

  it("keeps a clean draft, replaces the ones that fail, and always returns one ad per angle", async () => {
    const r = await writeAds(facts, async () => [good, invents, tooLong]);
    expect(r.ads.map((a) => [a.angle, a.by])).toEqual([
      ["showcase", "template"],
      ["gift", "claude"],
      ["details", "template"],
    ]);
    expect(r.rejected.map((x) => x.angle).sort()).toEqual(["details", "showcase"]);
  });

  it("wraps out-of-range photo numbers instead of failing the ad", async () => {
    const r = await writeAds(facts, async () => [{ ...good, hookImage: 7 }]);
    expect(r.ads[1]!.hookImage).toBe(7 % 3);
  });

  it("falls back to templates when the model is unavailable", async () => {
    const r = await writeAds(facts, async () => {
      throw new Error("529 overloaded");
    });
    expect(r.ads.every((a) => a.by === "template")).toBe(true);
    expect(r.drafterError).toMatch(/overloaded/);
  });

  it("works with no drafter at all", async () => {
    const r = await writeAds(facts);
    expect(r.ads).toHaveLength(3);
  });
});
