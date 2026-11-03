import { describe, expect, it } from "vitest";
import { aovLever } from "@/lib/calc/aov-lever";
import { cacCeiling } from "@/lib/calc/cac-ceiling";
import { cashCycle } from "@/lib/calc/cash-cycle";
import { CALCULATORS, calculator } from "@/lib/calc";
import { landedCost } from "@/lib/calc/landed-cost";
import { ninetyDayCash } from "@/lib/calc/ninety-day-cash";
import { offerMargin } from "@/lib/calc/offer-margin";
import { median, priceLadder } from "@/lib/calc/price-ladder";
import { judge, productVerdict } from "@/lib/calc/product-verdict";
import { reorderPoint } from "@/lib/calc/reorder-point";
import { scorecard } from "@/lib/calc/scorecard";
import { shippingRate } from "@/lib/calc/shipping-rate";
import { defaultInputs, marginColour, parseInputs, schemaJson } from "@/lib/calc/types";
import { unitEconomics } from "@/lib/calc/unit-economics";

// Worked examples, each worked by hand first. One product runs through the
// core four: a A$40 product, A$8 from the supplier, 500 to an order.

const aud = (n: number) => `A$${n.toFixed(2)}`;

describe("1. Landed Cost", () => {
  // freight 1000/500 = 2.00; duty 5% of (8 + 2) = 0.50; misc 250/500 = 0.50
  // landed = 8 + 2 + 0.50 + 1.50 packaging + 0.50 = 12.50
  // fees = 40 × 2.9% + 0.30 = 1.46; returns = 40 × 5% × 0.5 = 1.00
  // true = 12.50 + 1.46 + 1.00 = 14.96
  const out = landedCost.compute({
    sale_price: 40,
    unit_cost: 8,
    units_per_order: 500,
    freight: 1000,
    duty_rate: 5,
    packaging: 1.5,
    payment_fee_pct: 2.9,
    payment_fixed_fee: 0.3,
    return_rate: 5,
    inbound_misc: 250,
  });

  it("follows the spec's formula line by line", () => {
    expect(out.freight_per_unit).toBeCloseTo(2, 10);
    expect(out.duty_per_unit).toBeCloseTo(0.5, 10);
    expect(out.misc_per_unit).toBeCloseTo(0.5, 10);
    expect(out.landed_cost).toBeCloseTo(12.5, 10);
    expect(out.fees_per_unit).toBeCloseTo(1.46, 10);
    expect(out.returns_allowance).toBeCloseTo(1, 10);
    expect(out.true_cost).toBeCloseTo(14.96, 10);
    expect(landedCost.sentence!(out, aud)).toBe("Each unit really costs you A$14.96.");
  });

  it("defaults the payment fee to 2.9% + 0.30 and returns to 5%", () => {
    const d = defaultInputs(landedCost.fields);
    expect([d.payment_fee_pct, d.payment_fixed_fee, d.return_rate]).toEqual([2.9, 0.3, 5]);
  });

  it("charges duty on the freight share too", () => {
    const base = {
      sale_price: 0,
      unit_cost: 10,
      units_per_order: 10,
      freight: 100,
      packaging: 0,
      payment_fee_pct: 0,
      payment_fixed_fee: 0,
      return_rate: 0,
      inbound_misc: 0,
    };
    expect(landedCost.compute({ ...base, duty_rate: 10 }).duty_per_unit).toBeCloseTo(2, 10); // 10% of (10 + 10)
  });
});

