import { describe, expect, it } from "vitest";
import { choosePops, outreachNote, popSlug } from "@/lib/killtest/pops";
import type { Suggestion } from "@/lib/pop/suggest";
import { PopBrief } from "@/lib/pop/brief";
import { recordOutcome, addTargets, emptyLedger, verdict } from "@/lib/killtest/index";

const suggestion = (occasion: string, audience: string, context: string | null, handles: number, genomeOnly: number, rank = handles): Suggestion => {
  const targets = { occasion_fit: [], audience_fit: [], use_context: context ? [context] : [], gift_role: [], seasonality: [], item_type: [], style_register: [] };
  const persona = audience === "men" ? "dads" : "mums";
  return {
    sentence: `Make a shop for ${persona}${context ? ` ${context}` : ""}.`,
    brief: PopBrief.parse({
      sentence: "x",
      who: { audienceFit: [audience], persona },
      why: { occasionFit: [occasion], campaign: null },
      goal: "conversion",
      rules: { priceMax: null, priceScope: "per_item", minUnits: null, includeHandles: [], excludeHandles: [], shipBy: null, marginMin: null },
      targets,
      mentions: [],
      ruleSource: { priceMax: "none" },
    }),
    handles: Array.from({ length: handles }, (_, i) => `h${i}`),
    genomeOnly: Array.from({ length: genomeOnly }, (_, i) => `h${i}`),
    priceCap: null,
    rank,
  };
};

describe("the v5 kill test", () => {
  it("sends the Genome-led POPs first, and never two for the same occasion and audience", () => {
    const picked = choosePops(
      [
        suggestion("fathers_day", "men", null, 12, 1, 20),
        suggestion("fathers_day", "men", "water_coastal", 8, 6, 18),
        suggestion("mothers_day", "women", null, 10, 5, 15),
        suggestion("christmas_holiday", "men", null, 9, 0, 9),
      ],
      2,
    );
    expect(picked.map((p) => `${p.brief.why.occasionFit[0]}|${p.brief.targets.use_context[0] ?? ""}`)).toEqual(["fathers_day|water_coastal", "mothers_day|"]);
  });

  it("names each POP after the brand and the brief, within the slug limit", () => {
    const slug = popSlug("Kelp & Cotton Co.", suggestion("fathers_day", "men", "water_coastal", 8, 6));
    expect(slug).toBe("kelp-and-cotton-co-fathers-day-dads");
    expect(popSlug("Kelp", suggestion("fathers_day", "men", "water_coastal", 8, 6))).toBe("kelp-fathers-day-dads-water");
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it("drafts a note that says it is not live, and leads with what only the Genome found", () => {
    const note = outreachNote("Kelp & Cotton", [
      { slug: "a", url: "https://popuup.co/a", sentence: "Make a Father's Day shop for dads who love the water. Under $120.", products: 8, genomeOnly: ["Canvas Cap", "Deck Shoes"] },
      { slug: "b", url: "https://popuup.co/b", sentence: "Make a Mother's Day shop for mums.", products: 6, genomeOnly: [] },
    ]);
    expect(note).toMatch(/aren't live, and they don't sync yet/);
    expect(note).toContain("Canvas Cap, Deck Shoes");
    expect(note).toContain("Would you have picked them?");
    expect(note).toContain("every product is one a keyword collection would also reach");
    expect(note).not.toMatch(/synced\b(?! yet)/);
  });

  it("records the POPs on the ledger without touching the verdict's arithmetic", () => {
    const now = new Date("2026-09-27T00:00:00Z");
    let ledger = addTargets(emptyLedger(now), [{ storeUrl: "https://a.example" }], now);
    ledger = recordOutcome(ledger, "https://a.example", { slug: "a", shopUrl: "/a", pops: [{ slug: "a", url: "/a", sentence: "s", genomeOnly: ["x"] }] }, now);
    expect(ledger.targets[0]!.pops).toHaveLength(1);
    expect(verdict(ledger).generated).toBe(1);
  });
});
