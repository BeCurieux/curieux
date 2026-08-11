// Stripe integration (brief §22).
//
// This said "there is no subscription" for a long time, and the reasoning
// was sound: the promise was "you pay for a book, you get a book", and the
// charge had to match the promise exactly. What that got right is the
// danger — a subscription that delivers nothing is precisely what this
// product exists not to be. What it got wrong is that A$199 up front for an
// object arriving in twelve months makes the eleven months in between feel
// like waiting rather than keeping.
//
// So there are now two ways to pay, and they are different products rather
// than two prices for the same one. See lib/billing/plans.ts, which holds
// the three rules that keep the monthly one honest — chiefly that leaving
// never costs a family their memories.
//
// Additional copies (grandparents) are A$79 each and must be ordered in the
// same transaction, because they ride along on one print run.

import Stripe from "stripe";
import { NOTICE_DAYS } from "@/lib/renewal/policy";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { homeUrl } from "@/lib/brand";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/**
 * Cents. Env overrides exist so pricing can move without a deploy.
 *
 * The extra-copy price was A$79, set on the assumption that a second copy in
 * the same print run costs us very little. It does not: print-on-demand
 * hardcover pricing barely scales with quantity — there is no plate, no
 * make-ready and therefore no economy to pass on. The saving on a second
 * copy is the shipping, because today every copy goes to one address.
 *
 * So A$99: a real discount against A$199, honestly grounded in the one cost
 * that genuinely does fall. It is deliberately not lower. A copy sold at
 * A$79 against a print cost that does not scale is a copy sold at a margin
 * thin enough that selling more of them makes the business worse.
 *
 * If copies are ever posted directly to each grandparent — see
 * MAX_EXTRA_COPIES below — this should rise again to cover the second
 * shipment, and would be defensible at A$129 because "printed and posted to
 * them" is a service rather than a duplicate.
 */
export const PRICES = {
  bookAud: () => Number(process.env.BOOK_PRICE_AUD ?? 19900),
  extraCopyAud: () => Number(process.env.EXTRA_COPY_PRICE_AUD ?? 9900),
};

/**
 * Extra copies beyond the first, per transaction.
 *
 * All of them arrive at the buyer's address: print_orders carries one
 * recipient and a copy count, so the parent re-posts to the grandparents
 * themselves. That is stated at checkout rather than discovered on delivery.
 * Shipping each copy to its own address is a schema change (many recipients
 * per order) and the reason the price note above leaves room for it.
 */
export const MAX_EXTRA_COPIES = 4;

/**
 * Paying in instalments.
 *
 * A$199 in one go is the friction at the moment of decision, and the fix is
 * buy-now-pay-later rather than a subscription: the customer pays over
 * several weeks, we are paid in full immediately, and "you pay for a book,
 * you get a book" stays true — which matters, because it is the claim that
 * separates this from Storyworth, Chatbooks and Qeepsake.
 *
 * Comma-separated, because which methods an account may offer depends on
 * what has been enabled in the Stripe Dashboard — naming one that has not
 * been enabled fails the session outright. Left empty, Stripe applies the
 * Dashboard's own settings, which is the safe default.
 */
export const instalmentMethods = (): string[] =>
  (process.env.STRIPE_PAYMENT_METHODS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Whether to tell the customer instalments are available. */
export const instalmentsOffered = (): boolean =>
  instalmentMethods().some((m) => m !== "card");

export function clampExtraCopies(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(v, MAX_EXTRA_COPIES);
}

/** What the customer will be charged, in cents. Used by the UI and the session. */
export function orderTotalAud(extraCopies: number): number {
  return PRICES.bookAud() + clampExtraCopies(extraCopies) * PRICES.extraCopyAud();
}

/**
 * The exact words someone agreed to, stored alongside their consent.
 *
 * Written out in full on the checkout page rather than behind a link, because
 * the whole defence against a dispute a year from now is that they read this.
 */
export const AUTORENEW_TERMS =
  `Each year, around their birthday, we close the year and make the book. ` +
  // "a fortnight later" was the wording here, and it can be read as
  // "A$199 a fortnight" — a recurring charge — which is the one thing this
  // paragraph exists to be unambiguous about. The number of days is taken
  // from NOTICE_DAYS rather than written out, so the promise and the
  // scheduler cannot drift apart.
  `We'll email you when it's ready. ${NOTICE_DAYS} days after that email we ` +
  `charge A$${PRICES.bookAud() / 100} once, and send it to print. You can stop ` +
  `it in one click any time before then, and if there isn't enough in the ` +
  `archive to make a book worth printing, we won't charge you at all.`;

export async function createBookCheckout(opts: {
  bookId: string;
  bookTitle: string;
  customerEmail: string;
  extraCopies: number;
  /**
   * What to charge for the book itself, in cents. Passed in rather than read
   * from PRICES here, because a monthly member may owe part of it or none —
   * and this function used to be the place that silently assumed otherwise.
   */
  bookAmountAud: number;
  stripeCustomerId?: string | null;
  /** Keep the card for next year's book. Only ever set from an explicit tick. */
  saveCardForRenewal?: boolean;
}): Promise<Stripe.Checkout.Session> {
  const appUrl = homeUrl();
  const extras = clampExtraCopies(opts.extraCopies);
  // Only a card can be kept and charged next year. Someone who asks for both
  // instalments and a renewal would otherwise pay by Afterpay, leave no card
  // behind, and have next year's renewal silently do nothing — so asking to
  // renew narrows this purchase to cards.
  const methods = opts.saveCardForRenewal ? ["card"] : instalmentMethods();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "aud",
        unit_amount: opts.bookAmountAud,
        product_data: {
          name: `${opts.bookTitle} — printed hardcover`,
          description: "A4 portrait hardcover, delivered. Includes the digital copy.",
        },
      },
    },
  ];
  if (extras > 0) {
    lineItems.push({
      quantity: extras,
      price_data: {
        currency: "aud",
        unit_amount: PRICES.extraCopyAud(),
        product_data: { name: `${opts.bookTitle} — extra copy` },
      },
    });
  }

  return stripe().checkout.sessions.create(
    {
      mode: "payment",
      ...(opts.stripeCustomerId
        ? { customer: opts.stripeCustomerId }
        : { customer_email: opts.customerEmail }),
      line_items: lineItems,
      // Instalments, where the account offers them. Omitted entirely when
      // unset so Stripe falls back to the Dashboard's configuration.
      ...(methods.length ? { payment_method_types: methods as any } : {}),
      // Keeping the card is a separate decision from this purchase, so it is
      // only ever requested when the customer explicitly asked for it.
      ...(opts.saveCardForRenewal
        ? { payment_intent_data: { setup_future_usage: "off_session" as const } }
        : {}),
      metadata: {
        book_id: opts.bookId,
        kind: "print",
        copies: String(extras + 1),
        autorenew: opts.saveCardForRenewal ? "1" : "0",
      },
      success_url: `${appUrl}/books/${opts.bookId}?paid=1`,
      cancel_url: `${appUrl}/books/${opts.bookId}/checkout?cancelled=1`,
    },
    // Payment idempotency (§26). Keyed on the copy count too, so a customer
    // who backs out and adds a grandparent copy is not handed the old session.
    { idempotencyKey: `checkout-${opts.bookId}-print-${extras}-${opts.saveCardForRenewal ? "r" : "n"}` }
  );
}

