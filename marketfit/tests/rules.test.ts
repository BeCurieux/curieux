import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assess } from "@/engine/assess.js";
import { Rule } from "@/engine/rules.js";
import { canonicalJson, createSnapshot } from "@/engine/snapshot.js";
import { loadRules, loadSnapshot, parseRuleFile, RulesLoadError } from "@/rules/load.js";
import { seedSql } from "@/rules/sql.js";
import { AS_OF, product, rule } from "./helpers.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const RULES = path.join(ROOT, "rules");

const VALID = `
kind: required_field
title: Net quantity missing
fix: State it.
severity: needs_attention
confidence: drafted
version: 1
params:
  facts: [net_quantity]
citation:
  regulation: Regulation (EU) No 1169/2011
  article: Art. 9(1)(e)
  url: https://eur-lex.europa.eu/eli/reg/2011/1169/oj
  effective_from: "2014-12-13"
`;

const FROM = { market: "EU", category: "supplements", rule_key: "net-quantity" } as const;

describe("parseRuleFile", () => {
  it("takes market, category and key from the path", () => {
    const result = parseRuleFile(VALID, FROM);
    expect(result.ok && result.rule).toMatchObject(FROM);
  });

  it("refuses a file that disagrees with its path", () => {
    const result = parseRuleFile(`market: US\n${VALID}`, FROM);
    expect(!result.ok && result.problems[0]).toMatch(/market is "US" but the path says "EU"/);
  });

  it.each([
    ["no citation", VALID.replace(/citation:[\s\S]*$/, "")],
    ["a citation without a URL", VALID.replace(/ {2}url: .*\n/, "")],
    ["an http URL", VALID.replace("https://", "http://")],
    ["a citation without an effective date", VALID.replace(/ {2}effective_from: .*\n/, "")],
    ["an unknown fact key", VALID.replace("[net_quantity]", "[net_qty]")],
    ["an unknown kind", VALID.replace("required_field", "vibes")],
    ["an unknown field", `${VALID}colour: red\n`],
    ["an unknown confidence", VALID.replace("drafted", "pretty sure")],
    ["params for another kind", VALID.replace("facts: [net_quantity]", "phrases: [cures]")],
    ["not YAML", "kind: [unclosed"],
    ["a list instead of a rule", "- a\n- b\n"],
  ])("refuses %s", (_, source) => {
    expect(parseRuleFile(source, FROM).ok).toBe(false);
  });

  it("refuses effective_to before effective_from", () => {
    const source = VALID.replace('effective_from: "2014-12-13"', 'effective_from: "2014-12-13"\n  effective_to: "2014-01-01"');
    expect(parseRuleFile(source, FROM).ok).toBe(false);
  });

  it("refuses applies_if with both or neither condition", () => {
    expect(parseRuleFile(`${VALID}applies_if: {}\n`, FROM).ok).toBe(false);
    expect(parseRuleFile(`${VALID}applies_if:\n  fact_present: claims\n  ingredient_any: [iron]\n`, FROM).ok).toBe(false);
    expect(parseRuleFile(`${VALID}applies_if:\n  fact_present: claims\n`, FROM).ok).toBe(true);
  });
});

describe("loadRules", () => {
  async function tree(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "marketfit-rules-"));
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), content);
    }
    return root;
  }

  it("reports every problem at once, with its file", async () => {
    const root = await tree({
      "eu/supplements/good.yaml": VALID,
      "eu/supplements/bad.yaml": VALID.replace("required_field", "vibes"),
      "fr/supplements/x.yaml": VALID,
      "us/supplements/also-bad.yml": "kind: [",
      "us/supplements/notes.txt": "ignored",
    });
    const error = await loadRules(root).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RulesLoadError);
    const problems = (error as RulesLoadError).problems.join("\n");
    expect(problems).toContain("eu/supplements/bad.yaml");
    expect(problems).toContain("fr/: not a market");
    expect(problems).toContain("us/supplements/also-bad.yml");
    expect(problems).not.toContain("good.yaml");
  });

  it("loads a valid tree", async () => {
    const root = await tree({ "uk/supplements/net-quantity.yaml": VALID });
    const loaded = await loadRules(root);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.rule).toMatchObject({ market: "UK", rule_key: "net-quantity" });
  });
});

describe("snapshot", () => {
  it("versions by content, not by order or key order", () => {
    const a = rule({ rule_key: "a", kind: "claim", params: { phrases: ["x"] } });
    const b = rule({ rule_key: "b", kind: "claim", params: { phrases: ["y"] } });
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as Rule;
    expect(createSnapshot([a, b]).version).toBe(createSnapshot([b, reordered]).version);
    expect(createSnapshot([a]).version).not.toBe(createSnapshot([a, b]).version);
    const edited = { ...a, params: { phrases: ["z"] } } as Rule;
    expect(createSnapshot([edited, b]).version).not.toBe(createSnapshot([a, b]).version);
  });

  it("refuses duplicate ids and invalid rules", () => {
    const a = rule({ rule_key: "dup", kind: "claim", params: { phrases: ["x"] } });
    expect(() => createSnapshot([a, a])).toThrow(/Duplicate rule id/);
    expect(() => createSnapshot([{ ...a, citation: undefined }])).toThrow();
  });

  it("canonical JSON drops undefined and sorts keys", () => {
    expect(canonicalJson({ b: 1, a: [undefined, { d: undefined, c: "x" }] })).toBe('{"a":[null,{"c":"x"}],"b":1}');
  });
});

