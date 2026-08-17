import { describe, expect, it } from "vitest";
import { SELECTION_CEILING, SELECTION_FLOOR, validatePlan } from "@/lib/merchandise/validate";
import { collectAllowedUrls } from "@/lib/merchandise/prompt";
import type { MerchandisingPlan, PlannedBlock } from "@/lib/merchandise/plan";
import { makeIngest } from "./helpers/ingest";

const ingest = makeIngest();
const allowedUrls = collectAllowedUrls(ingest);

function plan(blocks: { id: string; block: PlannedBlock }[], overrides: Partial<MerchandisingPlan> = {}): MerchandisingPlan {
  return {
    audience: "People arriving from the knitwear post",
    theme: {
      colorway: { background: "#faf8f4", surface: "#f2eee6", text: "#22201d", accent: "#2f5d50" },
      typography: "editorial-serif",
      mood: "editorial",
      density: "regular",
      cornerRadius: "soft",
    },
    blocks,
    ...overrides,
  };
}

function check(blocks: { id: string; block: PlannedBlock }[], prompt = "A shop for the knitwear post") {
  return validatePlan({ plan: plan(blocks), ingest, prompt, allowedUrls });
}

const grid = (products: { handle: string; blurb?: string; leadImageIndex?: number; variantId?: string }[], title?: string) =>
  ({
    id: "edit",
    block: { type: "productGrid" as const, ...(title ? { title } : {}), products, layout: "grid" as const },
  });

