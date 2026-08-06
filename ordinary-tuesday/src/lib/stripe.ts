// Stripe integration (brief §22).
//
// One price, one transaction: A$199 buys the printed hardcover, and the
// digital copy comes with it. There is no digital-only tier and no
// subscription — the promise on the landing page is "you pay for a book, you
// get a book", and the charge has to match the promise exactly. Additional
// copies (grandparents) are A$79 each and must be ordered in the same
// transaction, because they ride along on one print run.
//
// Customer ids are stored on profiles so subscriptions could be added later
// without restructuring.

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/** Cents. Env overrides exist so pricing can move without a deploy. */
export const PRICES = {
  bookAud: () => Number(process.env.BOOK_PRICE_AUD ?? 19900),
  extraCopyAud: () => Number(process.env.EXTRA_COPY_PRICE_AUD ?? 7900),
};

/** Extra copies beyond the first, per transaction. */
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
  `We'll email you when it's ready, then charge A$${PRICES.bookAud() / 100} a fortnight ` +
  `later and send it to print. You can stop it in one click any time before ` +
  `that, and if there isn't enough in the archive to make a book worth ` +
  `printing, we won't charge you at all.`;

export async function createBookCheckout(opts: {
  bookId: string;
  bookTitle: string;
  customerEmail: string;
  extraCopies: number;
  stripeCustomerId?: string | null;
  /** Keep the card for next year's book. Only ever set from an explicit tick. */
  saveCardForRenewal?: boolean;
}): Promise<Stripe.Checkout.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
        unit_amount: PRICES.bookAud(),
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
