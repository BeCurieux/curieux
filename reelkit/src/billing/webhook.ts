/**
 * What a Stripe event does to credits. The route has already checked the
 * signature; this checks the event is one of ours and that what was paid is
 * exactly what the pack costs, then adds the credits once.
 */

import type Stripe from "stripe";
import type { Credits } from "./credits.js";
import { packById } from "./packs.js";

export type Outcome = "granted" | "repeat" | "ignored" | "unpaid" | "mismatch";

export async function applyStripeEvent(event: Stripe.Event, credits: Credits): Promise<Outcome> {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return "ignored";
  }
  const s = event.data.object;
  if (s.mode !== "payment") return "ignored";
  // A bank-debit payment completes the session before the money arrives;
  // its credits come with async_payment_succeeded instead.
  if (s.payment_status !== "paid") return "unpaid";

  const user = s.metadata?.user_id ?? s.client_reference_id;
  const pack = packById(s.metadata?.pack);
  if (!user || !pack) return "ignored";
  if (s.amount_total !== pack.cents || s.currency !== pack.currency) {
    // Not what this pack costs: a discount nobody set up, or a session made
    // by something other than our checkout route. No credits; the route logs
    // it for a person to look at. Throwing would only make Stripe resend an
    // event that will never be right.
    return "mismatch";
  }
  const added = await credits.grantPurchase(user, s.id, pack.credits, s.amount_total, s.currency);
  return added ? "granted" : "repeat";
}
