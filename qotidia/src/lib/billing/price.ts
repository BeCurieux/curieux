// What this family pays for this book, right now.
//
// One implementation, three callers: the checkout page (what it shows), the
// checkout action (what it charges) and the annual renewal (what it takes
// from a saved card). They were two implementations and one omission, which
// is the shape this kind of bug always has.
//
// The omission was the expensive one. A monthly member who had paid eight
// months and clicked "Order their book" was charged the full A$199 on top of
// their subscription — the renewal path knew about plans and the manual
// checkout did not. Nothing errored. They would have found out on their
// statement.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_PRICES, bookIncluded, bookPriceAfterCancelling } from "./plans";

export interface BookPrice {
  /** Cents. Zero means the membership already covers it. */
  amountAud: number;
  plan: "one_off" | "monthly";
  monthsPaidThisYear: number;
  /** Cents already credited against the full price. Zero for one-off. */
  creditAud: number;
  /**
   * Why it costs what it costs, in the words the customer sees.
   *
   * Carried with the number rather than written at each call site: a price
   * shown without its reason invites "why is this A$47?", and the answer
   * must be the same on the page, in the receipt and in a support reply.
   */
  explanation: string | null;
}

/**
 * The price of this family's next book.
 *
 * Falls back to the one-off price for anything it cannot establish. A family
 * whose plan cannot be read is charged the ordinary price rather than
 * nothing — the failure mode of guessing "free" is a book printed and posted
 * that nobody paid for.
 */
export async function bookPriceFor(
  db: SupabaseClient,
  familyId: string
): Promise<BookPrice> {
  const full = PLAN_PRICES.oneOffAud();

  const { data: family } = await db
    .from("families")
    .select("plan, months_paid_this_year")
    .eq("id", familyId)
    .maybeSingle();

  const months = family?.months_paid_this_year ?? 0;

  if (family?.plan !== "monthly") {
    return {
      amountAud: full,
      plan: "one_off",
      monthsPaidThisYear: 0,
      creditAud: 0,
      explanation: null,
    };
  }

  if (bookIncluded(months)) {
    return {
      amountAud: 0,
      plan: "monthly",
      monthsPaidThisYear: months,
      creditAud: full,
      explanation: "Included in your membership — there's nothing to pay for this one.",
    };
  }

  const amount = bookPriceAfterCancelling(months);
  return {
    amountAud: amount,
    plan: "monthly",
    monthsPaidThisYear: months,
    creditAud: full - amount,
    explanation:
      `You've been a member for ${months === 1 ? "a month" : `${months} months`}, ` +
      `so A$${(full - amount) / 100} of what you've already paid comes off this book.`,
  };
}
