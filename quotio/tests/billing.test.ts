import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// stripe.ts is server-only; the marker package isn't installed, and this file
// never touches the network — it only reads env and our own plan data.
vi.mock("server-only", () => ({}));

const { billingEnabled, periodsFor, planForPrice, priceIdFor } = await import(
  "@/lib/billing/stripe"
);

const ENV = { ...process.env };

/**
 * Two prices per plan means two Stripe price ids per plan, and the webhook
 * has to recognise both. Miss the monthly ids and every monthly subscriber is
 * mapped to no plan on their first renewal — which the webhook reads as
 * "free" and quietly downgrades them.
 */
describe("Stripe price ids, per plan and per period", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_PRICE_PRO = "price_pro_year";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_month";
    process.env.STRIPE_PRICE_BUSINESS = "price_biz_year";
    process.env.STRIPE_PRICE_BUSINESS_MONTHLY = "price_biz_month";
  });

  afterEach(() => {
    process.env = { ...ENV };
  });

  it("picks the id for the period being bought", () => {
    expect(priceIdFor("pro", "yearly")).toBe("price_pro_year");
    expect(priceIdFor("pro", "monthly")).toBe("price_pro_month");
    expect(priceIdFor("business", "monthly")).toBe("price_biz_month");
  });

  it("defaults to yearly when no period is given", () => {
    expect(priceIdFor("pro")).toBe(priceIdFor("pro", "yearly"));
  });

  it("maps every id back to the plan that sold it", () => {
    expect(planForPrice("price_pro_year")).toBe("pro");
    expect(planForPrice("price_pro_month")).toBe("pro");
    expect(planForPrice("price_biz_year")).toBe("business");
    expect(planForPrice("price_biz_month")).toBe("business");
  });

  it("refuses to guess at an id it doesn't know", () => {
    // The webhook reads null as "no longer on a paid plan", so a wrong guess
    // here either downgrades a paying customer or upgrades a stranger.
    expect(planForPrice("price_someone_elses")).toBeNull();
    expect(planForPrice("")).toBeNull();
    expect(planForPrice(null)).toBeNull();
    expect(planForPrice(undefined)).toBeNull();
  });

  it("offers only the periods this deployment has an id for", () => {
    expect(periodsFor("pro")).toEqual(["yearly", "monthly"]);

    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    expect(periodsFor("pro")).toEqual(["yearly"]);
    // Still sellable, just not monthly — so the page draws one button.
    expect(billingEnabled()).toBe(true);

    delete process.env.STRIPE_PRICE_PRO;
    expect(periodsFor("pro")).toEqual([]);
    expect(billingEnabled()).toBe(false);
  });

  it("stays switched off without a secret key, however many ids are set", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(billingEnabled()).toBe(false);
  });

  it("has nothing to sell on the free plan", () => {
    expect(periodsFor("free")).toEqual([]);
    expect(priceIdFor("free", "monthly")).toBeUndefined();
  });
});
