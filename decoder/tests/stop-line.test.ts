/**
 * §19's do-not-build list, and §26's gate, as a test.
 *
 * BRIEF.md §22 and §26: mock creative first, and *"Proceed only if mock
 * creative demonstrates genuine product intent."* CLAUDE.md's build order ends
 * at a stop, and this file is what makes the stop cost something.
 *
 * None of the gated features arrives announcing itself as gated. The paywall
 * arrives as "RevenueCat is twenty minutes". Scan history arrives as "we
 * already have the verdict object, it's one table". Each is individually
 * reasonable, and collectively they are why the mock-ups never get filmed and
 * §27's kill criteria never get to fire.
 *
 * If a check here goes red, that is not a bug. It is somebody having built past
 * the gate, and the honest fix is to delete the feature or to open the gate on
 * purpose — deleting the check in the same commit, so the rule is removed where
 * it is written down rather than renamed around.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Finding, ParsedLabel, Verdict } from "@/lib/schema";
import { ALL_PRESETS } from "@/lib/rules/presets";

const SRC = path.join(process.cwd(), "src");

async function sourceFiles(): Promise<{ file: string; text: string }[]> {
  const { glob } = await import("node:fs/promises");
  const files: string[] = [];
  for await (const entry of glob("**/*.ts", { cwd: SRC })) files.push(entry as string);
  return Promise.all(files.map(async (file) => ({ file, text: await readFile(path.join(SRC, file), "utf8") })));
}