describe("the seed rules", () => {
  it("load, with at least ten per market, every one cited", async () => {
    const snapshot = await loadSnapshot(RULES);
    for (const market of ["EU", "UK", "US"]) {
      expect(snapshot.rules.filter((r) => r.market === market).length).toBeGreaterThanOrEqual(10);
    }
    for (const r of snapshot.rules) {
      expect(r.citation.url).toMatch(/^https:\/\//);
      expect(r.citation.regulation.length).toBeGreaterThan(0);
    }
  });

  it("are not verified: the founder verifies rules, not the build", async () => {
    const snapshot = await loadSnapshot(RULES);
    expect(snapshot.rules.filter((r) => r.confidence === "verified")).toEqual([]);
  });

  it("match supabase/seed.sql — run `pnpm rules:sql` after editing a rule", async () => {
    const committed = await readFile(path.join(ROOT, "supabase/seed.sql"), "utf8");
    expect(committed).toBe(seedSql(await loadSnapshot(RULES)));
  });

  it("every file is named in kebab-case", async () => {
    for (const market of await readdir(RULES)) {
      for (const file of await readdir(path.join(RULES, market, "supplements"))) {
        expect(file).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.yaml$/);
      }
    }
  });

  // If the seeds were verified, a fully labelled product would be ready in
  // each market and a bare one would not. This is what catches a statement
  // with a typo in it, which would otherwise fail every product forever.
  describe.each([
    [
      "EU",
      product({
        product_name: "Nahrungsergänzungsmittel",
        languages: ["de"],
        ingredients: [{ name: "Vitamin D3", amount: 10, unit: "µg" }],
        daily_dose: "1 Kapsel täglich",
        daily_servings: 1,
        net_quantity: "60 Kapseln (18 g)",
        responsible_person_name: "Beispiel GmbH",
        responsible_person_address: "Musterstraße 1, 10115 Berlin",
        best_before: true,
        batch_code: true,
        claims: ["Vitamin D trägt zur Erhaltung normaler Knochen bei."],
        label_text: [
          "Nahrungsergänzungsmittel mit Vitamin D3.",
          "Die angegebene empfohlene tägliche Verzehrsmenge darf nicht überschritten werden.",
          "Nahrungsergänzungsmittel sind kein Ersatz für eine ausgewogene und abwechslungsreiche Ernährung und eine gesunde Lebensweise.",
          "Für kleine Kinder unzugänglich aufbewahren.",
        ].join("\n"),
      }),
    ],
    [
      "UK",
      product({
        languages: ["en"],
        ingredients: [{ name: "Vitamin C", amount: 80, unit: "mg" }],
        daily_dose: "1 tablet a day",
        daily_servings: 1,
        net_quantity: "60 tablets",
        responsible_person_name: "Example Ltd",
        responsible_person_address: "1 High Street, London",
        best_before: true,
        batch_code: true,
        claims: ["Vitamin C contributes to the normal function of the immune system."],
        label_text: [
          "Food supplement with vitamin C.",
          "Do not exceed the recommended daily dose.",
          "Food supplements should not be used as a substitute for a varied and balanced diet and a healthy lifestyle.",
          "Store out of the reach of young children.",
        ].join("\n"),
      }),
    ],
    [
      "US",
      product({
        languages: ["en"],
        ingredients: [{ name: "Iron (as ferrous bisglycinate)", amount: 18, unit: "mg" }],
        nutrition_panel: true,
        net_quantity: "60 capsules",
        manufacturer_name: "Example Inc.",
        manufacturer_address: "Austin, TX 78701",
        adverse_event_contact: "1-800-555-0100",
        claims: ["Supports healthy energy levels."],
        label_text: [
          "Iron dietary supplement.",
          "This statement has not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
          "WARNING: Accidental overdose of iron-containing products is a leading cause of fatal poisoning in children under 6. Keep this product out of reach of children. In case of accidental overdose, call a doctor or poison control center immediately.",
        ].join("\n"),
      }),
    ],
  ] as const)("%s", (market, good) => {
    async function verifiedSeeds() {
      const snapshot = await loadSnapshot(RULES);
      return createSnapshot(snapshot.rules.map((r) => ({ ...r, confidence: "verified" as const })));
    }

    it("a fully labelled product passes every rule but the to-dos", async () => {
      const result = assess(good, market, await verifiedSeeds(), { asOf: AS_OF });
      const unmet = result.findings.filter((f) => f.status !== "pass" && f.kind !== "registration");
      expect(unmet).toEqual([]);
      expect(result.score).toBe("ready");
    });

    it("a bare product is not ready, and every fail carries a fix and a citation", async () => {
      const bare = product({ languages: market === "EU" ? ["de"] : ["en"], ingredients: [], claims: [], label_text: "" });
      const result = assess(bare, market, await verifiedSeeds(), { asOf: AS_OF });
      expect(["blocked", "needs_attention"]).toContain(result.score);
      for (const finding of result.findings.filter((x) => x.status === "fail")) {
        expect(finding.fixText).toBeTruthy();
        expect(finding.citation.url).toMatch(/^https:\/\//);
      }
    });
  });
});
