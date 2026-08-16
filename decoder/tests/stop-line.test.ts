/**
 * Step 5 — Stop — as a test.
 *
 * BRIEF.md §9 and §12: *"Three seeded TikToks using a mocked result screen …
 * No pull, no build"*, and *"Proceed to build only if Phase 0 fake-door
 * clears."* CLAUDE.md's build order ends at a stop, and this file is what makes
 * the stop cost something.
 *
 * None of the gated features arrives announcing itself as gated. The paywall
 * arrives as "RevenueCat is twenty minutes." Scan history arrives as "we
 * already have the verdict object, it's one table." The quiz arrives as "the
 * profiles are already defined." Each is individually reasonable, and
 * collectively they are the reason the fake door never gets tested and the
 * kill criteria never get to fire.
 *
 * If a check here goes red, that is not a bug. It is somebody having built past
 * the gate, and the honest fix is to delete the feature or to open the gate on
 * purpose — deleting the check in the same commit, so the rule is removed where
 * it is written down rather than renamed around.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ParsedLabel, Verdict } from "@/lib/schema";

const SRC = path.join(process.cwd(), "src");

async function sourceFiles(): Promise<{ file: string; text: string }[]> {
  const { glob } = await import("node:fs/promises");
  const files: string[] = [];
  for await (const entry of glob("**/*.ts", { cwd: SRC })) files.push(entry as string);
  return Promise.all(
    files.map(async (file) => ({ file, text: await readFile(path.join(SRC, file), "utf8") })),
  );
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
    expect(files.length).toBeGreaterThan(8);
  });

  it("takes no money and knows nothing about a subscription", async () => {
    // §8's whole monetisation section is downstream of the gate. It is also the
    // single most tempting thing to build early, because it is the part that
    // looks like a business.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bstripe\b|\brevenuecat\b|\bsuperwall\b|\bpaywall\b|\bsubscription\b|\bcheckout\.session|\bprice_1[a-z0-9]|\bin-?app\s?purchase|\bstorekit\b/.test(
        code(text),
      ),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("persists nothing and has no backend", async () => {
    // Supabase and scan history are on the gated list. A scan that is not
    // stored is also a scan that cannot leak, which is worth the note: the
    // first thing this product would hold is a list of what somebody is
    // allergic to.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bsupabase\b|\bscan_?history\b|\bcreate\s+table\b|\bprisma\b|\bdrizzle\b/.test(code(text)),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("has no app shell", async () => {
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\breact-native\b|\bexpo-|\bfrom\s+["']expo["']|\bonboarding\s?quiz\b/.test(code(text)),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("builds none of §11's do-not-build list", async () => {
    // Barcode scanning and a packaged-product database, food logging, diaries,
    // streaks, a chat interface, personalised nutrition plans, a social feed.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bbarcode\b|\bupc\b|\bean-?13\b|\bfood\s?log\b|\bdiary\b|\bstreak\b|\bchat\b|\bnutrition\s?plan\b|\bmeal\s?plan\b|\bsocial\s?feed\b|\bfollowers\b/.test(
        code(text),
      ),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("keeps the provider SDK inside the adapter", async () => {
    // §13 calls the knowledge graph "model-agnostic". That is a claim which
    // decays silently the first time somebody imports the SDK one directory
    // over, so it is a dependency rule rather than a promise.
    const files = await sourceFiles();
    const offenders = files.filter(
      ({ file, text }) =>
        file !== path.join("lib", "parse", "anthropic.ts") &&
        /from\s+["']@anthropic-ai\/|from\s+["']openai["']|require\(["']@anthropic-ai\//.test(text),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("has no learned weights — the drawer stays shut", async () => {
    // §13's verdict-evaluation dataset improves parse accuracy someday. Until
    // then nothing learns, and a constant shaped for a learning system is the
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

describe("the architectural law holds", () => {
  it("gives the model nowhere to put a verdict", () => {
    // CLAUDE.md: "The model reads the label. It never decides the verdict."
    // Enforced structurally rather than by prompt — the vision pass is
    // validated against `ParsedLabel`, and `ParsedLabel` has no field a score,
    // a flag or a piece of advice could survive in.
    const fields = Object.keys(ParsedLabel.shape);
    for (const forbidden of ["score", "flags", "verdict", "severity", "advice", "recommendation", "safe", "healthy"]) {
      expect(fields, `ParsedLabel must not have a "${forbidden}" field`).not.toContain(forbidden);
    }
    expect(fields.sort()).toEqual(
      ["category", "containsStatement", "ingredients", "note", "productName", "truncated"].sort(),
    );
  });

  it("rejects a vision response that tries to hand back a score", () => {
    const smuggled = {
      category: "snack",
      productName: "Something",
      ingredients: [{ text: "Sugar", legibility: "clear", readConfidence: 1, contains: [] }],
      containsStatement: [],
      truncated: false,
      note: null,
      score: 12,
      flags: [{ ingredient: "Sugar", severity: "red" }],
    };
    // Zod strips unknown keys rather than throwing, which is the right
    // behaviour and also the reason this test exists: the score does not cause
    // an error, it simply ceases to exist before anything downstream could read
    // it.
    const parsed = ParsedLabel.parse(smuggled);
    expect(parsed).not.toHaveProperty("score");
    expect(parsed).not.toHaveProperty("flags");
  });

  it("requires a verdict to carry its provenance", () => {
    // A verdict that cannot say which engine and which knowledge base produced
    // it cannot be re-derived, and §13's evaluation dataset is unbuildable
    // without that join.
    expect(Object.keys(Verdict.shape)).toContain("provenance");
  });
});
