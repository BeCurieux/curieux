/**
 * The engine's behaviour on labels that are awkward in specific ways.
 */

import { describe, expect, it } from "vitest";
import { ParsedLabel, type Profile } from "@/lib/schema";
import { Profile as ProfileSchema } from "@/lib/schema";
import { PROFILES } from "@/lib/profile";
import { FIXTURES } from "@/lib/fixtures";
import { verdictFor } from "@/lib/verdict/score";

const label = (over: Partial<ParsedLabel> = {}): ParsedLabel =>
  ParsedLabel.parse({
    category: "snack",
    productName: "Test",
    ingredients: [],
    containsStatement: [],
    truncated: false,
    note: null,
    ...over,
  });

const ing = (text: string, contains: string[] = []) => ({
  text,
  legibility: "clear" as const,
  readConfidence: 1,
  contains,
});

describe("nested sub-ingredients", () => {
  it("finds an allergen one level down, inside parentheses", () => {
    // The common case, and the one a flat read misses: the allergen is not in
    // the top-level ingredient name.
    const verdict = verdictFor(
      label({ ingredients: [ing("Chocolate Chips", ["Cocoa Mass", "Sugar", "Soy Lecithin"])] }),
      ProfileSchema.parse({ id: "t", label: "Soy", allergens: ["soy"] }),
    );
    expect(verdict.allergens[0]!.state).toBe("flagged");
    expect(verdict.allergens[0]!.matches).toEqual(["Chocolate Chips"]);
  });

  it("reads the contains statement without scoring it as an ingredient", () => {
    // "Contains: Milk" is a different legal statement from the ingredient list.
    // It must inform the allergen finding and must not become a flag or a
    // deduction of its own.
    const verdict = verdictFor(
      label({ ingredients: [ing("Water")], containsStatement: ["Milk"] }),
      ProfileSchema.parse({ id: "t", label: "Milk", allergens: ["milk"] }),
    );
    expect(verdict.allergens[0]!.state).toBe("flagged");
    expect(verdict.flags).toEqual([]);
    expect(verdict.score).toBe(100);
  });
});

describe("the score", () => {
  it("is withheld when the list is truncated", () => {
    const verdict = verdictFor(label({ ingredients: [ing("Sugar")], truncated: true }), PROFILES["keto"]!);
    expect(verdict.score).toBeNull();
  });

  it("is withheld when an ingredient is unreadable", () => {
    const verdict = verdictFor(
      label({
        ingredients: [ing("Sugar"), { text: "???", legibility: "unreadable", readConfidence: 0.1, contains: [] }],
      }),
      PROFILES["keto"]!,
    );
    expect(verdict.score).toBeNull();
  });

  it("survives a merely smudged ingredient, and says so", () => {
    // A partial read is a different thing from an unknown ingredient: we know
    // what it is, we read it imperfectly. Nulling the score here would refuse
    // to answer on most real photographs.
    const verdict = verdictFor(
      label({
        ingredients: [ing("Sugar"), { text: "Sea Salt", legibility: "partial", readConfidence: 0.6, contains: [] }],
      }),
      PROFILES["keto"]!,
    );
    expect(verdict.score).not.toBeNull();
    expect(verdict.incomplete).toBe(true);
    expect(verdict.caveats.join(" ")).toContain("Sea Salt");
  });

  it("is withheld when nothing was read at all", () => {
    const verdict = verdictFor(label({ ingredients: [] }), PROFILES["clean-label"]!);
    expect(verdict.score).toBeNull();
  });

  it("never leaves the 0–100 range however many flags land", () => {
    const many = label({
      category: "condiment",
      ingredients: [
        "Sugar",
        "High Fructose Corn Syrup",
        "Red 40",
        "Yellow 5",
        "Blue 1",
        "Titanium Dioxide",
        "Sucralose",
        "Aspartame",
        "BHA",
        "BHT",
        "TBHQ",
        "Sodium Benzoate",
        "Soybean Oil",
        "Partially Hydrogenated Cottonseed Oil",
        "Carrageenan",
        "Monosodium Glutamate",
      ].map((t) => ing(t)),
    });
    const everything: Profile = ProfileSchema.parse({
      id: "everything",
      label: "Everything",
      avoidances: [
        "seed-oils",
        "artificial-sweeteners",
        "artificial-colours",
        "artificial-preservatives",
        "added-sugar",
        "carrageenan",
        "titanium-dioxide",
        "msg",
      ],
    });
    expect(verdictFor(many, everything).score).toBe(0);
  });

  it("says nothing much to a profile that was never set", () => {
    // A verdict with no profile is close to meaningless, and the product should
    // not dress it up as one. Only the umbrella terms survive.
    const verdict = verdictFor(FIXTURES["rainbow-snack"], PROFILES["none"]!);
    expect(verdict.flags.every((f) => f.axis === null)).toBe(true);
    expect(verdict.allergens).toEqual([]);
  });
});

