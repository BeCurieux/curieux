import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BILLING_PERIODS,
  cadenceLabel,
  interactionLimit,
  isBillingPeriod,
  nextPlanUp,
  ORDERED_PLANS,
  priceFor,
  priceLabel,
  widgetLimit,
  yearlySaving,
} from "@/lib/plans";

const countInteractionsThisMonth = vi.fn<(ownerId: string) => Promise<number>>();

vi.mock("@/lib/db/store", () => ({
  getStore: () => ({ countInteractionsThisMonth }),
  uniqueSlug: vi.fn(),
}));

const { isOverInteractionLimit } = await import("@/lib/widgets/service");

/**
 * The monthly interaction limit was displayed for a while before anything
 * enforced it — a bar filling towards a number that meant nothing. These
 * tests are about the boundary, because an off-by-one here either pauses
 * someone a visitor early or lets the plan be exceeded forever.
 */
describe("the monthly interaction limit", () => {
  beforeEach(() => countInteractionsThisMonth.mockReset());

  const at = (used: number) => {
    countInteractionsThisMonth.mockResolvedValue(used);
    return isOverInteractionLimit("u_1", "free");
  };

  const free = interactionLimit("free");

  it("lets the last allowed interaction through", async () => {
    // 499 used means the 500th visitor still gets a widget.
    await expect(at(free - 1)).resolves.toBe(false);
  });

  it("pauses once the allowance is spent, not before", async () => {
    await expect(at(free)).resolves.toBe(true);
  });

  it("stays paused if the count somehow ran past the limit", async () => {
    await expect(at(free * 3)).resolves.toBe(true);
  });

  it("is not tripped by a widget nobody has used", async () => {
    await expect(at(0)).resolves.toBe(false);
  });

  it("gives each plan its own ceiling", async () => {
    countInteractionsThisMonth.mockResolvedValue(free);
    // The same usage that pauses a free account is nowhere near a paid one.
    await expect(isOverInteractionLimit("u_1", "free")).resolves.toBe(true);
    await expect(isOverInteractionLimit("u_1", "pro")).resolves.toBe(false);
    await expect(isOverInteractionLimit("u_1", "business")).resolves.toBe(false);
  });
});

/**
 * What a paused account is offered depends entirely on this: UpgradeAction
 * branches on whether there is a plan above yours, and offers a checkout (or
 * an email) only when there is. Get it wrong at the top and the largest plan
 * is sold an upgrade that doesn't exist.
 */
describe("whether there is anywhere to upgrade to", () => {
  it("points each plan at the next one up", () => {
    expect(nextPlanUp("free")?.id).toBe("pro");
    expect(nextPlanUp("pro")?.id).toBe("business");
  });

  it("returns nothing for the largest plan, so it isn't sold to itself", () => {
    const largest = ORDERED_PLANS[ORDERED_PLANS.length - 1];
    expect(nextPlanUp(largest.id)).toBeNull();
  });

  it("never points at a plan that costs the same or less", () => {
    for (const plan of ORDERED_PLANS) {
      const next = nextPlanUp(plan.id);
      if (next)
        expect(next.priceYearly, `${plan.id} → ${next.id}`).toBeGreaterThan(plan.priceYearly);
    }
  });
});

/**
 * The pricing page renders `features` verbatim, and those strings are written
 * by hand a few lines below the numbers they describe. Nothing stopped the
 * two drifting apart, which is how a pricing page starts quoting a limit the
 * product doesn't enforce.
 */
describe("what the pricing page promises", () => {
  /** 10000 → "10,000", the way the feature strings are written. */
  const grouped = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  it("quotes each plan's real widget limit", () => {
    for (const plan of ORDERED_PLANS) {
      const claim = `${grouped(widgetLimit(plan.id))} widgets`;
      expect(plan.features, `${plan.id} should say "${claim}"`).toContain(claim);
    }
  });

  it("quotes each plan's real interaction limit", () => {
    for (const plan of ORDERED_PLANS) {
      const claim = `${grouped(interactionLimit(plan.id))} interactions a month`;
      expect(plan.features, `${plan.id} should say "${claim}"`).toContain(claim);
    }
  });

  it("never advertises a capability the plan doesn't have", () => {
    // "Integrations" was advertised on Business while nothing implemented it.
    const claims: Array<[string, keyof (typeof ORDERED_PLANS)[number]["limits"]]> = [
      ["Remove the badge", "removeBadge"],
      ["Lead capture", "leadCapture"],
    ];
    for (const plan of ORDERED_PLANS) {
      for (const [claim, flag] of claims) {
        if (plan.features.includes(claim)) {
          expect(plan.limits[flag], `${plan.id} advertises "${claim}"`).toBe(true);
        }
      }
    }
  });
});