describe("2. Unit Economics", () => {
  // contribution = 40 + 0 − 14.96 − 9 = 16.04; margin = 16.04/40 = 40.1%
  // break-even = 300/16.04 = 18.7 → 19; target = 1300/16.04 = 81.05 → 82
  // max CAC = 16.04 × 0.5 = 8.02
  const out = unitEconomics.compute({
    sale_price: 40,
    true_cost: 14.96,
    shipping_charged: 0,
    shipping_cost: 9,
    fixed_monthly: 300,
    target_monthly: 1000,
  });

  it("follows the spec's formulas", () => {
    expect(out.contribution).toBeCloseTo(16.04, 10);
    expect(out.margin_pct).toBeCloseTo(40.1, 10);
    expect(out.break_even_units).toBe(19);
    expect(out.units_for_target).toBe(82);
    expect(out.max_cac).toBeCloseTo(8.02, 10);
  });

  it("says it in the spec's one sentence", () => {
    expect(unitEconomics.sentence!(out, aud)).toBe(
      "At this price you keep A$16.04 per sale. You need 19 sales a month before you earn anything.",
    );
  });

  it("counts shipping charged to the customer, and doesn't round up an exact break-even", () => {
    const exact = unitEconomics.compute({
      sale_price: 30,
      true_cost: 10,
      shipping_charged: 5,
      shipping_cost: 10,
      fixed_monthly: 300,
      target_monthly: 0,
    });
    expect(exact.contribution).toBe(15);
    expect(exact.break_even_units).toBe(20);
    expect(exact.units_for_target).toBe(20);
  });

  it("is honest when every sale loses money", () => {
    const loss = unitEconomics.compute({
      sale_price: 20,
      true_cost: 18,
      shipping_charged: 0,
      shipping_cost: 5,
      fixed_monthly: 100,
      target_monthly: 0,
    });
    expect(loss.contribution).toBe(-3);
    expect(loss.break_even_units).toBeNull();
    expect(loss.max_cac).toBe(0);
    expect(unitEconomics.sentence!(loss, aud)).toBe(
      "At this price you lose A$3.00 on every sale, so no number of sales covers your costs.",
    );
  });

  it("starts from her latest Landed Cost", () => {
    expect(unitEconomics.prefill).toEqual({
      true_cost: { from: "landed-cost", output: "true_cost" },
    });
  });
});

describe("margin thresholds", () => {
  it("under 40 red, 40 to 55 amber, over 55 green", () => {
    expect(marginColour(39.99)).toBe("red");
    expect(marginColour(40)).toBe("amber");
    expect(marginColour(55)).toBe("amber");
    expect(marginColour(55.01)).toBe("green");
  });
});

describe("3. Price Ladder", () => {
  it("finds low, median and high, the margin at each, and recommends the lowest green", () => {
    // true cost 14.96; prices 30, 45, 50, 60, 80 → low 30, median 50, high 80
    // margins: (30 − 14.96)/30 = 50.13% amber; 70.08% green; 81.3% green
    const out = priceLadder.compute({
      true_cost: 14.96,
      comparables: [
        { price: 80 },
        { price: 30 },
        { price: 50, note: "closest" },
        { price: 60 },
        { price: 45 },
      ],
    });
    expect([out.market_low, out.market_median, out.market_high]).toEqual([30, 50, 80]);
    expect(out.margin_low).toBeCloseTo(50.1333, 3);
    expect(out.margin_median).toBeCloseTo(70.08, 10);
    expect(out.margin_high).toBeCloseTo(81.3, 10);
    expect([out.colour_low, out.colour_median, out.colour_high]).toEqual([
      "amber",
      "green",
      "green",
    ]);
    expect(out.recommended_position).toBe("median");
    expect(out.recommended_price).toBe(50);
    expect(out.verdict).toBe("green");
    expect(priceLadder.sentence!(out, aud)).toBe(
      "Price at the median, A$50.00: your margin is over 55% there.",
    );
  });

  it("falls back to the lowest amber, then to none", () => {
    const amber = priceLadder.compute({
      true_cost: 20,
      comparables: [{ price: 40 }, { price: 42 }],
    });
    expect([amber.recommended_position, amber.recommended_price, amber.verdict]).toEqual([
      "low",
      40,
      "amber",
    ]);
    const red = priceLadder.compute({ true_cost: 30, comparables: [{ price: 40 }, { price: 45 }] });
    expect([red.recommended_position, red.recommended_price, red.verdict]).toEqual([
      null,
      null,
      "red",
    ]);
  });

  it("takes the middle of an even count as the median", () => {
    expect(median([40, 30])).toBe(35);
    expect(median([5, 1, 3])).toBe(3);
  });

  it("takes up to five comparables", () => {
    const six = { true_cost: 1, comparables: Array.from({ length: 6 }, () => ({ price: 10 })) };
    expect(parseInputs(priceLadder, six)).toEqual({ ok: false, problems: ["Up to 5 comparables"] });
    expect(parseInputs(priceLadder, { true_cost: 1, comparables: [] }).ok).toBe(false);
  });
});

