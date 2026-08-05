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

export function clampExtraCopies(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(v, MAX_EXTRA_COPIES);
}

/** What the customer will be charged, in cents. Used by the UI and the session. */
export function orderTotalAud(extraCopies: number): number {
  return PRICES.bookAud() + clampExtraCopies(extraCopies) * PRICES.extraCopyAud();
}

export async function createBookCheckout(opts: {
  bookId: string;
  bookTitle: string;
  customerEmail: string;
  extraCopies: number;
  stripeCustomerId?: string | null;
}): Promise<Stripe.Checkout.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const extras = clampExtraCopies(opts.extraCopies);

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
      metadata: { book_id: opts.bookId, kind: "print", copies: String(extras + 1) },
      success_url: `${appUrl}/books/${opts.bookId}?paid=1`,
      cancel_url: `${appUrl}/books/${opts.bookId}/checkout?cancelled=1`,
    },
    // Payment idempotency (§26). Keyed on the copy count too, so a customer
    // who backs out and adds a grandparent copy is not handed the old session.
    { idempotencyKey: `checkout-${opts.bookId}-print-${extras}` }
  );
}