export type OffSessionOutcome =
  | { ok: true; paymentIntentId: string }
  | { ok: false; reason: "needs_authentication" | "declined" | "no_card"; message: string };

/**
 * Charge a saved card for next year's book.
 *
 * The interesting case is `needs_authentication`: a card can demand the
 * cardholder be present, and when that happens the answer is to ask them
 * rather than retry — a silent retry loop against a card that wants 3-D
 * Secure is how an account collects declines.
 */
export async function chargeSavedCard(opts: {
  customerId: string;
  paymentMethodId: string;
  amountAud: number;
  description: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}): Promise<OffSessionOutcome> {
  if (!opts.paymentMethodId) {
    return { ok: false, reason: "no_card", message: "no saved card" };
  }
  try {
    const intent = await stripe().paymentIntents.create(
      {
        amount: opts.amountAud,
        currency: "aud",
        customer: opts.customerId,
        payment_method: opts.paymentMethodId,
        off_session: true,
        confirm: true,
        description: opts.description,
        metadata: opts.metadata,
      },
      { idempotencyKey: opts.idempotencyKey }
    );
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    const e = err as Stripe.errors.StripeError;
    const code = (e as any)?.code ?? "";
    if (code === "authentication_required") {
      return {
        ok: false,
        reason: "needs_authentication",
        message: "the bank wants the cardholder present",
      };
    }
    return { ok: false, reason: "declined", message: e.message ?? "card declined" };
  }
}

// ------------------------------------------------------------ membership

/**
 * Start a monthly membership.
 *
 * The price is built inline rather than referencing a Price object created
 * in the Dashboard. One less thing to keep in step across test and live
 * accounts, and it means PLAN_PRICES is the only place the number exists —
 * a Dashboard price that drifts from the number on the pricing page is a
 * discrepancy nobody notices until a customer does.
 */
export async function createMembershipCheckout(opts: {
  familyId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: opts.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: PLAN_PRICES.monthlyAud(),
          recurring: { interval: "month" },
          product_data: {
            name: "Qotidia — keep the year",
            description:
              "The archive open all year, everyone you invite able to add to it, " +
              "and each year's book printed and posted.",
          },
        },
      },
    ],
    // On the subscription itself, not only the session: the session is gone
    // in a day and every later webhook — renewals, failures, cancellation —
    // arrives carrying the subscription.
    subscription_data: { metadata: { family_id: opts.familyId, kind: "membership" } },
    metadata: { family_id: opts.familyId, kind: "membership" },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
}

/**
 * Stop a membership at the end of the period already paid for.
 *
 * `cancel_at_period_end` rather than an immediate cancellation, because they
 * have paid for this month and taking it away the moment they click is
 * both mean and a refund request waiting to happen.
 */
export async function endMembership(subscriptionId: string) {
  return stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

/**
 * Undo a cancellation that has not taken effect yet.
 *
 * Only meaningful between clicking cancel and the period actually ending.
 * Worth having because that window is exactly when someone changes their
 * mind, and the alternative is making them re-subscribe — which loses the
 * months already counted toward this year's book and reads as a punishment
 * for hesitating.
 */
export async function resumeMembership(subscriptionId: string) {
  return stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: false });
}

/** What Stripe currently believes about a subscription. Read, never assumed. */
export async function membershipState(subscriptionId: string) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  return {
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  };
}
