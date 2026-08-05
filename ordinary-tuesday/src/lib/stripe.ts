// Stripe integration (brief §22).
// MVP: one-off payments — digital book creation, then physical upgrade.
// Customer ids are stored on profiles so subscriptions can be added later
// without restructuring.

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

export const PRICES = {
  digitalAud: () => Number(process.env.BOOK_PRICE_DIGITAL_AUD ?? 4900),
  printAud: () => Number(process.env.BOOK_PRICE_PRINT_AUD ?? 12900),
};

export type PurchaseKind = "digital" | "print";

export async function createBookCheckout(opts: {
  kind: PurchaseKind;
  bookId: string;
  bookTitle: string;
  customerEmail: string;
  stripeCustomerId?: string | null;
}): Promise<Stripe.Checkout.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const amount = opts.kind === "digital" ? PRICES.digitalAud() : PRICES.printAud();
  return stripe().checkout.sessions.create(
    {
      mode: "payment",
      ...(opts.stripeCustomerId
        ? { customer: opts.stripeCustomerId }
        : { customer_email: opts.customerEmail }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: amount,
            product_data: {
              name:
                opts.kind === "digital"
                  ? `${opts.bookTitle} — digital book`
                  : `${opts.bookTitle} — printed hardcover`,
            },
          },
        },
      ],
      metadata: { book_id: opts.bookId, kind: opts.kind },
      success_url: `${appUrl}/books/${opts.bookId}?paid=1`,
      cancel_url: `${appUrl}/books/${opts.bookId}/checkout?cancelled=1`,
    },
    // Payment idempotency (§26): one checkout per book+kind attempt window.
    { idempotencyKey: `checkout-${opts.bookId}-${opts.kind}` }
  );
}
