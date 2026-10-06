"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/business/owner";
import { schoolPlan } from "@/lib/domain/plan";
import { appUrl } from "@/lib/email/transport";
import type { FormState } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/supabase/server-env";
import { planSubscription, stripe } from "./stripe";

// The owner's side of Ovyko's plan (docs/SUBSCRIPTIONS.md), on Ovyko's own
// Stripe account. Each checks the caller owns the school first.

const PLAN_PAGE = "/business/settings/plan";

async function customerFor(organisationId: string, name: string, email: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("school_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (existing) return existing.stripe_customer_id;
  const customer = await stripe().customers.create(
    { name, email, metadata: { ovyko_organisation_id: organisationId } },
    { idempotencyKey: `customer:${organisationId}` },
  );
  const { data, error } = await admin.rpc("save_school_customer", {
    p_org: organisationId,
    p_customer: customer.id,
  });
  if (error) throw error;
  return data!;
}

// Starts the plan on Stripe's own page, keeping what's left of the trial.
export async function startPlan(): Promise<FormState> {
  const { db, organisationId, organisationName, viewer } = await requireOwner();
  const price = serverEnv().STRIPE_SCHOOL_PRICE_ID;
  if (!serverEnv().STRIPE_SECRET_KEY || !price) return { error: "Billing isn't switched on yet." };
  const plan = await schoolPlan(db, organisationId);
  if (plan.state === "demo") return { error: "Demo schools aren't billed." };
  if (plan.subscription?.hasSubscription && plan.state === "ok")
    return { error: "Your plan is already set up." };
  const customer = await customerFor(organisationId, organisationName, viewer.email);
  // Stripe needs a trial to run at least two more days.
  const trialEnd = Math.floor(new Date(plan.trialEnds).getTime() / 1000);
  const keepTrial = trialEnd > Date.now() / 1000 + 2 * 24 * 60 * 60;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: Math.max(1, plan.locationsNow) }],
    subscription_data: {
      ...(keepTrial ? { trial_end: trialEnd } : {}),
      metadata: { ovyko_organisation_id: organisationId },
    },
    success_url: appUrl(`${PLAN_PAGE}?started=1`),
    cancel_url: appUrl(PLAN_PAGE),
  });
  if (!session.url) throw new Error("Stripe returned no page");
  redirect(session.url);
}

// Stripe's billing page: card, invoices, cancelling.
export async function managePlan(): Promise<FormState> {
  const { organisationId } = await requireOwner();
  const { data } = await createAdminClient()
    .from("school_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (!data) return { error: "Set up your plan first." };
  const portal = await stripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: appUrl(PLAN_PAGE),
  });
  redirect(portal.url);
}

// Bills for the school's locations as they are now.
export async function updatePlanLocations(): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  const plan = await schoolPlan(db, organisationId);
  const { data } = await createAdminClient()
    .from("school_subscriptions")
    .select("stripe_subscription_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (!data?.stripe_subscription_id) return { error: "Set up your plan first." };
  const sub = await stripe().subscriptions.retrieve(data.stripe_subscription_id);
  const item = sub.items.data[0];
  if (!item) return { error: "That didn't work. Try again." };
  const updated = await stripe().subscriptions.update(sub.id, {
    items: [{ id: item.id, quantity: Math.max(1, plan.locationsNow) }],
    proration_behavior: "create_prorations",
  });
  const s = planSubscription(updated);
  const { error } = await createAdminClient().rpc("save_school_subscription", {
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
  return { ok: `Your plan now covers ${Math.max(1, plan.locationsNow)} locations.` };
}
