import { describe, expect, it } from "vitest";
import { calculate, compare, divide, type CalculatorResult } from "@/lib/ads/calculator";

// Expected values are worked out by hand (shown in each comment), not by
// running the engine, so a wrong formula fails here.

describe("divide", () => {
  it("is null for zero or non-finite results", () => {
    expect(divide(1, 0)).toBeNull();
    expect(divide(0, 0)).toBeNull();
    expect(divide(Number.MAX_VALUE, Number.MIN_VALUE)).toBeNull();
    expect(divide(6, 3)).toBe(2);
  });
});

describe("calculate: per order", () => {
  it("a A$149 course on Gumroad-style fees with 5% refunds", () => {
    // net 149 × 0.95 = 141.55; fees 149 × 0.10 + 0.50 = 15.40; contribution 126.15
    const r = calculate({ price: 149, fees: { percent: 0.1, fixed: 0.5 }, refundRate: 0.05 });
    expect(r.currency).toBe("AUD");
    expect(r.perOrder.customerPays).toBe(149);
    expect(r.perOrder.gst).toBe(0);
    expect(r.perOrder.netRevenue).toBeCloseTo(141.55, 10);
    expect(r.perOrder.fees).toBeCloseTo(15.4, 10);
    expect(r.perOrder.contribution).toBeCloseTo(126.15, 10);
    expect(r.breakEven.cac).toBeCloseTo(126.15, 10);
    // 149 ÷ 126.15 = 1.18113…
    expect(r.breakEven.roas).toBeCloseTo(1.18113, 5);
    expect(r.breakEven.spendByOrders.map((s) => s.orders)).toEqual([1, 2, 5, 10, 20]);
    expect(r.breakEven.spendByOrders[2]!.spend).toBeCloseTo(630.75, 10); // 5 × 126.15
  });

  it("GST included in the price", () => {
    // 110 incl. → 100 ex GST, GST 10; fees 110 × 0.03 + 0.30 = 3.60; contribution 96.40
    const r = calculate({
      price: 110,
      gst: { mode: "inclusive", rate: 0.1 },
      fees: { percent: 0.03, fixed: 0.3 },
    });
    expect(r.perOrder.customerPays).toBe(110);
    expect(r.perOrder.gst).toBeCloseTo(10, 10);
    expect(r.perOrder.netRevenue).toBeCloseTo(100, 10);
    expect(r.perOrder.fees).toBeCloseTo(3.6, 10);
    expect(r.perOrder.contribution).toBeCloseTo(96.4, 10);
    expect(r.notes.some((n) => n.includes("GST"))).toBe(true);
  });

  it("GST added at checkout", () => {
    // 100 + 10% = 110 paid; same figures as above
    const r = calculate({
      price: 100,
      gst: { mode: "exclusive", rate: 0.1 },
      fees: { percent: 0.03, fixed: 0.3 },
    });
    expect(r.perOrder.customerPays).toBeCloseTo(110, 10);
    expect(r.perOrder.gst).toBeCloseTo(10, 10);
    expect(r.perOrder.contribution).toBeCloseTo(96.4, 10);
  });

  it("an upsell taken by a quarter of buyers", () => {
    // pays 49 + 0.25 × 19 = 53.75; costs 3 + 0.25 × 2 = 3.50; contribution 50.25
    const r = calculate({
      price: 49,
      fulfilmentCost: 3,
      upsell: { price: 19, takeRate: 0.25, cost: 2 },
    });
    expect(r.perOrder.customerPays).toBeCloseTo(53.75, 10);
    expect(r.perOrder.variableCosts).toBeCloseTo(3.5, 10);
    expect(r.perOrder.contribution).toBeCloseTo(50.25, 10);
  });

  it("percentage and amount discounts", () => {
    expect(
      calculate({ price: 50, discount: { kind: "percent", value: 20 } }).perOrder.salePrice,
    ).toBe(40);
    expect(
      calculate({ price: 50, discount: { kind: "amount", value: 15 } }).perOrder.salePrice,
    ).toBe(35);
  });

  it("a discount larger than the price", () => {
    const r = calculate({
      price: 50,
      discount: { kind: "amount", value: 60 },
      fees: { percent: 0.1, fixed: 0.5 },
    });
    expect(r.perOrder.salePrice).toBe(0);
    expect(r.perOrder.customerPays).toBe(0);
    expect(r.perOrder.fees).toBe(0); // nothing charged, so no fee
    expect(r.perOrder.contribution).toBe(0);
    expect(r.breakEven.cac).toBeNull();
    expect(r.breakEven.roas).toBeNull();
    expect(r.notes.some((n) => n.includes("larger than the price"))).toBe(true);
  });

  it("zero margin: nothing left to pay for ads", () => {
    const r = calculate({ price: 10, fulfilmentCost: 10 });
    expect(r.perOrder.contribution).toBe(0);
    expect(r.breakEven.cac).toBeNull();
    expect(r.breakEven.roas).toBeNull();
    expect(r.breakEven.spendByOrders).toEqual([]);
    expect(r.notes.some((n) => n.includes("loses money"))).toBe(true);
  });

  it("negative margin", () => {
    const r = calculate({ price: 10, fulfilmentCost: 12, ads: { spend: 50, orders: 3 } });
    expect(r.perOrder.contribution).toBe(-2);
    expect(r.breakEven.cac).toBeNull();
    expect(r.ads.ordersToBreakEven).toBeNull();
    // 3 × −2 − 50 = −56
    expect(r.ads.contributionAfterAds).toBe(-56);
  });

  it("every order refunded", () => {
    // net 0; fees still paid: 50 × 0.10 = 5; contribution −5
    const r = calculate({ price: 50, refundRate: 1, fees: { percent: 0.1, fixed: 0 } });
    expect(r.perOrder.netRevenue).toBe(0);
    expect(r.perOrder.fees).toBeCloseTo(5, 10);
    expect(r.perOrder.contribution).toBeCloseTo(-5, 10);
    expect(r.notes.some((n) => n.includes("refunded"))).toBe(true);
  });

  it("fractional fees", () => {
    // 9.99 × 0.029 + 0.30 = 0.58971; contribution 9.40029
    const r = calculate({ price: 9.99, fees: { percent: 0.029, fixed: 0.3 } });
    expect(r.perOrder.fees).toBeCloseTo(0.58971, 10);
    expect(r.perOrder.contribution).toBeCloseTo(9.40029, 10);
  });

  it("cost per visit and later contribution", () => {
    // 126.15 × 0.02 = 2.523; with later 20: 146.15
    const r = calculate({
      price: 149,
      fees: { percent: 0.1, fixed: 0.5 },
      refundRate: 0.05,
      ads: { spend: 0, orders: 0, conversionRate: 0.02 },
      laterContribution: 20,
    });
    expect(r.breakEven.costPerVisit).toBeCloseTo(2.523, 10);
    expect(r.breakEven.cacWithLater).toBeCloseTo(146.15, 10);
    expect(r.notes.some((n) => n.includes("may not happen"))).toBe(true);
  });
});

