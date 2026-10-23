import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkClaims } from "@/lib/ai/guard";
import { calculate, type CalculatorInput, type CalculatorResult } from "@/lib/ads/calculator";
import { parseLesson, REQUIRED_SECTIONS } from "@/lib/ads/lesson";
import type { BusinessProfile } from "@/lib/domain/profile";

const DIR = "content/ads/modules";
const lessons = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .map((file) => ({ file, text: readFileSync(`${DIR}/${file}`, "utf8") }));

describe("course modules", () => {
  it.each(lessons)("$file has valid front matter and every required section", ({ file, text }) => {
    const { meta, body } = parseLesson(text);
    expect(file).toBe(`${meta.slug}.md`);
    const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]!.trim());
    expect(headings).toEqual([...REQUIRED_SECTIONS]);
    // No empty sections, placeholders or lorem ipsum.
    for (const section of body.split(/^## .+$/m).slice(1))
      expect(section.trim().length).toBeGreaterThan(40);
    expect(body).not.toMatch(/lorem ipsum|TODO|TBD/i);
  });

  it.each(lessons)("$file passes the claims guard (quoted bad examples aside)", ({ text }) => {
    const profile = {
      verifiedClaims: [],
      productsSummary: "",
      goal: "",
      prohibitedClaims: [],
    } as unknown as BusinessProfile;
    const lines = text.split("\n").filter((l) => !/^\s*(- )?✗/.test(l));
    expect(checkClaims(lines, profile)).toEqual([]);
    // The guard does see the quoted bad examples when they are left in.
    if (text.includes("✗")) expect(checkClaims(text.split("\n"), profile)).not.toEqual([]);
  });

  it.each(lessons)("$file labels worked examples as hypothetical", ({ text }) => {
    const { body } = parseLesson(text);
    const worked = body.split("## Worked example")[1]!.split("## ")[0];
    expect(worked).toMatch(/hypothetical/i);
  });
});

// Every figure Module 1 quotes, recomputed by the engine.
const gumroad = { percent: 0.1, fixed: 0.8 };
type Fmt = "money" | "ratio" | "count";
const EXAMPLES: {
  name: string;
  input: CalculatorInput;
  figures: [Fmt, (r: CalculatorResult) => number | null, string][];
}[] = [
  {
    name: "A. A$49 planner bundle",
    input: { price: 49, fees: gumroad, refundRate: 0.03, ads: { spend: 120, orders: 2 } },
    figures: [
      ["money", (r) => r.perOrder.netRevenue, "47.53"],
      ["money", (r) => r.perOrder.fees, "5.70"],
      ["money", (r) => r.perOrder.contribution, "41.83"],
      ["ratio", (r) => r.breakEven.roas, "1.17"],
      ["money", (r) => r.breakEven.spendByOrders[2]!.spend, "209.15"],
      ["money", (r) => r.ads.cac, "60.00"],
      ["ratio", (r) => r.ads.roas, "0.82"],
      ["money", (r) => r.ads.contributionBeforeAds, "83.66"],
      ["money", (r) => r.ads.contributionAfterAds, "−36.34"],
      ["count", (r) => r.ads.ordersToBreakEven, "3"],
    ],
  },
  {
    name: "B. A$12 printable",
    input: { price: 12, fees: gumroad, refundRate: 0.03, ads: { conversionRate: 0.02 } },
    figures: [
      ["money", (r) => r.perOrder.contribution, "9.64"],
      ["ratio", (r) => r.breakEven.roas, "1.24"],
      ["money", (r) => r.breakEven.costPerVisit, "0.19"],
    ],
  },
  {
    name: "B. with upsell",
    input: { price: 12, fees: gumroad, refundRate: 0.03, upsell: { price: 19, takeRate: 0.2 } },
    figures: [
      ["money", (r) => r.perOrder.customerPays, "15.80"],
      ["money", (r) => r.perOrder.contribution, "12.95"],
    ],
  },
  {
    name: "C. A$66 physical, GST included",
    input: {
      price: 66,
      gst: { mode: "inclusive", rate: 0.1 },
      fees: { percent: 0.029, fixed: 0.3 },
      fulfilmentCost: 18,
      refundRate: 0.02,
    },
    figures: [
      ["money", (r) => r.perOrder.gst, "6.00"],
      ["money", (r) => r.perOrder.contribution, "38.59"],
      ["ratio", (r) => r.breakEven.roas, "1.71"],
    ],
  },
  {
    name: "D. launch discount",
    input: {
      price: 49,
      discount: { kind: "percent", value: 40 },
      fees: gumroad,
      refundRate: 0.03,
    },
    figures: [
      ["money", (r) => r.perOrder.salePrice, "29.40"],
      ["money", (r) => r.perOrder.contribution, "24.78"],
      ["ratio", (r) => r.breakEven.roas, "1.19"],
    ],
  },
  {
    name: "Answers 1 and 2",
    input: { price: 30, fees: gumroad },
    figures: [
      ["money", (r) => r.perOrder.contribution, "26.20"],
      ["ratio", (r) => r.breakEven.roas, "1.15"],
    ],
  },
];

function format(fmt: Fmt, v: number): string {
  if (fmt === "count") return String(v);
  const s = Math.abs(v).toFixed(2);
  return v < 0 ? `−${s}` : s;
}

describe("Module 1 figures match the calculator", () => {
  const text = readFileSync(`${DIR}/01-the-numbers.md`, "utf8");

  it.each(EXAMPLES)("$name", ({ input, figures }) => {
    const r = calculate(input);
    for (const [fmt, get, quoted] of figures) {
      const v = get(r);
      expect(v, quoted).not.toBeNull();
      expect(format(fmt, v!)).toBe(quoted);
      const shown =
        fmt === "money"
          ? quoted.replace(/^(−?)/, "$1A$")
          : fmt === "ratio"
            ? quoted
            : `${quoted} sales`;
      expect(text, `module quotes ${shown}`).toContain(shown);
    }
  });
});
