import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountFlags, paymentsOn, stripe } from "./stripe";

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