describe("a plan that is about this store", () => {
  it("accepts a plausible shop", () => {
    const result = check([
      { id: "hero", block: { type: "hero", headline: "Slow basics for a warm house", media: { kind: "productImage", handle: "oat-crew", imageIndex: 0 } } },
      grid([{ handle: "oat-crew", blurb: "The one that started it" }, { handle: "wool-throw" }]),
      { id: "links", block: { type: "linkList", links: [{ label: "Our workshop", url: "https://kelpandcotton.com/pages/about" }] } },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("rejects a product that is not in the catalogue", () => {
    const result = check([grid([{ handle: "cashmere-scarf" }])]);
    // The single most important check here: a phantom product is a shop that
    // takes an order the merchant cannot fill.
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('"cashmere-scarf"');
    expect(result.errors[0]).toContain("not in the catalogue");
  });

  it("rejects an image index the product does not have", () => {
    const result = check([grid([{ handle: "linen-tea-towel", leadImageIndex: 3 }])]);
    expect(result.errors[0]).toMatch(/leadImageIndex is 3 but "linen-tea-towel" has 1 image/);
  });

  it("rejects a variant that belongs to another product", () => {
    const result = check([grid([{ handle: "wool-throw", variantId: "41001" }])]);
    expect(result.errors[0]).toContain('is not a variant of "wool-throw"');
  });

  it("rejects a hero image index out of range", () => {
    const result = check([
      { id: "hero", block: { type: "hero", headline: "Hello", media: { kind: "productImage", handle: "oat-crew", imageIndex: 9 } } },
    ]);
    expect(result.errors[0]).toContain("media.imageIndex is 9");
  });
});

describe("URLs", () => {
  it("rejects a link the ingest never saw", () => {
    const result = check([
      { id: "links", block: { type: "linkList", links: [{ label: "Sale", url: "https://kelpandcotton.com/collections/sale" }] } },
    ]);
    // A generated shop linking somewhere the merchant does not control is the
    // worst failure this system could have.
    expect(result.errors[0]).toContain("was not in the brief");
  });

  it("accepts a link that came from the homepage", () => {
    const result = check([
      { id: "links", block: { type: "linkList", links: [{ label: "Knitwear", url: "https://kelpandcotton.com/collections/knitwear" }] } },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("rejects a hero brandAsset that is not an ingested image", () => {
    const result = check([
      { id: "hero", block: { type: "hero", headline: "Hello", media: { kind: "brandAsset", url: "https://cdn.shopify.com/invented.jpg" } } },
    ]);
    expect(result.errors[0]).toContain("was not in the brief");
  });

  it("accepts the ingested logo as hero media", () => {
    const result = check([
      { id: "hero", block: { type: "hero", headline: "Hello", media: { kind: "brandAsset", url: ingest.brand.logoUrl! } } },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("rejects the sprint-3 uploaded media kind", () => {
    const result = check([
      { id: "hero", block: { type: "hero", headline: "Hello", media: { kind: "uploaded", assetId: "asset_1" } } },
    ]);
    expect(result.errors[0]).toContain("not available yet");
  });
});

describe("claims the page may not make", () => {
  it("rejects a sync claim", () => {
    // The brief is explicit: nothing may claim liveness that isn't wired.
    const result = check([{ id: "hero", block: { type: "hero", headline: "Always in sync with our store" } }]);
    expect(result.errors[0]).toContain("claims the shop syncs");
  });

  it("rejects review and rating claims", () => {
    for (const headline of ["Loved by 2,000 reviews", "Rated 4.8 stars"]) {
      const result = check([{ id: "hero", block: { type: "hero", headline } }]);
      expect(result.errors[0], headline).toContain("review or rating data");
    }
  });

  it("rejects stock claims", () => {
    const result = check([grid([{ handle: "oat-crew", blurb: "Only 3 left" }])]);
    expect(result.errors[0]).toContain("states a stock level");
  });

  it("rejects a price stated in copy", () => {
    const result = check([grid([{ handle: "oat-crew", blurb: "Yours for £148" }])]);
    expect(result.errors[0]).toContain("£148");
    expect(result.errors[0]).toContain("resolved live");
  });

  it("allows a price the merchant asked for as a threshold", () => {
    const result = check([grid([{ handle: "linen-tea-towel" }], "Everything under £80")]);
    expect(result.errors).toEqual([]);
  });

  it("rejects a threshold the selection does not honour", () => {
    // "Under £80" over a £215 throw is a false claim on the page, not a
    // stylistic quibble.
    const result = check([grid([{ handle: "wool-throw" }], "Everything under £80")]);
    expect(result.errors[0]).toContain("promises");
    expect(result.errors[0]).toContain("above 80");
  });
});

describe("offer codes and launch dates", () => {
  const offer = (code: string) => [
    { id: "offer", block: { type: "offer" as const, code, description: "15% off for Jess's followers" } },
  ];

  it("rejects a code the merchant never gave", () => {
    const result = validatePlan({ plan: plan(offer("SAVE20")), ingest, prompt: "A shop for Jess", allowedUrls });
    expect(result.errors[0]).toContain("Never invent a discount code");
  });

  it("accepts a code from the merchant's own words", () => {
    const result = validatePlan({
      plan: plan(offer("JESS15")),
      ingest,
      prompt: "Make one for Jess using her five favourite products and JESS15.",
      allowedUrls,
    });
    expect(result.errors).toEqual([]);
  });

  it("rejects a launch date the merchant never gave", () => {
    const result = validatePlan({
      plan: plan([
        { id: "drop", block: { type: "drop", title: "New in", products: [{ handle: "oat-crew" }], launchesAt: "2026-09-01T09:00:00.000Z" } },
      ]),
      ingest,
      prompt: "A shop for the new knitwear",
      allowedUrls,
    });
    expect(result.errors[0]).toContain("no launch date");
  });
});

describe("theme", () => {
  const withColorway = (colorway: Record<string, string>) =>
    validatePlan({
      plan: {
        ...plan([{ id: "hero", block: { type: "hero", headline: "Hello" } }]),
        theme: {
          colorway: colorway as MerchandisingPlan["theme"]["colorway"],
          typography: "modern-sans",
          mood: "clean",
          density: "regular",
          cornerRadius: "soft",
        },
      },
      ingest,
      prompt: "A shop",
      allowedUrls,
    });

  it("rejects body text nobody can read", () => {
    const result = withColorway({ background: "#ffffff", surface: "#f4f4f4", text: "#eeeeee", accent: "#2f5d50" });
    expect(result.errors[0]).toContain("contrast");
    expect(result.errors[0]).toContain("4.5:1");
  });

  it("holds accent to 3:1, not to body-text contrast", () => {
    // Accent carries buttons and rules; holding it to 4.5:1 rejects almost
    // every real brand colour.
    const ok = withColorway({ background: "#ffffff", surface: "#f4f4f4", text: "#111111", accent: "#767676" });
    expect(ok.errors).toEqual([]);
    const bad = withColorway({ background: "#ffffff", surface: "#f4f4f4", text: "#111111", accent: "#eeeeee" });
    expect(bad.errors[0]).toContain("3:1");
  });

  it("rejects a colour that is not a colour", () => {
    const result = withColorway({ background: "warm cream", surface: "#f4f4f4", text: "#111111", accent: "#2f5d50" });
    expect(result.errors[0]).toContain("not a CSS colour");
  });
});

describe("structure", () => {
  it("rejects duplicate block ids", () => {
    const result = check([
      { id: "edit", block: { type: "hero", headline: "Hello" } },
      grid([{ handle: "oat-crew" }]),
    ]);
    expect(result.errors[0]).toContain("duplicate block id");
  });

  it("rejects a CTA pointing at a block that does not exist", () => {
    const result = check([
      { id: "hero", block: { type: "hero", headline: "Hello", cta: { label: "Shop", targetBlockId: "nope" } } },
    ]);
    expect(result.errors[0]).toContain("not the id of any block");
  });

  it("rejects a second hero", () => {
    const result = check([
      { id: "a", block: { type: "hero", headline: "One" } },
      { id: "b", block: { type: "hero", headline: "Two" } },
    ]);
    expect(result.errors[0]).toContain("2 hero blocks");
  });
});

describe("warnings, which never trigger a retry", () => {
  it("notices when every sold-out product was quietly dropped", () => {
    const result = check([grid([{ handle: "oat-crew" }, { handle: "wool-throw" }])]);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes("sold-out"))).toBe(true);
  });

  it("stays quiet when the merchant asked for in-stock only", () => {
    const result = check([grid([{ handle: "oat-crew" }])], "Only show what's in stock");
    expect(result.warnings.some((w) => w.includes("sold-out"))).toBe(false);
  });

  it("flags a selected product with no photograph", () => {
    const result = check([grid([{ handle: "care-card" }])]);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes("no imagery"))).toBe(true);
  });
});

/**
 * Did it merchandise, or put headings on the catalogue?
 *
 * From the first real run: given a brief with a constraint to check itself
 * against the model selects well, and given an open-ended one it returned ten
 * products out of ten. Nothing caught that — the plan was valid in every other
 * respect, which is exactly why it needs a check of its own.
 */
describe("whether it selected at all", () => {
  /** The shared fixture is four products; this check needs a real choice. */
  const wide = makeIngest();
  const spread = {
    ...wide,
    catalogue: {
      ...wide.catalogue,
      products: Array.from({ length: 10 }, (_, i) => ({
        ...wide.catalogue.products[i % wide.catalogue.products.length]!,
        handle: `thing-${i}`,
      })),
      productCount: 10,
    },
  };
  const wideUrls = collectAllowedUrls(spread);

  const pick = (n: number, prompt = "A shop for the knitwear post") =>
    validatePlan({
      plan: plan([grid(Array.from({ length: n }, (_, i) => ({ handle: `thing-${i}` })))]),
      ingest: spread,
      prompt,
      allowedUrls: wideUrls,
    });

  it("says so when most of the catalogue made the page", () => {
    const result = pick(8);
    expect(result.warnings.some((w) => w.includes("8 of 10"))).toBe(true);
  });

  it("stays quiet when a real edit was made", () => {
    expect(pick(3).warnings.some((w) => w.includes("of 10"))).toBe(false);
  });

  it("warns rather than failing, so a clearance edit still ships", () => {
    /*
     * The design decision, held as a test.
     *
     * The obvious implementation rejects and lets the retry loop force a
     * smaller selection — and it would have failed the best shop the first
     * real run produced, "still in stock, cheapest first", which legitimately
     * took every available product because breadth was the brief. Nothing here
     * can tell that apart from a model that gave up, so it reports and asks
     * rather than pretending to know.
     */
    const result = pick(10);
    expect(result.errors).toEqual([]);
  });

  it("says nothing about a catalogue too small to edit", () => {
    // Four products is not an edit waiting to be made, and warning about it
    // would train people to ignore the warning — the only thing that can
    // actually break a check like this.
    const all = check([grid([{ handle: "oat-crew" }, { handle: "wool-throw" }, { handle: "care-card" }])]);
    expect(all.warnings.some((w) => w.includes("made the page"))).toBe(false);
  });

  it("stands down when the brief asked for the lot", () => {
    expect(pick(10, "Show everything we sell").warnings.some((w) => w.includes("made the page"))).toBe(false);
  });

  it("keeps its threshold somewhere a person can argue with it", () => {
    // Not a behaviour test. This number is a judgement made against six real
    // generations, and it should stay findable and changeable.
    expect(SELECTION_CEILING).toBeGreaterThan(0.5);
    expect(SELECTION_CEILING).toBeLessThan(1);
    expect(SELECTION_FLOOR).toBeGreaterThanOrEqual(2);
  });
});
