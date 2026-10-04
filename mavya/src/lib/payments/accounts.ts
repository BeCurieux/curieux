import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountFlags, paymentsOn, planSubscription, stripe } from "./stripe";

// Asks Stripe how a school's account stands and keeps the answer, for when
// an owner comes back from Stripe's sign-up before Stripe's message does.
// Only called for the signed-in owner's own account.
export async function refreshPaymentAccount(organisationId: string, accountId: string) {
  if (!paymentsOn()) return;
  const flags = accountFlags(await stripe().accounts.retrieve(accountId));
  const { error } = await createAdminClient().rpc("save_payment_account", {
    p_org: organisationId,
    p_account: accountId,
    p_charges: flags.charges,
    p_payouts: flags.payouts,
    p_details: flags.details,
  });
  if (error) throw error;
}

// Asks Stripe for a school's plan and keeps the answer, for when an owner
// comes back from Stripe's page before Stripe's message does. Only called
// for the signed-in owner's own school.
export async function refreshSchoolPlan(organisationId: string) {
  if (!paymentsOn()) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from("school_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (!data) return;
  const list = await stripe().subscriptions.list({ customer: data.stripe_customer_id, limit: 1 });
  const sub = list.data[0];
  if (!sub) return;
  const s = planSubscription(sub);
  const { error } = await admin.rpc("save_school_subscription", {
    p_customer: s.customer,
    p_subscription: s.id,
    p_status: s.status,
    p_locations: s.locations,
    p_price_cents: s.priceCents,
    p_trial_end: s.trialEnd as string,
    p_period_end: s.periodEnd as string,
    p_cancel_at_period_end: s.cancelAtPeriodEnd,
  });
  if (error) throw error;
}
