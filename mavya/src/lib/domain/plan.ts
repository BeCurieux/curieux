import { explain, type Db } from "./db";

// Ovyko's plan (docs/SUBSCRIPTIONS.md): where a school's subscription to
// Ovyko stands. Owners read it; only the server records it.

export const PLAN_PRICE_CENTS = 39900;
export const TRIAL_DAYS = 30;

export type PlanState = "trial" | "ok" | "attention" | "none" | "demo";

export type SchoolPlan = {
  state: PlanState;
  trialEnds: string;
  locationsNow: number;
  subscription: {
    status: string | null;
    locations: number | null;
    priceCents: number | null;
    trialEnd: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasSubscription: boolean;
  } | null;
};

export async function schoolPlan(db: Db, organisationId: string): Promise<SchoolPlan> {
  const [state, sub] = await Promise.all([
    db.rpc("school_plan_state", { p_org: organisationId }),
    db
      .from("school_subscriptions")
      .select(
        "stripe_subscription_id, status, locations, price_cents, trial_end, current_period_end, cancel_at_period_end",
      )
      .eq("organisation_id", organisationId)
      .maybeSingle(),
  ]);
  if (state.error) throw explain(state.error);
  if (sub.error) throw explain(sub.error);
  const row = state.data![0]!;
  const s = sub.data;
  return {
    state: row.state as PlanState,
    trialEnds: row.trial_ends,
    locationsNow: row.locations,
    subscription: s
      ? {
          status: s.status,
          locations: s.locations,
          priceCents: s.price_cents,
          trialEnd: s.trial_end,
          periodEnd: s.current_period_end,
          cancelAtPeriodEnd: s.cancel_at_period_end,
          hasSubscription: s.stripe_subscription_id !== null,
        }
      : null,
  };
}

// Just the state, for the reminder on every business page.
export async function planState(db: Db, organisationId: string): Promise<PlanState | null> {
  const { data, error } = await db.rpc("school_plan_state", { p_org: organisationId });
  if (error) return null;
  return (data?.[0]?.state as PlanState) ?? null;
}
