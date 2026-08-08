import { beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { advancePilotWeek, handleStripeEvent } from "@/lib/billing/stripe";
import { conversionOffers, OFFERS, PILOT_DELIVERIES, visibleOffers } from "@/lib/billing/plans";
import { asClient, FakeDb } from "../helpers/fake-db";

/**
 * Stripe webhook handling (§29, §48).
 *
 * Subscription state is derived from verified events rather than from what the
 * browser reports after a redirect. These tests cover the state machine and,
 * importantly, that replaying an event is a no-op — Stripe retries, and a
 * handler that is not idempotent will eventually double-count something.
 */

function event(type: string, object: unknown): Stripe.Event {
  return { id: `evt_${type}`, type, data: { object } } as Stripe.Event;
}

const CHECKOUT_SESSION = {
  id: "cs_test_1",
  customer: "cus_1",
  payment_intent: "pi_1",
  subscription: null,
  amount_total: 2900,
  currency: "aud",
  customer_details: { email: "Person@Example.com" },
  metadata: { tier: "PILOT_4_WEEK", household_id: "household-1", user_id: "user-1" },
};

describe("checkout completion", () => {
  let db: FakeDb;

  beforeEach(() => {
    db = new FakeDb({ subscriptions: [], payments: [] });
  });

  it("activates the pilot and records the payment", async () => {
    await handleStripeEvent(asClient(db), event("checkout.session.completed", CHECKOUT_SESSION));

    const subscription = db.rows("subscriptions")[0];
    expect(subscription).toMatchObject({
      household_id: "household-1",
      status: "PILOT_ACTIVE",
      tier: "PILOT_4_WEEK",
      stripe_customer_id: "cus_1",
    });

    const payment = db.rows("payments")[0];
    expect(payment).toMatchObject({ amount_cents: 2900, currency: "AUD", status: "paid" });
  });

  it("stores only a hash of the customer's email, never the address", async () => {
    // Payment records outlive account deletion (§52), so they must not carry
    // an identifier that would survive it.
    await handleStripeEvent(asClient(db), event("checkout.session.completed", CHECKOUT_SESSION));

    const payment = db.rows("payments")[0]!;
    expect(payment.customer_email_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(payment)).not.toContain("Person@Example.com");
    expect(JSON.stringify(payment)).not.toContain("person@example.com");
  });

  it("is idempotent when Stripe replays the event", async () => {
    const replay = event("checkout.session.completed", CHECKOUT_SESSION);
    await handleStripeEvent(asClient(db), replay);
    await handleStripeEvent(asClient(db), replay);
    await handleStripeEvent(asClient(db), replay);

    expect(db.rows("payments")).toHaveLength(1);
    expect(db.rows("subscriptions")).toHaveLength(1);
  });

  it("sets ACTIVE rather than PILOT_ACTIVE for a subscription purchase", async () => {
    await handleStripeEvent(
      asClient(db),
      event("checkout.session.completed", {
        ...CHECKOUT_SESSION,
        id: "cs_test_2",
        subscription: "sub_1",
        metadata: { ...CHECKOUT_SESSION.metadata, tier: "ANNUAL" },
      })
    );

    expect(db.rows("subscriptions")[0]).toMatchObject({ status: "ACTIVE", tier: "ANNUAL" });
  });

  it("still records the payment when the buyer has no household yet", async () => {
    // Checkout-before-account is a supported order (§8): the payment is
    // recorded now and attached when the webhook sees a household id later.
    await handleStripeEvent(
      asClient(db),
      event("checkout.session.completed", {
        ...CHECKOUT_SESSION,
        id: "cs_test_3",
        metadata: { tier: "PILOT_4_WEEK", household_id: "", user_id: "" },
      })
    );

    expect(db.rows("payments")).toHaveLength(1);
    expect(db.rows("subscriptions")).toHaveLength(0);
  });
});

describe("subscription lifecycle", () => {
  let db: FakeDb;

  beforeEach(() => {
    db = new FakeDb({
      subscriptions: [
        {
          id: "sub-row",
          household_id: "household-1",
          user_id: "user-1",
          status: "ACTIVE",
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          pilot_week_number: 0,
        },
      ],
    });
  });

  function subscriptionObject(overrides: Record<string, unknown> = {}) {
    return {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      current_period_end: 1_800_000_000,
      cancel_at_period_end: false,
      metadata: { household_id: "household-1" },
      ...overrides,
    };
  }

  it("marks a subscription past due when a payment fails", async () => {
    await handleStripeEvent(
      asClient(db),
      event("invoice.payment_failed", { customer: "cus_1" })
    );
    expect(db.rows("subscriptions")[0]?.status).toBe("PAST_DUE");
  });

  it("restores delivery when a retried payment succeeds", async () => {
    await handleStripeEvent(asClient(db), event("invoice.payment_failed", { customer: "cus_1" }));
    await handleStripeEvent(
      asClient(db),
      event("invoice.payment_succeeded", { customer: "cus_1" })
    );
    expect(db.rows("subscriptions")[0]?.status).toBe("ACTIVE");
  });

  it("records a cancellation without deleting the customer's history", async () => {
    await handleStripeEvent(
      asClient(db),
      event("customer.subscription.deleted", subscriptionObject({ status: "canceled" }))
    );
    expect(db.rows("subscriptions")[0]).toMatchObject({
      status: "CANCELLED",
      cancel_at_period_end: true,
    });
  });

  it("maps a trialing subscription to TRIAL", async () => {
    await handleStripeEvent(
      asClient(db),
      event("customer.subscription.updated", subscriptionObject({ status: "trialing" }))
    );
    expect(db.rows("subscriptions")[0]?.status).toBe("TRIAL");
  });

  it("carries the period end through, so renewal dates are honest", async () => {
    await handleStripeEvent(
      asClient(db),
      event("customer.subscription.updated", subscriptionObject())
    );
    expect(db.rows("subscriptions")[0]?.current_period_end).toBe(
      new Date(1_800_000_000 * 1000).toISOString()
    );
  });

  it("ignores event types it does not handle", async () => {
    const outcome = await handleStripeEvent(asClient(db), event("customer.created", {}));
    expect(outcome.handled).toBe(false);
  });
});

describe("pilot progression (§29)", () => {
  it("counts a delivery, not a calendar week", async () => {
    const db = new FakeDb({
      subscriptions: [
        { household_id: "household-1", status: "PILOT_ACTIVE", pilot_week_number: 0 },
      ],
    });

    const first = await advancePilotWeek(asClient(db), "household-1");
    expect(first).toEqual({ week: 1, completed: false });
    expect(db.rows("subscriptions")[0]?.pilot_week_number).toBe(1);
  });

  it("flags completion on the fourth delivery", async () => {
    const db = new FakeDb({
      subscriptions: [
        { household_id: "household-1", status: "PILOT_ACTIVE", pilot_week_number: 3 },
      ],
    });

    const fourth = await advancePilotWeek(asClient(db), "household-1");
    expect(fourth).toEqual({ week: PILOT_DELIVERIES, completed: true });
  });

  it("never counts past four", async () => {
    const db = new FakeDb({
      subscriptions: [
        { household_id: "household-1", status: "PILOT_ACTIVE", pilot_week_number: 4 },
      ],
    });
    const result = await advancePilotWeek(asClient(db), "household-1");
    expect(result.week).toBe(4);
  });

  it("does nothing for a household that is not on a pilot", async () => {
    const db = new FakeDb({
      subscriptions: [{ household_id: "household-1", status: "ACTIVE", pilot_week_number: 0 }],
    });
    const result = await advancePilotWeek(asClient(db), "household-1");
    expect(result).toEqual({ week: 0, completed: false });
    expect(db.rows("subscriptions")[0]?.pilot_week_number).toBe(0);
  });
});

describe("offers and flags (§6)", () => {
  it("sells only the pilot by default", () => {
    const visible = visibleOffers();
    expect(visible.map((o) => o.tier)).toEqual(["PILOT_4_WEEK"]);
  });

  it("offers annual on the conversion page regardless of the landing flags", () => {
    expect(conversionOffers().map((o) => o.tier)).toContain("ANNUAL");
  });

  it("models the pilot as a one-off payment, not a subscription", () => {
    expect(OFFERS.PILOT_4_WEEK.mode).toBe("payment");
    expect(OFFERS.PILOT_4_WEEK.deliveries).toBe(PILOT_DELIVERIES);
  });

  it("models annual and monthly as subscriptions with no delivery cap", () => {
    expect(OFFERS.ANNUAL.mode).toBe("subscription");
    expect(OFFERS.ANNUAL.deliveries).toBeNull();
    expect(OFFERS.MONTHLY.mode).toBe("subscription");
  });
});
