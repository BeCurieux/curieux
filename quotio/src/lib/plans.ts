// Plans and feature gates (brief §35).
//
// The gates exist from day one even though Stripe may not be switched on yet,
// because retrofitting limits into a product that never had them means
// auditing every call site later. Everything below is data; `can()` is the
// only place that decides.
//
// Note what is NOT gated: publishing, hosted links, embeds and the result
// screen. A free widget is a complete widget with a badge on it — that badge
// is the growth loop (§22), and it only works if free widgets are worth
// showing to customers.

export const PLAN_IDS = ["free", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  widgets: number;
  /**
   * Visitors who answer something, per calendar month — `widget_start`, not
   * completions. Someone who abandons halfway still counted as a visitor the
   * widget served, so they count here. Enforced in
   * `widgets/service.ts:isOverInteractionLimit`: past it, published widgets
   * show a paused notice until the month turns over.
   */
  interactions: number;
  removeBadge: boolean;
  leadCapture: boolean;
  analytics: boolean;
  premiumThemes: boolean;
  advancedLogic: boolean;
  integrations: boolean;
}

export const BILLING_PERIODS = ["yearly", "monthly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  /**
   * Whole currency units, 0 for free. Two prices rather than one rate and a
   * multiplier: paying yearly is cheaper per month, and the discount is the
   * gap between these two numbers rather than a rule written down somewhere
   * that the displayed figures have to remember to obey.
   */
  priceYearly: number;
  priceMonthly: number;
  blurb: string;
  limits: PlanLimits;
  /** Bullet list for the pricing page, in the order it should read. */
  features: string[];
  /**
   * Set once the Stripe products exist; the checkout route needs them. One
   * per period — a plan can be purchasable yearly and not monthly, and the
   * UI must only offer the button it can actually honour (§41).
   */
  stripePriceEnv?: string;
  stripePriceEnvMonthly?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceYearly: 0,
    priceMonthly: 0,
    blurb: "Enough to put a real widget on a real website.",
    limits: {
      widgets: 3,
      interactions: 500,
      removeBadge: false,
      leadCapture: false,
      analytics: false,
      premiumThemes: false,
      advancedLogic: false,
      integrations: false,
    },
    // Every line here must be something the gates above actually enforce, and
    // the lists are the same length so the three cards align. Embeds are on
    // the free plan deliberately: the badge is the growth loop (§22), and it
    // only spreads if free widgets can go on real websites.
    features: [
      "3 widgets",
      "500 interactions a month",
      "Hosted links and embeds",
      "Every template",
      "Playful and Minimal themes",
      "“Made with” badge",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceYearly: 99,
    priceMonthly: 10,
    blurb: "For a business that runs on the enquiries these bring in.",
    limits: {
      widgets: 20,
      interactions: 10000,
      removeBadge: true,
      leadCapture: true,
      analytics: true,
      premiumThemes: true,
      advancedLogic: false,
      integrations: false,
    },
    features: [
      "20 widgets",
      "10,000 interactions a month",
      "Remove the badge",
      "All six themes",
      "Lead capture",
      "Analytics and enquiries",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
    stripePriceEnvMonthly: "STRIPE_PRICE_PRO_MONTHLY",
  },
  business: {
    id: "business",
    name: "Business",
    priceYearly: 199,
    priceMonthly: 20,
    blurb: "Higher limits and the logic that bigger rollouts need.",
    limits: {
      widgets: 100,
      interactions: 100000,
      removeBadge: true,
      leadCapture: true,
      analytics: true,
      premiumThemes: true,
      advancedLogic: true,
      integrations: true,
    },
    // "Integrations" is in the plan's capability flags but nothing implements
    // it yet, so it stays off the pricing page until it does (§41).
    features: [
      "100 widgets",
      "100,000 interactions a month",
      "Everything in Pro",
      "Show and hide questions",
      "Multipliers and discounts",
    ],
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
    stripePriceEnvMonthly: "STRIPE_PRICE_BUSINESS_MONTHLY",
  },
};

export const ORDERED_PLANS: Plan[] = [PLANS.free, PLANS.pro, PLANS.business];

export type Capability = keyof Omit<PlanLimits, "widgets" | "interactions">;

/** The single place a feature gate is decided. */
export function can(plan: PlanId, capability: Capability): boolean {
  return PLANS[plan].limits[capability];
}

export function widgetLimit(plan: PlanId): number {
  return PLANS[plan].limits.widgets;
}

export function interactionLimit(plan: PlanId): number {
  return PLANS[plan].limits.interactions;
}

/**
 * Whether the badge must be shown on a given widget.
 *
 * Two conditions, and the plan one is not negotiable in the UI: a free user
 * can untick "show badge" in settings all they like, and it will still render.
 * The setting is remembered so it takes effect the moment they upgrade.
 */
export function mustShowBadge(plan: PlanId, settingEnabled: boolean): boolean {
  if (!can(plan, "removeBadge")) return true;
  return settingEnabled;
}

/** The upgrade prompt shown when someone hits a wall. Never a dead end. */
export function nextPlanUp(plan: PlanId): Plan | null {
  const index = PLAN_IDS.indexOf(plan);
  const next = PLAN_IDS[index + 1];
  return next ? PLANS[next] : null;
}

/* ---- Prices ------------------------------------------------------- */

export function priceFor(plan: Plan, period: BillingPeriod): number {
  return period === "monthly" ? plan.priceMonthly : plan.priceYearly;
}

/** "$99", "$10" — or "Free", which is a price and not an absence of one. */
export function priceLabel(plan: Plan, period: BillingPeriod): string {
  const price = priceFor(plan, period);
  return price === 0 ? "Free" : `$${price}`;
}

export function cadenceLabel(plan: Plan, period: BillingPeriod): string {
  if (plan.priceYearly === 0) return "forever";
  return period === "monthly" ? "per month" : "per year";
}

/**
 * What paying yearly saves, in whole currency units.
 *
 * Derived from the two prices rather than stated separately, so a "save $21"
 * badge cannot outlive the numbers it was calculated from. Zero (or less)
 * means there is nothing to boast about and the badge shouldn't appear.
 */
export function yearlySaving(plan: Plan): number {
  return plan.priceMonthly * 12 - plan.priceYearly;
}

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return BILLING_PERIODS.includes(value as BillingPeriod);
}
