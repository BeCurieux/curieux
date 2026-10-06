"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { z } from "zod";
import { requireShell } from "@/lib/auth/viewer";
import { requireOwner } from "@/lib/business/owner";
import { DomainError } from "@/lib/domain/db";
import {
  payRestOfPlanNow,
  paymentAccount,
  setInstalmentsOn,
  startInstalmentPlan,
  startOnlinePayment,
} from "@/lib/domain/payments";
import { appUrl } from "@/lib/email/transport";
import type { FormState } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { accountFlags, paymentsOn, stripe } from "./stripe";

// The two moments Ovyko sends someone to Stripe (M7b): an owner setting up
// payments, and a parent paying. Each checks who's asking with their own
// client first; only then does the server use Stripe and the secret key.

// Creates the school's Stripe account once, then opens Stripe's sign-up.
export async function setUpPayments(): Promise<FormState> {
  const { db, organisationId, organisationName, viewer, demo } = await requireOwner();
  if (demo) return { error: "Payments are switched off in the demo." };
  if (!paymentsOn()) return { error: "Payments aren't switched on in Ovyko yet." };
  let accountId = (await paymentAccount(db, organisationId))?.stripeAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create(
      {
        country: "AU",
        email: viewer.email,
        business_profile: {
          name: organisationName,
          product_description: "Children's activity lessons, paid by term.",
        },
        // The school is the seller with its own Stripe dashboard: it pays
        // Stripe's fees and Stripe checks who it is.
        controller: {
          fees: { payer: "account" },
          losses: { payments: "stripe" },
          stripe_dashboard: { type: "full" },
          requirement_collection: "stripe",
        },
        metadata: { ovyko_organisation_id: organisationId },
      },
      { idempotencyKey: `account:${organisationId}` },
    );
    const flags = accountFlags(account);
    const { data, error } = await createAdminClient().rpc("save_payment_account", {
      p_org: organisationId,
      p_account: account.id,
      p_charges: flags.charges,
      p_payouts: flags.payouts,
      p_details: flags.details,
    });
    if (error) throw error;
    accountId = data;
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: appUrl("/business/settings/payments?again=1"),
    return_url: appUrl("/business/settings/payments?back=1"),
  });
  redirect(link.url);
}

// An owner offers instalments to families, or stops offering them. Plans
// already under way carry on.
export async function setInstalments(on: boolean): Promise<FormState> {
  const { db, organisationId } = await requireOwner();
  try {
    await setInstalmentsOn(db, organisationId, on === true);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath("/business/settings/payments");
  return {
    ok: on
      ? "Families can pay $100 or more in 2 or 4 payments."
      : "Instalments are off for new plans. Plans already under way carry on.",
  };
}

type Started = Awaited<ReturnType<typeof startOnlinePayment>>;

// Opens Stripe's payment page for a payment the database started, or
// reopens the one already open, so nothing is ever paid twice. With
// `save`, the card or bank account is kept for the instalments to come.
async function openPaymentPage(
  email: string,
  start: () => Promise<Started | { error: string }>,
  save: boolean,
): Promise<FormState> {
  let started = await start();
  if ("error" in started) return started;

  if (started.checkoutSessionId) {
    const open = await stripe().checkout.sessions.retrieve(
      started.checkoutSessionId,
      {},
      { stripeAccount: started.stripeAccountId },
    );
    if (open.status === "open" && open.url) redirect(open.url);
    if (open.status === "complete")
      return { error: "Your last payment is still being confirmed. Check back in a minute." };
    // Expired without Stripe telling us: close it and open a new one.
    const { error } = await createAdminClient().rpc("settle_online_payment", {
      p_payment: started.paymentId,
      p_account: started.stripeAccountId,
      p_session: started.checkoutSessionId,
      p_amount_cents: started.amountCents,
      p_status: "expired",
    });
    if (error) throw error;
    started = await start();
    if ("error" in started) return started;
    if (started.checkoutSessionId) return { error: "That didn't work. Try again." };
  }

  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: started.amountCents,
            product_data: { name: `Fees: ${started.schoolName}` },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: started.platformFeeCents,
        metadata: { ovyko_payment_id: started.paymentId },
        ...(save ? { setup_future_usage: "off_session" as const } : {}),
      },
      // Saving for instalments: not the ways of paying Ovyko can't take
      // again on its own. Anything else that isn't a card or direct debit
      // ends the plan (attach_plan_payment_method).
      ...(save
        ? {
            customer_creation: "always" as const,
            excluded_payment_method_types: [
              "afterpay_clearpay",
              "zip",
              "klarna",
              "paypal",
              "payto",
              "amazon_pay",
            ] satisfies Stripe.Checkout.SessionCreateParams.ExcludedPaymentMethodType[],
          }
        : {}),
      customer_email: email,
      client_reference_id: started.paymentId,
      metadata: { ovyko_payment_id: started.paymentId },
      success_url: appUrl(`/family/fees?paid=${started.paymentId}`),
      cancel_url: appUrl("/family/fees"),
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    { stripeAccount: started.stripeAccountId, idempotencyKey: `checkout:${started.paymentId}` },
  );
  const { error } = await createAdminClient().rpc("attach_checkout_session", {
    p_payment: started.paymentId,
    p_session: session.id,
  });
  if (error) throw error;
  if (!session.url) throw new Error("Stripe returned no payment page");
  redirect(session.url);
}

const domain =
  <T>(run: () => Promise<T>) =>
  async (): Promise<T | { error: string }> => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof DomainError) return { error: error.message };
      throw error;
    }
  };

// A parent pays what their family owes on Stripe's own payment page.
export async function payOnline(familyId: string): Promise<FormState> {
  const viewer = await requireShell("family");
  if (!z.uuid().safeParse(familyId).success) return { error: "That didn't work. Try again." };
  if (!paymentsOn()) return { error: "Paying in Ovyko isn't switched on yet." };
  const db = await createClient();
  return openPaymentPage(
    viewer.email,
    domain(() => startOnlinePayment(db, familyId)),
    false,
  );
}

// A parent pays in 2 or 4 instalments (M7c part 2): the first now, on
// Stripe's page, which saves the card or bank account for the rest.
export async function payInInstalments(familyId: string, payments: number): Promise<FormState> {
  const viewer = await requireShell("family");
  if (!z.uuid().safeParse(familyId).success || (payments !== 2 && payments !== 4))
    return { error: "That didn't work. Try again." };
  if (!paymentsOn()) return { error: "Paying in Ovyko isn't switched on yet." };
  const db = await createClient();
  return openPaymentPage(
    viewer.email,
    domain(() => startInstalmentPlan(db, familyId, payments)),
    true,
  );
}

// Pays what's left of a plan now, which ends it.
export async function payRestOfPlan(familyId: string): Promise<FormState> {
  const viewer = await requireShell("family");
  if (!z.uuid().safeParse(familyId).success) return { error: "That didn't work. Try again." };
  if (!paymentsOn()) return { error: "Paying in Ovyko isn't switched on yet." };
  const db = await createClient();
  return openPaymentPage(
    viewer.email,
    domain(() => payRestOfPlanNow(db, familyId)),
    false,
  );
}
