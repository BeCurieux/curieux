import { describe, expect, it } from "vitest";
import { checkClaims } from "@/lib/ai/guard";
import {
  DEFAULT_FORM,
  formatMoney,
  interpret,
  run,
  toCsv,
  toInput,
  type CalculatorForm,
} from "@/lib/ads/calculator-view";
import type { BusinessProfile } from "@/lib/domain/profile";

const form = (changes: Partial<CalculatorForm>): CalculatorForm => ({
  ...DEFAULT_FORM,
  ...changes,
});
const titles = (f: CalculatorForm) => interpret(run(f).result!, f.currency).map((r) => r.title);

describe("calculator page: reading the form", () => {
  it("the default is Module 1's example A", () => {
    const { result } = run(DEFAULT_FORM);
    expect(result!.perOrder.contribution).toBeCloseTo(41.83, 10);
    expect(result!.ads.contributionAfterAds).toBeCloseTo(-36.34, 10);
  });

  it("converts percentages and empties", () => {
    const { input } = toInput(form({ discountPct: "20", refundPct: "", conversionPct: "2" }));
    expect(input!.discount).toEqual({ kind: "percent", value: 20 });
    expect(input!.refundRate).toBe(0);
    expect(input!.ads!.conversionRate).toBe(0.02);
    expect(toInput(form({ conversionPct: "" })).input!.ads!.conversionRate).toBeUndefined();
  });

  it("names the field that's wrong instead of calculating", () => {
    expect(run(form({ price: "" })).errors.price).toMatch(/Enter a number/);
    expect(run(form({ price: "-5" })).errors.price).toMatch(/negative/);
    expect(run(form({ refundPct: "120" })).errors.refundPct).toMatch(/0 to 100/);
    expect(run(form({ orders: "2.5" })).errors.orders).toMatch(/whole number/);
    expect(run(form({ feeFixed: "abc" })).result).toBeNull();
  });

  it("formats losses and undefined figures plainly", () => {
    expect(formatMoney(-36.34, "AUD")).toBe("−A$36.34");
    expect(formatMoney(null, "USD")).toBe("Not defined");
  });
});

describe("calculator page: what it says about a result", () => {
  it("example A: below break-even, and too few sales to judge", () => {
    expect(titles(DEFAULT_FORM)).toEqual([
      "Below break-even for this period",
      "Not enough evidence yet, either way",
    ]);
  });

  it("a ROAS above 1 that still loses money is called out", () => {
    // 3 sales from A$140: ROAS 147 ÷ 140 = 1.05, after ads 3 × 41.83 − 140 = −14.51
    expect(titles(form({ adSpend: "140", orders: "3" }))[0]).toBe(
      "A ROAS above 1 can still be a loss",
    );
  });

  it("a loss-making product is the first thing it says", () => {
    expect(titles(form({ price: "5", feeFixed: "0.80", costs: "6" }))[0]).toBe(
      "Each sale loses money before any ads",
    );
  });

  it("above break-even on enough sales is reported for that period only", () => {
    const readings = interpret(run(form({ adSpend: "100", orders: "6" })).result!, "AUD");
    expect(readings.map((r) => r.title)).toEqual(["At or above break-even for this period"]);
    expect(readings[0]!.text).toMatch(/this period only/);
  });

  it("without an ad period it explains what to add", () => {
    expect(titles(form({ adSpend: "", orders: "" }))).toEqual(["Add a real ad period to compare"]);
  });

  it("flags fees that eat a small price", () => {
    expect(titles(form({ price: "4", adSpend: "", orders: "" }))).toContain(
      "Fees take a large share of this price",
    );
  });

  it("never predicts, promises or claims results", () => {
    const profile = {
      verifiedClaims: [],
      productsSummary: "",
      goal: "",
      prohibitedClaims: [],
    } as unknown as BusinessProfile;
    const scenarios = [
      DEFAULT_FORM,
      form({ adSpend: "140", orders: "3" }),
      form({ price: "5", costs: "6" }),
      form({ adSpend: "100", orders: "6" }),
      form({ adSpend: "", orders: "" }),
      form({ price: "4" }),
      form({ orders: "0", adSpend: "50" }),
    ];
    for (const f of scenarios) {
      for (const r of interpret(run(f).result!, f.currency)) {
        const text = `${r.title} ${r.text}`;
        expect(text).not.toMatch(
          /\b(will (make|sell|work|earn)|guarantee|definitely|certain(ly)?)\b/i,
        );
        expect(checkClaims([text], profile)).toEqual([]);
      }
    }
  });
});

describe("calculator page: CSV", () => {
  it("lists inputs and results, quoted, with spreadsheet formulas neutralised", () => {
    const f = form({ price: "=1+1" });
    const csv = toCsv(DEFAULT_FORM, run(DEFAULT_FORM).result!);
    expect(csv).toContain('"Contribution per order","41.83"');
    expect(csv).toContain('"After ads, this period","-36.34"');
    expect(toCsv(f, run(DEFAULT_FORM).result!)).toContain(`"Price","'=1+1"`);
  });
});