describe("flags", () => {
  it("shows one ingredient once, at its strongest reason", () => {
    // Titanium dioxide is red on its own axis and amber on artificial colours.
    // A profile carrying both used to print it twice — once in alarm, once to
    // explain itself.
    const verdict = verdictFor(label({ ingredients: [ing("Titanium Dioxide")] }), PROFILES["clean-label"]!);
    const forThat = verdict.flags.filter((f) => f.ingredient === "Titanium Dioxide");
    expect(forThat).toHaveLength(1);
    expect(forThat[0]!.severity).toBe("red");
  });

  it("keeps two genuinely different reasons on one ingredient", () => {
    // Wheat is gluten and wheat is a starch. Two reds, two reasons, both real.
    const coeliacKeto = ProfileSchema.parse({
      id: "t",
      label: "Coeliac and keto",
      intolerances: ["gluten"],
      protocols: ["keto"],
    });
    const flags = verdictFor(label({ ingredients: [ing("Wheat Flour")] }), coeliacKeto).flags;
    expect(flags.filter((f) => f.ingredient === "Wheat Flour").length).toBe(2);
  });

  it("orders red before amber before yellow", () => {
    const rank = { red: 3, amber: 2, yellow: 1 } as const;
    const flags = verdictFor(FIXTURES["rainbow-snack"], PROFILES["clean-label"]!).flags;
    const ranks = flags.map((f) => rank[f.severity]);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it("keeps the two confidences apart", () => {
    // CLAUDE.md collision 4: how sure we are we read the word, and how settled
    // the reason is, are different claims and never merge into one number.
    const verdict = verdictFor(
      label({
        ingredients: [{ text: "Aspartame", legibility: "partial", readConfidence: 0.55, contains: [] }],
      }),
      PROFILES["clean-label"]!,
    );
    const flag = verdict.flags.find((f) => f.ingredient === "Aspartame")!;
    expect(flag.readConfidence).toBe(0.55);
    expect(flag.strength).toBe("contested");
  });
});

describe("umbrella terms", () => {
  it("marks them amber, never red and never green", () => {
    const verdict = verdictFor(label({ ingredients: [ing("Natural Flavors")] }), PROFILES["clean-label"]!);
    const flag = verdict.flags.find((f) => f.ingredient === "Natural Flavors")!;
    expect(flag.severity).toBe("amber");
    expect(flag.axis).toBeNull();
  });

  it("does not by itself make an allergen unverifiable", () => {
    // US labelling requires the nine major allergens to be declared even inside
    // "natural flavors", so an umbrella term does not hide one — but the
    // reliance on that rule is said out loud rather than assumed silently.
    const verdict = verdictFor(
      label({ ingredients: [ing("Water"), ing("Natural Flavors")] }),
      ProfileSchema.parse({ id: "t", label: "Peanut", allergens: ["peanut"] }),
    );
    expect(verdict.allergens[0]!.state).toBe("not-flagged");
    expect(verdict.caveats.join(" ")).toContain("imported packaging");
  });

  it("explains a proprietary blend as a missing dose, not missing contents", () => {
    const verdict = verdictFor(FIXTURES["pre-workout"], PROFILES["supplements"]!);
    const flag = verdict.flags.find((f) => f.ingredient.startsWith("Proprietary Blend"))!;
    expect(flag.reason).toContain("how much");
    expect(verdict.caveats.join(" ")).toContain("proprietary blend");
  });

  it("puts no proprietary-blend caveat on a label that has none", () => {
    // "Protein Blend (Milk Protein Isolate, Whey Protein Concentrate)" names
    // its contents and hides nothing.
    const verdict = verdictFor(FIXTURES["protein-biscuit"], PROFILES["supplements"]!);
    expect(verdict.caveats.join(" ")).not.toContain("proprietary blend");
  });
});

describe("the seed-oil axis, per CLAUDE.md collision 3", () => {
  it("reds the cooking oils", () => {
    const verdict = verdictFor(label({ ingredients: [ing("Sunflower Oil")] }), PROFILES["clean-label"]!);
    expect(verdict.flags[0]!.severity).toBe("red");
  });

  it("does not red sunflower lecithin", () => {
    // The brief's own hero screenshot reds it. An axis flags what its audience
    // actually avoids, not everything sharing a word with it — and redding a
    // sub-1% emulsifier would red most chocolate and nut butter on the shelf.
    const verdict = verdictFor(label({ ingredients: [ing("Sunflower Lecithin")] }), PROFILES["clean-label"]!);
    const flag = verdict.flags.find((f) => f.ingredient === "Sunflower Lecithin")!;
    expect(flag.severity).toBe("amber");
    expect(flag.reason).toContain("emulsifier");
  });
});
