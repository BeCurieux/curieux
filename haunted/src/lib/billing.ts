// Billing (CLAUDE.md §Billing). Trial → paid, tiered on ACTIVE subscribers — the
// thing that scales cost is push volume + Haiku calls. Kept deliberately simple
// for v1: a free tier capped at N subscribers (dogfooding / AVOCA), paid tiers
// above. Gating is on shops.plan. Stripe wiring is stubbed until keys are set.

export interface PlanTier {
  key: string;
  label: string;
  maxSubscribers: number; // Infinity for unlimited
  priceUsd: number;
}

export const PLANS: Record<string, PlanTier> = {
  trial: { key: 'trial', label: 'Trial', maxSubscribers: 250, priceUsd: 0 },
  starter: { key: 'starter', label: 'Starter', maxSubscribers: 2000, priceUsd: 19 },
  growth: { key: 'growth', label: 'Growth', maxSubscribers: 20000, priceUsd: 79 },
  scale: { key: 'scale', label: 'Scale', maxSubscribers: Infinity, priceUsd: 249 },
};

export function planFor(planKey: string): PlanTier {
  return PLANS[planKey] ?? PLANS.trial!;
}

// True when the shop is within its subscriber allowance. The sender consults this
// before enqueuing so an over-cap shop stops accruing push/Haiku cost.
export function withinPlan(planKey: string, activeSubscribers: number): boolean {
  return activeSubscribers <= planFor(planKey).maxSubscribers;
}