describe("the published limits", () => {
  it("only ever go up as you pay more", () => {
    // A plan that cost more but allowed less would be a pricing page that
    // lies, and the pricing page is generated from exactly these numbers.
    const paid = [...ORDERED_PLANS].sort((a, b) => a.priceYearly - b.priceYearly);
    for (let index = 1; index < paid.length; index += 1) {
      const [previous, current] = [paid[index - 1], paid[index]];
      expect(widgetLimit(current.id), current.id).toBeGreaterThan(widgetLimit(previous.id));
      expect(interactionLimit(current.id), current.id).toBeGreaterThan(
        interactionLimit(previous.id)
      );
    }
  });
});

/**
 * Two prices per plan instead of one is two chances to disagree with each
 * other, and the pricing page prints a saving calculated from both. These
 * pin the relationship rather than the numbers, so the prices stay a
 * business decision while the arithmetic stays honest.
 */
describe("monthly and yearly", () => {
  const paidPlans = ORDERED_PLANS.filter((plan) => plan.priceYearly > 0);

  it("has both prices on every paid plan", () => {
    expect(paidPlans.length).toBeGreaterThan(0);
    for (const plan of paidPlans) {
      expect(plan.priceMonthly, plan.id).toBeGreaterThan(0);
      expect(plan.priceYearly, plan.id).toBeGreaterThan(0);
    }
  });

  it("makes paying yearly genuinely cheaper, or there is nothing to advertise", () => {
    for (const plan of paidPlans) {
      expect(plan.priceYearly, `${plan.id} yearly should beat 12 months`).toBeLessThan(
        plan.priceMonthly * 12
      );
      expect(yearlySaving(plan), plan.id).toBeGreaterThan(0);
    }
  });

  it("states a saving that is exactly the gap between the two prices", () => {
    for (const plan of paidPlans) {
      expect(yearlySaving(plan)).toBe(plan.priceMonthly * 12 - plan.priceYearly);
    }
  });

  it("keeps free free in both periods, and never calls it a saving", () => {
    const free = ORDERED_PLANS.find((plan) => plan.priceYearly === 0)!;
    for (const period of BILLING_PERIODS) {
      expect(priceFor(free, period)).toBe(0);
      expect(priceLabel(free, period)).toBe("Free");
      expect(cadenceLabel(free, period)).toBe("forever");
    }
    expect(yearlySaving(free)).toBe(0);
  });

  it("labels each period with the interval actually being bought", () => {
    for (const plan of paidPlans) {
      expect(cadenceLabel(plan, "monthly")).toBe("per month");
      expect(cadenceLabel(plan, "yearly")).toBe("per year");
      expect(priceLabel(plan, "monthly")).toBe(`$${plan.priceMonthly}`);
      expect(priceLabel(plan, "yearly")).toBe(`$${plan.priceYearly}`);
    }
  });

  it("accepts only the two real periods from a URL or a form field", () => {
    // The pricing page reads ?billing= and the checkout route reads a form
    // field; both are attacker-controlled strings.
    expect(isBillingPeriod("monthly")).toBe(true);
    expect(isBillingPeriod("yearly")).toBe(true);
    for (const junk of ["", "weekly", "MONTHLY", "__proto__", null, undefined, 12, {}]) {
      expect(isBillingPeriod(junk), String(junk)).toBe(false);
    }
  });

  it("gives every paid plan a distinct Stripe price env per period", () => {
    const seen = new Set<string>();
    for (const plan of paidPlans) {
      for (const key of [plan.stripePriceEnv, plan.stripePriceEnvMonthly]) {
        // A shared env var would bill monthly customers the yearly price.
        expect(key, plan.id).toBeTruthy();
        expect(seen.has(key!), `${key} reused`).toBe(false);
        seen.add(key!);
      }
    }
  });
});
