// Starts a Stripe checkout for the signed-in user (brief §35).
//
// A POST form target rather than a client fetch, so it works before any
// JavaScript has loaded and needs no CSRF token of our own beyond the
// same-site session cookie.

import { NextResponse } from "next/server";
import { appUrl } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { billingEnabled, createCheckout } from "@/lib/billing/stripe";
import { isBillingPeriod, PLAN_IDS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.redirect(`${appUrl()}/pricing`, 303);

  const user = await currentUser();
  if (!isRegistered(user)) return NextResponse.redirect(`${appUrl()}/signup`, 303);

  const form = await request.formData();
  const plan = String(form.get("plan") ?? "");
  if (!PLAN_IDS.includes(plan as PlanId) || plan === "free") {
    return NextResponse.redirect(`${appUrl()}/pricing`, 303);
  }

  // Anything unrecognised falls back to yearly, which is the pricing page's
  // default and so what a request with no period at all meant. Nobody is
  // charged the wrong amount by this: Stripe's own page states the price and
  // the interval before the customer confirms, so a wrong guess here is a
  // checkout they decline, not a payment they didn't agree to.
  const raw = form.get("period");
  const period = isBillingPeriod(raw) ? raw : "yearly";

  const url = await createCheckout({
    userId: user.id,
    email: user.email,
    plan: plan as PlanId,
    period,
    successUrl: `${appUrl()}/dashboard/settings?upgraded=1`,
    cancelUrl: `${appUrl()}/pricing`,
  });

  return NextResponse.redirect(url ?? `${appUrl()}/pricing`, 303);
}