describe("calculate: the ad period", () => {
  const course = { price: 149, fees: { percent: 0.1, fixed: 0.5 }, refundRate: 0.05 };

  it("two sales from A$300", () => {
    // CAC 150; ROAS 298 ÷ 300 = 0.99333; before ads 252.30; after −47.70; break-even ceil(2.378) = 3
    const r = calculate({ ...course, ads: { spend: 300, orders: 2 } });
    expect(r.ads.cac).toBe(150);
    expect(r.ads.roas).toBeCloseTo(0.99333, 5);
    expect(r.ads.contributionBeforeAds).toBeCloseTo(252.3, 10);
    expect(r.ads.contributionAfterAds).toBeCloseTo(-47.7, 10);
    expect(r.ads.ordersToBreakEven).toBe(3);
  });

  it("uses reported revenue when given", () => {
    const r = calculate({ ...course, ads: { spend: 200, orders: 2, reportedRevenue: 500 } });
    expect(r.ads.roas).toBe(2.5);
  });

  it("zero purchases", () => {
    const r = calculate({ ...course, ads: { spend: 100, orders: 0 } });
    expect(r.ads.cac).toBeNull();
    expect(r.ads.roas).toBe(0);
    expect(r.ads.contributionAfterAds).toBe(-100);
    expect(r.ads.ordersToBreakEven).toBe(1); // ceil(100 ÷ 126.15)
    expect(r.notes.some((n) => n.includes("No orders yet"))).toBe(true);
  });

  it("no spend and no orders", () => {
    const r = calculate({ ...course });
    expect(r.ads.cac).toBeNull();
    expect(r.ads.roas).toBeNull();
    expect(r.ads.ordersToBreakEven).toBe(0);
  });
});

describe("calculate: input checks", () => {
  it("rejects negative money, rates above 1 and fractional orders", () => {
    expect(() => calculate({ price: -1 })).toThrow();
    expect(() => calculate({ price: 10, refundRate: 1.5 })).toThrow();
    expect(() => calculate({ price: 10, ads: { spend: 1, orders: 1.5 } })).toThrow();
    expect(() => calculate({ price: Number.NaN })).toThrow();
  });
});

function numbers(r: CalculatorResult): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(r);
  return out;
}

describe("calculate: never Infinity or NaN", () => {
  it("across a seeded sweep of awkward inputs", () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)] as T;
    const moneys = [0, 0.01, 1, 9.99, 49, 149, 10_000_000];
    const rates = [0, 0.001, 0.1, 0.5, 1];
    for (let n = 0; n < 2000; n++) {
      const r = calculate({
        price: pick(moneys),
        discount: { kind: pick(["amount", "percent"] as const), value: pick([0, 20, 100, 200]) },
        gst: {
          mode: pick(["not_registered", "inclusive", "exclusive"] as const),
          rate: pick(rates),
        },
        fees: { percent: pick(rates), fixed: pick(moneys) },
        fulfilmentCost: pick(moneys),
        refundRate: pick(rates),
        upsell: { price: pick(moneys), takeRate: pick(rates), cost: pick(moneys) },
        ads: {
          spend: pick(moneys),
          orders: pick([0, 1, 7, 1000]),
          conversionRate: pick([...rates, undefined]),
        },
        laterContribution: pick([undefined, 0, 25]),
      });
      for (const x of numbers(r)) expect(Number.isFinite(x)).toBe(true);
    }
  });
});

describe("compare", () => {
  it("runs low, base and high without changing the base", () => {
    const base = { price: 149, fees: { percent: 0.1, fixed: 0.5 }, refundRate: 0.05 };
    const [low, high] = compare(base, [
      { name: "low", change: (i) => ({ ...i, refundRate: 0.15 }) },
      { name: "high", change: (i) => ({ ...i, refundRate: 0 }) },
    ]);
    // 149 × 0.85 − 15.40 = 111.25; 149 − 15.40 = 133.60
    expect(low!.result.perOrder.contribution).toBeCloseTo(111.25, 10);
    expect(high!.result.perOrder.contribution).toBeCloseTo(133.6, 10);
    expect(base.refundRate).toBe(0.05);
  });
});
