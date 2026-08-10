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
  /** Completed widget sessions per calendar month. */
  interactions: number;
  removeBadge: boolean;
  leadCapture: boolean;
  analytics: boolean;
  premiumThemes: boolean;
  advancedLogic: boolean;
  integrations: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Annual price in whole currency units; 0 for free. */
  price: number;
  cadence: string;
  blurb: string;
  limits: PlanLimits;
  /** Bullet list for the pricing page, in the order it should read. */
  features: string[];
  /** Set once the Stripe products exist; the checkout route needs it. */
  stripePriceEnv?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    cadence: "forever",
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
    features: [
      "3 widgets",
      "500 interactions a month",
      "Hosted links",
      "Basic templates",
      "“Made with” badge",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 99,
    cadence: "per year",
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
      "Premium themes",
      "Lead capture",
      "Analytics",
      "Embeds",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  business: {
    id: "business",
    name: "Business",
    price: 199,
    cadence: "per year",
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
    features: [
      "100 widgets",
      "100,000 interactions a month",
      "Everything in Pro",
      "Advanced logic",
      "Integrations",
    ],
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
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