describe("4. Product Verdict", () => {
  const facts = {
    margin_pct: 60,
    break_even_units: 50,
    demand_signal: true,
    compliance_done: true,
    cash_covers_first_order: true,
  };

  it("is green when every test passes, with nothing to fix", () => {
    const out = judge(facts);
    expect(out.verdict).toBe("green");
    expect(out.to_green).toEqual([]);
    expect(out.reasons).toContain("Your margin is 60%, over 55%.");
  });

  it("is red for margin under 40, break-even over 150, cash short or compliance not done", () => {
    expect(judge({ ...facts, margin_pct: 39.9 }).verdict).toBe("red");
    expect(judge({ ...facts, break_even_units: 151 }).verdict).toBe("red");
    expect(judge({ ...facts, break_even_units: null }).verdict).toBe("red");
    expect(judge({ ...facts, cash_covers_first_order: false }).verdict).toBe("red");
    expect(judge({ ...facts, compliance_done: false }).verdict).toBe("red");
  });

  it("is amber for margin 40–55, break-even 80–150 or no demand signal", () => {
    expect(judge({ ...facts, margin_pct: 40 }).verdict).toBe("amber");
    expect(judge({ ...facts, margin_pct: 55 }).verdict).toBe("amber");
    expect(judge({ ...facts, break_even_units: 80 }).verdict).toBe("amber");
    expect(judge({ ...facts, break_even_units: 150 }).verdict).toBe("amber");
    expect(judge({ ...facts, demand_signal: false }).verdict).toBe("amber");
    expect(judge({ ...facts, break_even_units: 79 }).verdict).toBe("green");
  });

  it("lists red reasons first, and says what would turn it green", () => {
    // The worked product: margin 40.1%, break-even 19, no demand signal yet.
    const out = judge({
      ...facts,
      margin_pct: 40.1,
      break_even_units: 19,
      demand_signal: false,
      compliance_done: false,
    });
    expect(out.verdict).toBe("red");
    expect(out.reasons.slice(0, 3)).toEqual([
      "The compliance check isn't done.",
      "Your margin is 40.1%: workable, but not over 55%.",
      "You haven't found a demand signal yet.",
    ]);
    expect(out.to_green).toEqual([
      "Get the margin over 55%: a higher price, a cheaper landed cost, or both.",
      "Finish the compliance check for where you'll sell.",
      "Find a demand signal before you order stock.",
    ]);
  });

  it("ignores the product name when judging", () => {
    expect(productVerdict.compute({ product_name: "Candles", ...facts }).verdict).toBe("green");
  });
});

