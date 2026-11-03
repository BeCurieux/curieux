import { describe, expect, it } from "vitest";
import { checkoutPlan, purchaseFromSession, refundable, type Product } from "@/lib/commerce/plan";

const product = (
  slug: string,
  tier: Product["tier"],
  aud: number,
  usd: number,
  extra: Partial<Product> = {},
): Product => ({
  id: slug,
  slug,
  name: slug,
  tier,
  price_aud_cents: aud,
  price_usd_cents: usd,
  stripe_price_id_aud: `price_${tier}_aud`,
  stripe_price_id_usd: `price_${tier}_usd`,
  active: true,
  places_total: null,
  places_sold: 0,
  ...extra,
});

// The seeded catalogue (SPEC.md → Access tiers; USD from migration 3).
const products = [
  product("product-check", "free", 0, 0),
  product("module-0", "module0", 4900, 3400),
  product("course", "course", 25000, 17500),
  product("founding", "founding", 34900, 24400, { places_total: 30, places_sold: 0 }),
  product("benchmark-pack", "benchmark_pack", 2900, 2000),
];
const nobody = { tier: "free" as const, benchmarkPack: false };

describe("checkoutPlan", () => {
  it("Module 0 in AUD, with the benchmark pack offered as the bump", () => {
    const plan = checkoutPlan("module-0", products, nobody, "AUD");
    expect(plan).toMatchObject({
      ok: true,
      priceId: "price_module0_aud",
      amountCents: 4900,
      bump: { priceId: "price_benchmark_pack_aud", amountCents: 2900 },
      credit: null,
    });
  });

  it("charges USD outside Australia", () => {
    expect(checkoutPlan("module-0", products, nobody, "USD")).toMatchObject({
      ok: true,
      priceId: "price_module0_usd",
      amountCents: 3400,
      bump: { priceId: "price_benchmark_pack_usd", amountCents: 2000 },
    });
  });

  it("doesn't offer the pack to someone who has it", () => {
    expect(
      checkoutPlan("module-0", products, { tier: "free", benchmarkPack: true }, "AUD"),
    ).toMatchObject({ ok: true, bump: null });
  });

  it("credits Module 0 in full on the course: A$201 (and US$141)", () => {
    const owner = { tier: "module0" as const, benchmarkPack: false };
    const aud = checkoutPlan("course", products, owner, "AUD");
    expect(aud).toMatchObject({
      ok: true,
      amountCents: 25000,
      credit: { amountCents: 4900 },
      bump: null,
    });
    if (aud.ok) expect(aud.amountCents - aud.credit!.amountCents).toBe(20100);
    const usd = checkoutPlan("course", products, owner, "USD");
    if (usd.ok) expect(usd.amountCents - usd.credit!.amountCents).toBe(14100);
    expect(checkoutPlan("founding", products, owner, "AUD")).toMatchObject({
      ok: true,
      credit: { amountCents: 4900 },
    });
    // No credit without Module 0.
    expect(checkoutPlan("course", products, nobody, "AUD")).toMatchObject({
      ok: true,
      credit: null,
    });
  });

  it("refuses the founding cohort at 30, and says how many are left before then", () => {
    const at = (sold: number) =>
      checkoutPlan(
        "founding",
        products.map((p) => (p.tier === "founding" ? { ...p, places_sold: sold } : p)),
        nobody,
        "AUD",
      );
    expect(at(29)).toMatchObject({ ok: true, placesLeft: 1 });
    expect(at(30)).toEqual({ ok: false, reason: "All 30 founding places are taken." });
  });

  it("won't sell what she already has, or anything her tier includes", () => {
    expect(
      checkoutPlan("module-0", products, { tier: "module0", benchmarkPack: false }, "AUD"),
    ).toEqual({
      ok: false,
      reason: "You already have Module 0, which includes this.",
    });
    expect(
      checkoutPlan("course", products, { tier: "founding", benchmarkPack: true }, "AUD").ok,
    ).toBe(false);
    expect(
      checkoutPlan("benchmark-pack", products, { tier: "course", benchmarkPack: true }, "AUD"),
    ).toEqual({
      ok: false,
      reason: "You already have the benchmark pack.",
    });
    expect(
      checkoutPlan("founding", products, { tier: "course", benchmarkPack: true }, "AUD").ok,
    ).toBe(true);
  });

  it("refuses the free tier, unknown or inactive products, and a missing Stripe price", () => {
    expect(checkoutPlan("product-check", products, nobody, "AUD").ok).toBe(false);
    expect(checkoutPlan("nope", products, nobody, "AUD").ok).toBe(false);
    expect(
      checkoutPlan(
        "course",
        products.map((p) => ({ ...p, active: p.tier !== "course" })),
        nobody,
        "AUD",
      ).ok,
    ).toBe(false);
    expect(
      checkoutPlan(
        "course",
        products.map((p) => ({ ...p, stripe_price_id_usd: null })),
        nobody,
        "USD",
      ),
    ).toEqual({ ok: false, reason: "course isn't on sale in USD yet." });
  });
});

describe("refundable", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  it("for 14 days from purchase, if it hasn't been refunded", () => {
    expect(refundable({ status: "paid", created_at: daysAgo(13) }, now)).toBe(true);
    expect(refundable({ status: "paid", created_at: daysAgo(14) }, now)).toBe(true);
    expect(refundable({ status: "paid", created_at: daysAgo(14.01) }, now)).toBe(false);
    expect(refundable({ status: "refunded", created_at: daysAgo(1) }, now)).toBe(false);
  });
});

describe("purchaseFromSession", () => {
  const session = {
    id: "cs_1",
    payment_status: "paid",
    amount_total: 7800,
    currency: "AUD",
    client_reference_id: "user-1",
    metadata: { user_id: "user-1", product_slug: "module-0" },
    payment_intent: "pi_1",
  };
  it("reads the purchase, and spots the bump among the line items", () => {
    expect(
      purchaseFromSession(
        session,
        ["price_module0_aud", "price_pack_aud"],
        ["price_pack_aud", "price_pack_usd"],
      ),
    ).toEqual({
      sessionId: "cs_1",
      paymentIntent: "pi_1",
      userId: "user-1",
      productSlug: "module-0",
      amountCents: 7800,
      currency: "aud",
      bump: true,
    });
    expect(
      purchaseFromSession(
        { ...session, payment_intent: { id: "pi_2" } },
        ["price_module0_aud"],
        ["price_pack_aud"],
      ),
    ).toMatchObject({
      paymentIntent: "pi_2",
      bump: false,
    });
  });
  it("ignores an unpaid session or one that isn't ours", () => {
    expect(purchaseFromSession({ ...session, payment_status: "unpaid" }, [], [])).toBeNull();
    expect(purchaseFromSession({ ...session, metadata: {} }, [], [])).toBeNull();
    expect(purchaseFromSession({ ...session, payment_intent: null }, [], [])).toBeNull();
  });
});
