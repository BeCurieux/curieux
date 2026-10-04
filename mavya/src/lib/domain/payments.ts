import { explain, type Db } from "./db";

// Card and direct-debit payments (docs/M7_PAYMENTS.md, M7b). Reads for
// owners and parents; the server alone talks to Stripe and settles
// payments (src/lib/payments).

// Ovyko's share of each online payment; matches private.platform_fee_bps().
export const PLATFORM_FEE_PERCENT = 0.5;

export type PaymentAccount = {
  stripeAccountId: string;
  canTakePayments: boolean;
  payoutsOn: boolean;
  detailsSubmitted: boolean;
};

export async function paymentAccount(
  db: Db,
  organisationId: string,
): Promise<PaymentAccount | null> {
  const { data, error } = await db
    .from("payment_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (error) throw explain(error);
  return data
    ? {
        stripeAccountId: data.stripe_account_id,
        canTakePayments: data.charges_enabled,
        payoutsOn: data.payouts_enabled,
        detailsSubmitted: data.details_submitted,
      }
    : null;
}

export async function canPayOnline(db: Db, organisationId: string): Promise<boolean> {
  const { data, error } = await db.rpc("can_pay_online", { p_org: organisationId });
  if (error) throw explain(error);
  return Boolean(data);
}

export type OnlinePaymentStatus = "started" | "processing" | "paid" | "failed" | "expired";

export type OnlinePayment = {
  id: string;
  amountCents: number;
  status: OnlinePaymentStatus;
  method: "card" | "direct_debit" | null;
  createdAt: string;
};

// A family's direct debits on their way and payments that didn't go
// through recently: what the statement doesn't show yet.
export async function paymentsToShow(db: Db, familyId: string): Promise<OnlinePayment[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("online_payments")
    .select("id, amount_cents, status, method, created_at")
    .eq("family_id", familyId)
    .or(`status.eq.processing,and(status.eq.failed,updated_at.gte.${since})`)
    .order("created_at", { ascending: false });
  if (error) throw explain(error);
  return (data ?? []).map((p) => ({
    id: p.id,
    amountCents: p.amount_cents,
    status: p.status as OnlinePaymentStatus,
    method: p.method as OnlinePayment["method"],
    createdAt: p.created_at,
  }));
}

export async function onlinePayment(db: Db, paymentId: string): Promise<OnlinePayment | null> {
  const { data, error } = await db
    .from("online_payments")
    .select("id, amount_cents, status, method, created_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw explain(error);
  return data
    ? {
        id: data.id,
        amountCents: data.amount_cents,
        status: data.status as OnlinePaymentStatus,
        method: data.method as OnlinePayment["method"],
        createdAt: data.created_at,
      }
    : null;
}

export type StartedPayment = {
  paymentId: string;
  amountCents: number;
  platformFeeCents: number;
  stripeAccountId: string;
  schoolName: string;
  // Set when a payment page is already open for this family.
  checkoutSessionId: string | null;
};

export async function startOnlinePayment(db: Db, familyId: string): Promise<StartedPayment> {
  const { data, error } = await db.rpc("start_online_payment", { p_family: familyId });
  if (error) throw explain(error);
  const row = data?.[0];
  if (!row) throw new Error("start_online_payment returned nothing");
  return {
    paymentId: row.payment_id,
    amountCents: row.amount_cents,
    platformFeeCents: row.platform_fee_cents,
    stripeAccountId: row.stripe_account_id,
    schoolName: row.school_name,
    checkoutSessionId: row.checkout_session_id,
  };
}