/** Code, with comments stripped — a rule about behaviour, not about prose. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ")
    .toLowerCase();
}

describe("the Phase 0 gate holds", () => {
  it("finds source files at all", async () => {
    // Guards the guard. Every assertion below is "no file matches", which a
    // broken glob satisfies perfectly.
    const files = await sourceFiles();
    expect(files.length).toBeGreaterThan(10);
  });

  it("takes no money and knows nothing about a subscription", async () => {
    // §20's whole monetisation section is downstream of the gate, and it is the
    // most tempting thing to build early because it is the part that looks like
    // a business.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bstripe\b|\brevenuecat\b|\bsuperwall\b|\bpaywall\b|\bsubscription\b|\bcheckout\.session|\bprice_1[a-z0-9]|\bin-?app\s?purchase|\bstorekit\b|\bfree scans?\b/.test(
        code(text),
      ),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("persists nothing and has no backend", async () => {
    // §18 lists Supabase and history in V1; both are behind the gate. A scan
    // that is not stored is also a scan that cannot leak, which §17 Rule 6
    // makes a design goal rather than a side effect — the first thing this
    // product would hold is a list of what somebody avoids.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bsupabase\b|\bscan_?history\b|\bcreate\s+table\b|\bprisma\b|\bdrizzle\b|\blocalstorage\b|\bindexeddb\b/.test(
        code(text),
      ),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("has no app shell", async () => {
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\breact-native\b|\bexpo-|\bfrom\s+["']expo["']|\bnavigator\.mediadevices\b/.test(code(text)),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("builds none of §19's do-not-build list", async () => {
    // Android, calorie and macro tracking, meal logging, weight loss, a food
    // diary, a barcode database, a social feed, a chatbot, recipes,
    // personalised nutrition plans, supermarket and restaurant integrations,
    // a substitute marketplace, a wellness dashboard.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bbarcode\b|\bupc\b|\bean-?13\b|\bfood\s?log\b|\bdiary\b|\bstreak\b|\bchatbot\b|\bnutrition\s?plan\b|\bmeal\s?plan\b|\bsocial\s?feed\b|\bfollowers\b|\brecipes?\b|\bdashboard\b/.test(
        code(text),
      ),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("recommends no substitute product — §10", async () => {
    // "V1 should not automatically recommend a specific substitute unless
    // product data is trustworthy and verified. Otherwise the product creates a
    // second hallucination surface: Product X is bad → buy Product Y."
    //
    // Compare mode is the sanctioned alternative, and it only ever ranks two
    // labels the user photographed themselves.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bsubstitute\b|\balternative\s?product\b|\brecommend(ed)?\s?product\b|\bbetter\s?pick\b|\blook\s?for\s?instead\b|\bbuy\s?instead\b/.test(
        code(text),
      ),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);

    // And nothing in the graph or the presets names a brand to go and buy.
    const Finding_ = Object.keys(Finding.shape);
    expect(Finding_).not.toContain("lookFor");
    expect(Finding_).not.toContain("alternative");
  });

  it("keeps the provider SDK inside the two adapters", async () => {
    // §31: never call the model integration the moat. Keeping it at the edges
    // is how that stays true in the code rather than only in the pitch.
    const allowed = [path.join("lib", "parse", "anthropic.ts"), path.join("lib", "rules", "anthropic.ts")];
    const files = await sourceFiles();
    const offenders = files.filter(
      ({ file, text }) =>
        !allowed.includes(file) &&
        /from\s+["']@anthropic-ai\/|from\s+["']openai["']|require\(["']@anthropic-ai\//.test(text),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("has no learned weights — nothing here improves itself", async () => {
    // §15's moat is built from captured data, not from a model that trains on
    // it. Until that is a deliberate project, a constant shaped for one is the
    // rule broken quietly.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bexperiment\b|\bab_?test\b|\bvariant_?group\b|\bbandit\b|\bweights?\s*[:=]\s*[[{]|\bembedding\b|\btrain(ing)?_?data\b/.test(
        code(text),
      ),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });
});

describe("§33's principles hold in the type system", () => {
  it('gives the model nowhere to put a verdict — "AI reads, the rules engine decides"', () => {
    const fields = Object.keys(ParsedLabel.shape);
    for (const forbidden of ["match", "score", "blockers", "flags", "verdict", "advice", "safe", "healthy"]) {
      expect(fields, `ParsedLabel must not have a "${forbidden}" field`).not.toContain(forbidden);
    }
    expect(fields.sort()).toEqual(
      ["category", "containsStatement", "ingredients", "note", "productName", "truncated"].sort(),
    );
  });

  it("discards a vision response that tries to hand back a verdict", () => {
    const smuggled = {
      category: "snack",
      productName: "Something",
      ingredients: [{ text: "Sugar", legibility: "clear", readConfidence: 1, contains: [] }],
      containsStatement: [],
      truncated: false,
      note: null,
      match: 12,
      blockers: [{ ingredient: "Sugar" }],
    };
    // Zod strips unknown keys rather than throwing, which is the right
    // behaviour and also why this test exists: the smuggled verdict does not
    // raise an error, it simply ceases to exist before anything downstream
    // could read it.
    const parsed = ParsedLabel.parse(smuggled);
    expect(parsed).not.toHaveProperty("match");
    expect(parsed).not.toHaveProperty("blockers");
  });

  it('makes a finding name its rule — "the user\'s rules determine the verdict"', () => {
    expect(Object.keys(Finding.shape)).toContain("ruleId");
    expect(Object.keys(Finding.shape)).toContain("because");
  });

  it('keeps uncertainty a first-class outcome — "uncertainty must be visible"', () => {
    expect(Finding.shape.outcome.options).toContain("uncertain");
    expect(Object.keys(Verdict.shape)).toContain("uncertain");
    expect(Object.keys(Verdict.shape)).toContain("needsVerification");
  });

  it("requires a verdict to carry its provenance", () => {
    // §25's dispute rate and §15's evaluation dataset both need to join a
    // complaint back to the engine, the graph and the rules that produced it.
    expect(Object.keys(Verdict.shape)).toContain("provenance");
  });

  it("has no preset that decides anything on the user's behalf", () => {
    // §17 Rule 4. Every rule in every preset attributes itself to the user, and
    // the schema enforces the sentence shape — this asserts nobody has added a
    // preset that routes around it with a `never-flag`.
    for (const preset of ALL_PRESETS) {
      for (const rule of preset.rules) {
        expect(rule.because.toLowerCase(), `${preset.id}/${rule.id}`).toMatch(/\byou\b|\byour\b/);
      }
    }
  });
});
