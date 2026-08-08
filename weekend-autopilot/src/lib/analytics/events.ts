/**
 * Product analytics (§45).
 *
 * The event names are the contract with the metrics dashboard, so they live in
 * one typed place rather than being spelled out at each call site — a typo in
 * an event name is a metric that quietly reads zero for a month.
 *
 * The north-star is the share of delivered plans that customers actually do,
 * which is `did_it_yes / plan_delivered`. Everything else is supporting cast.
 */

export const ANALYTICS_EVENTS = {
  LANDING_CTA_CLICKED: "landing_cta_clicked",
  CHECKOUT_STARTED: "checkout_started",
  PURCHASE_COMPLETED: "purchase_completed",
  SIGNUP_COMPLETED: "signup_completed",
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",

  CHECKIN_COMPLETED: "checkin_completed",

  PLAN_GENERATED: "plan_generated",
  PLAN_DELIVERED: "plan_delivered",
  PLAN_OPENED: "plan_opened",
  PLAN_SWAP_REQUESTED: "plan_swap_requested",
  PLAN_SWAP_COMPLETED: "plan_swap_completed",

  DID_IT_YES: "did_it_yes",
  DID_IT_NO: "did_it_no",
  PLAN_RATING: "plan_rating",

  AFFILIATE_CLICKED: "affiliate_clicked",

  PILOT_COMPLETED: "pilot_completed",
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  SUBSCRIPTION_RENEWED: "subscription_renewed",

  WAITLIST_JOINED: "waitlist_joined",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Properties we allow on events. Deliberately narrow: analytics is not a place
 * to put a customer's home suburb, a child's age or a free-text note.
 */
export interface EventProperties {
  plan_id?: string;
  plan_type?: string;
  weekend_date?: string;
  market_id?: string;
  tier?: string;
  rating?: string;
  reason?: string;
  swap_reason?: string;
  activity_level?: string;
  confidence?: number;
  step?: string;
  source?: string;
}
