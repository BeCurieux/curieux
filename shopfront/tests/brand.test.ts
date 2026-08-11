import { describe, expect, it } from "vitest";
import { extractBrandContext } from "@/lib/ingest/brand";
import { HOMEPAGE_HTML } from "./helpers/fixtures";

const storeUrl = new URL("https://kelpandcotton.com/");
const extraction = extractBrandContext({ html: HOMEPAGE_HTML, storeUrl });

describe("extractBrandContext", () => {
  it("takes the declared brand name over the templated title", () => {
    expect(extraction.brand.name).toBe("Kelp & Cotton");
    expect(extraction.warnings.join(" ")).not.toContain("inferred");
  });

  it("takes the logo the store declared in JSON-LD", () => {
    expect(extraction.brand.logoUrl).toBe("https://cdn.shopify.com/s/files/1/0001/logo.svg");
  });

  it("distinguishes a share card from a logo", () => {
    expect(extraction.brand.socialImageUrl).toBe("https://cdn.shopify.com/s/files/1/0001/social.jpg");
    expect(extraction.brand.socialImageUrl).not.toBe(extraction.brand.logoUrl);
  });

  it("reads the theme's colour scheme", () => {
    expect(extraction.brand.suggestedColorway).toMatchObject({
      background: "#faf8f4",
      text: "#22201d",
      accent: "#2f5d50",
    });
    expect(extraction.brand.themeColor).toBe("#2f5d50");
  });

  it("collects the shop's own words as evidence, not a verdict about them", () => {
    const { voice } = extraction.brand;
    expect(voice.headings).toContain("Slow basics for a warm house");
    expect(voice.sentences.some((s) => s.includes("mended rather than replaced"))).toBe(true);
    expect(voice.buttonLabels).toContain("Add to basket");
    // No mood, no adjectives — that judgement belongs to the merchandiser.
    expect(Object.keys(voice)).toEqual(["headings", "sentences", "navLabels", "buttonLabels"]);
  });

  it("separates social links from the merchant's own nav", () => {
    expect(extraction.brand.socialLinks).toEqual([
      { platform: "instagram", url: "https://www.instagram.com/kelpandcotton" },
      { platform: "tiktok", url: "https://www.tiktok.com/@kelpandcotton" },
    ]);
    const labels = extraction.brand.links.map((l) => l.label);
    expect(labels).toContain("Our workshop");
    // Products belong to the catalogue, not the footer link list.
    expect(labels).not.toContain("Oat Crew");
  });

  it("notes the review platform without claiming any review data", () => {
    expect(extraction.reviewPlatform).toBe("judge.me");
  });

  it("recognises a Shopify storefront", () => {
    expect(extraction.looksShopify).toBe(true);
  });
});

describe("extractBrandContext on a bare storefront", () => {
  const bare = extractBrandContext({
    html: "<html><head><title>Home</title></head><body></body></html>",
    storeUrl: new URL("https://slow-goods-co.myshopify.com/"),
  });

  it("says out loud that the name was inferred", () => {
    expect(bare.brand.name).toBe("Slow Goods Co");
    expect(bare.warnings.some((w) => w.includes("inferred"))).toBe(true);
  });

  it("warns rather than inventing a logo or a palette", () => {
    expect(bare.brand.logoUrl).toBeUndefined();
    expect(bare.brand.palette).toEqual([]);
    expect(bare.warnings.some((w) => w.includes("No logo"))).toBe(true);
    expect(bare.warnings.some((w) => w.includes("No colours"))).toBe(true);
    expect(bare.warnings.some((w) => w.includes("Very little copy"))).toBe(true);
  });

  it("still produces a legible colourway to fall back on", () => {
    expect(bare.brand.suggestedColorway.background).toBe("#ffffff");
  });
});

describe("logo fallbacks", () => {
  it("uses a header image that calls itself a logo, at its largest rendition", () => {
    const html = `<header><img class="site-header__logo" src="/logo-small.png"
      srcset="/logo-small.png 100w, /logo-large.png 400w" alt="Brand"></header>`;
    const result = extractBrandContext({ html, storeUrl });
    expect(result.brand.logoUrl).toBe("https://kelpandcotton.com/logo-large.png");
  });

  it("falls back to an apple-touch-icon but never to a .ico", () => {
    const withIcon = extractBrandContext({
      html: `<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" sizes="180x180" href="/icon.png">`,
      storeUrl,
    });
    expect(withIcon.brand.logoUrl).toBe("https://kelpandcotton.com/icon.png");

    const onlyIco = extractBrandContext({ html: `<link rel="icon" href="/favicon.ico">`, storeUrl });
    expect(onlyIco.brand.logoUrl).toBeUndefined();
  });
});