describe("the other eight", () => {
  it("Cash Cycle: cash tied up and days to recovery", () => {
    const out = cashCycle.compute({
      order_cost: 5000,
      deposit_pct: 30,
      balance_pct: 70,
      lead_time_days: 45,
      sell_through_days: 60,
    });
    expect(out).toEqual({
      deposit: 1500,
      balance: 3500,
      cash_tied_up: 5000,
      days_to_recovery: 105,
    });
    expect(
      parseInputs(cashCycle, {
        order_cost: 1,
        deposit_pct: 60,
        balance_pct: 60,
        lead_time_days: 1,
        sell_through_days: 1,
      }),
    ).toEqual({
      ok: false,
      problems: ["Deposit and balance can't add up to more than 100%."],
    });
  });

  it("CAC Ceiling: ads only if the benchmark CAC is under the max", () => {
    // max = 16.04 × 0.5 = 8.02; CAC = 0.90 / 2% = 45.00
    const cpc = cacCeiling.compute({ contribution: 16.04, conversion_pct: 2, cpc: 0.9 });
    expect(cpc.max_cac).toBeCloseTo(8.02, 10);
    expect(cpc.benchmark_cac).toBeCloseTo(45, 10);
    expect(cpc.ads_allowed).toBe(false);
    // CPM 12 at 1.5% CTR = 0.80 a click; at 4% conversion, CAC 20 < max 25
    const cpm = cacCeiling.compute({ contribution: 50, conversion_pct: 4, cpm: 12, ctr_pct: 1.5 });
    expect(cpm.cost_per_click).toBeCloseTo(0.8, 10);
    expect(cpm.benchmark_cac).toBeCloseTo(20, 10);
    expect(cpm.ads_allowed).toBe(true);
    expect(parseInputs(cacCeiling, { contribution: 1, conversion_pct: 1 }).ok).toBe(false);
  });

  it("Offer Margin: bundle vs singles", () => {
    // 3 × 40 × 0.9 = 108; cost 3 × 14.96 = 44.88; bundle 63.12 vs singles 75.12
    const out = offerMargin.compute({
      unit_price: 40,
      true_cost: 14.96,
      bundle_units: 3,
      discount_pct: 10,
    });
    expect(out.bundle_price).toBeCloseTo(108, 10);
    expect(out.bundle_margin).toBeCloseTo(63.12, 10);
    expect(out.singles_margin).toBeCloseTo(75.12, 10);
    expect(out.difference).toBeCloseTo(12, 10);
    expect(out.bundle_margin_pct).toBeCloseTo(58.444, 3);
  });

  it("AOV Lever: AOV × 1.25, rounded, only if the margin covers shipping", () => {
    // 48 × 1.25 = 60; extra 12 × 40% = 4.80 < 9: no
    const no = aovLever.compute({ current_aov: 48, margin_pct: 40, shipping_cost: 9 });
    expect(no.threshold).toBe(60);
    expect(no.extra_margin).toBeCloseTo(4.8, 10);
    expect([no.covered, no.recommended_threshold]).toEqual([false, null]);
    // 80 × 1.25 = 100; extra 20 × 60% = 12 ≥ 9: yes
    const yes = aovLever.compute({ current_aov: 80, margin_pct: 60, shipping_cost: 9 });
    expect([yes.threshold, yes.covered, yes.recommended_threshold]).toEqual([100, true, 100]);
    expect(aovLever.compute({ current_aov: 47, margin_pct: 50, shipping_cost: 1 }).threshold).toBe(
      59,
    ); // 58.75
  });

  it("Shipping Rate: break-even charge per zone, fee on the charge included", () => {
    const out = shippingRate.compute({
      packaging_per_parcel: 1,
      payment_fee_pct: 2.9,
      zones: [{ zone: "Metro", weight_kg: 0.5, carrier_rate: 9 }],
    });
    expect(out.zones[0]!.charge).toBeCloseTo(10 / 0.971, 10);
    expect(out.zones[0]!.charge * (1 - 0.029) - 1 - 9).toBeCloseTo(0, 10);
  });

  it("Reorder Point: reorder at N units, 60 days' order, rounded up", () => {
    expect(
      reorderPoint.compute({ daily_velocity: 3.5, lead_time_days: 30, safety_days: 14 }),
    ).toEqual({ reorder_at: 154, order_quantity: 210 });
    expect(
      reorderPoint.compute({ daily_velocity: 2.2, lead_time_days: 30, safety_days: 14 }),
    ).toEqual({ reorder_at: 97, order_quantity: 132 });
  });

  it("90-Day Cash: month-end cash with a flag below zero", () => {
    // in from sales 40 × 50 × 40% = 800 a month; fixed 300
    // m1 2000 + 800 − 300 = 2500; m2 2500 + 500 − 3100 = −100; m3 400
    const out = ninetyDayCash.compute({
      opening_cash: 2000,
      orders_per_month: 40,
      aov: 50,
      margin_pct: 40,
      fixed_monthly: 300,
      reorders: [{ month: 2, amount: 3100 }],
    });
    expect(out.months.map((m) => [m.month_end, m.below_zero])).toEqual([
      [2500, false],
      [-100, true],
      [400, false],
    ]);
    expect(out.lowest).toBe(-100);
    expect(ninetyDayCash.verdict!(out)).toBe("red");
    expect(ninetyDayCash.sentence!(out, aud)).toMatch(/below zero in month 2/);
  });

  it("Scorecard: continue, change or stop against the Module 0 thresholds", () => {
    const month = (
      units_sold: number,
      margin_pct: number,
      contribution = 20,
      fixed_costs = 300,
    ) => ({ units_sold, margin_pct, contribution, fixed_costs });
    // break-even 300/20 = 15 sales
    const go = scorecard.compute({ months: [month(10, 45), month(20, 50), month(40, 58)] });
    expect(go.months.map((m) => m.status)).toEqual(["red", "amber", "green"]);
    expect(go.decision).toBe("continue");
    expect(
      scorecard.compute({ months: [month(40, 60), month(10, 60), month(12, 60)] }).decision,
    ).toBe("stop");
    expect(
      scorecard.compute({ months: [month(40, 60), month(40, 30), month(40, 60)] }).decision,
    ).toBe("change");
    expect(
      scorecard.compute({ months: [month(40, 60), month(40, 60), month(40, 50)] }).decision,
    ).toBe("change");
    const reasons = scorecard.compute({
      months: [month(10, 45), month(20, 50), month(40, 58)],
    }).reasons;
    expect(reasons).toContain("Month 1: 10 sales, short of the 15 needed to break even.");
    expect(parseInputs(scorecard, { months: [month(1, 1)] }).ok).toBe(false);
  });
});

