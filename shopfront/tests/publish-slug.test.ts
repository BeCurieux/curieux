/**
 * The slug is the most public string this system produces, and the one that is
 * hardest to take back — it goes into an Instagram bio and gets copied into
 * places nobody can edit.
 */

import { describe, expect, it } from "vitest";
import { allocateSlug, checkSlug, slugify, RESERVED_SLUGS, SLUG_MAX } from "@/lib/publish/slug";

describe("slugify", () => {
  it("makes a brand name into something typeable", () => {
    expect(slugify("Kelp & Cotton")).toBe("kelp-and-cotton");
    expect(slugify("  Oat   Crew  ")).toBe("oat-crew");
  });

  it("folds diacritics rather than deleting them", () => {
    // "caf-lumi-re" is a URL a merchant would not recognise as their own.
    expect(slugify("Café Lumière")).toBe("cafe-lumiere");
    expect(slugify("Ø Studio")).toBe("studio");
  });

  it("spells out the ampersand, which shop names are full of", () => {
    expect(slugify("Salt & Stone")).toBe("salt-and-stone");
  });

  it("never produces a leading or trailing hyphen, at any length", () => {
    for (const input of ["!!!Hello!!!", "—dash—", "a".repeat(60) + " & more"]) {
      const slug = slugify(input);
      expect(slug, input).not.toMatch(/^-|-$/);
      expect(slug.length, input).toBeLessThanOrEqual(SLUG_MAX);
    }
  });
});

describe("checkSlug", () => {
  it("accepts what it should", () => {
    for (const slug of ["kelp-and-cotton", "abc", "shop-2", "a1b2c3"]) {
      expect(checkSlug(slug), slug).toEqual({ ok: true });
    }
  });

  it("refuses shapes that would be ambiguous or ugly in a bio", () => {
    for (const slug of ["ab", "-leading", "trailing-", "Has-Capitals", "has spaces", "has_underscore"]) {
      expect(checkSlug(slug).ok, slug).toBe(false);
    }
  });

  it("refuses anything that looks like a file", () => {
    // Otherwise `/sitemap.xml` is a coin toss between a shop and an asset.
    expect(checkSlug("logo.png").ok).toBe(false);
  });

  it("holds back every word the app might want as a page", () => {
    // Next matches static segments first, so a shop that took one of these
    // would simply stop resolving the day that route shipped — silently.
    for (const reserved of ["api", "preview", "pricing", "about", "popuup", "settings"]) {
      expect(checkSlug(reserved).ok, reserved).toBe(false);
    }
    expect(RESERVED_SLUGS.size).toBeGreaterThan(50);
  });
});

describe("allocateSlug", () => {
  it("takes the plain name when it is free", async () => {
    expect(await allocateSlug("Kelp & Cotton", { isTaken: async () => false })).toBe("kelp-and-cotton");
  });

  it("counts up rather than randomising", async () => {
    // "kelp-and-cotton-2" can be read down a phone; "kelp-and-cotton-f3a9" cannot.
    const taken = new Set(["kelp-and-cotton", "kelp-and-cotton-2"]);
    expect(await allocateSlug("Kelp & Cotton", { isTaken: async (s) => taken.has(s) })).toBe("kelp-and-cotton-3");
  });

  it("keeps the suffix inside the length limit", async () => {
    const long = "a".repeat(SLUG_MAX);
    const slug = await allocateSlug(long, { isTaken: async (s) => s === long });
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug).toMatch(/-2$/);
  });

  it("skips a reserved name instead of handing it out", async () => {
    const slug = await allocateSlug("Pricing", { isTaken: async () => false });
    expect(slug).not.toBe("pricing");
    expect(checkSlug(slug)).toEqual({ ok: true });
  });

  it("falls back to something usable for a name with nothing in it", async () => {
    const slug = await allocateSlug("!!!", { isTaken: async () => false });
    expect(checkSlug(slug)).toEqual({ ok: true });
  });

  it("gives up loudly rather than looping forever", async () => {
    await expect(allocateSlug("taken", { isTaken: async () => true, maxAttempts: 5 })).rejects.toThrow(/free URL/);
  });
});