describe("the library", () => {
  it("has all twelve, with the spec's tiers", () => {
    expect(CALCULATORS).toHaveLength(12);
    expect(new Set(CALCULATORS.map((c) => c.slug)).size).toBe(12);
    const tier = (slug: string) => calculator(slug)!.minTier;
    expect([tier("landed-cost"), tier("unit-economics")]).toEqual(["free", "free"]);
    // Module 0 = "all Module 0 lessons and tools": the verdict and what it reads.
    expect([tier("price-ladder"), tier("product-verdict"), tier("cash-cycle")]).toEqual([
      "module0",
      "module0",
      "module0",
    ]);
    for (const slug of [
      "cac-ceiling",
      "offer-margin",
      "aov-lever",
      "shipping-rate",
      "reorder-point",
      "ninety-day-cash",
      "scorecard",
    ])
      expect(tier(slug)).toBe("course");
  });

  it("stores a form schema but never the formulas", () => {
    const json = JSON.stringify(schemaJson(landedCost));
    expect(JSON.parse(json).fields).toHaveLength(10);
    expect(json).not.toContain("compute");
  });

  it("checks inputs: missing, negative, over 100%, not whole", () => {
    const bad = parseInputs(landedCost, {
      ...defaultInputs(landedCost.fields),
      sale_price: -1,
      unit_cost: 5,
      units_per_order: 1.5,
      freight: 0,
      duty_rate: 101,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(bad.problems).toEqual(
        expect.arrayContaining([
          "Intended sale price can't be below 0",
          "Units per order needs a whole number",
          "Duty rate can't be above 100",
        ]),
      );
    expect(parseInputs(landedCost, {}).ok).toBe(false);
  });

  it("every calculator computes from valid inputs without throwing", () => {
    // Fill every required number with 10 and every row list to its minimum.
    const sample = (fields: (typeof CALCULATORS)[number]["fields"]): Record<string, unknown> =>
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          f.kind === "rows"
            ? Array.from({ length: Math.max(f.minRows, 1) }, () => sample(f.fields))
            : f.kind === "yesno"
              ? true
              : f.kind === "text"
                ? "x"
                : f.key === "month"
                  ? 1
                  : f.key === "cpm" || f.key === "ctr_pct"
                    ? undefined
                    : 10,
        ]),
      );
    for (const calc of CALCULATORS) {
      const parsed = parseInputs(calc, sample(calc.fields));
      expect(parsed.ok, `${calc.slug}: ${parsed.ok ? "" : parsed.problems.join("; ")}`).toBe(true);
      if (parsed.ok) expect(() => calc.compute(parsed.inputs)).not.toThrow();
    }
  });
});
