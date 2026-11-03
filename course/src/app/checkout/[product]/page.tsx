import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/calc/format";
import { myCurrency } from "@/lib/calc/runs";
import { requireUser } from "@/lib/auth/session";
import { loadProducts, ownedBy } from "@/lib/commerce/orders";
import { checkoutPlan, REFUND_DAYS } from "@/lib/commerce/plan";
import { userClient } from "@/lib/supabase/server";
import { startCheckout } from "./actions";
import { CheckoutButton } from "./checkout-button";

type Params = Promise<{ product: string }>;

export const metadata: Metadata = { title: "Checkout" };

// What she's about to pay, in her currency, before Stripe opens. The same
// plan is worked out again on the server when she presses the button.
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { product: slug } = await params;
  const { cancelled } = await searchParams;
  const user = await requireUser(`/checkout/${slug}`);
  const supabase = await userClient();
  const [products, owned, currency] = await Promise.all([
    loadProducts(),
    ownedBy(user.id),
    myCurrency(supabase),
  ]);
  const plan = checkoutPlan(slug, products, owned, currency);
  const money = (cents: number) => formatMoney(cents / 100, currency);

  return (
    <main id="main" className="mx-auto w-full max-w-md px-5 py-10">
      <p className="text-mute">
        <Link href="/learn">Your course</Link>
      </p>
      <h1 className="mt-3 text-4xl">Checkout</h1>
      {cancelled ? (
        <p className="border-line bg-paper mt-4 rounded-xl border p-4" role="status">
          No payment was taken. You can try again whenever you're ready.
        </p>
      ) : null}

      {!plan.ok ? (
        <div
          className="border-line bg-paper mt-8 rounded-2xl border p-6"
          data-testid="checkout-refused"
        >
          <p className="text-lg">{plan.reason}</p>
          <p className="mt-4">
            <Link href="/learn">Back to your course</Link>
          </p>
        </div>
      ) : (
        <>
          <dl
            className="divide-line border-line bg-paper mt-8 divide-y rounded-2xl border"
            data-testid="checkout-summary"
          >
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="font-semibold">{plan.product.name}</dt>
              <dd>{money(plan.amountCents)}</dd>
            </div>
            {plan.credit ? (
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt>{plan.credit.reason}</dt>
                <dd>−{money(plan.credit.amountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 px-4 py-3 text-lg font-semibold">
              <dt>You pay</dt>
              <dd>{money(plan.amountCents - (plan.credit?.amountCents ?? 0))}</dd>
            </div>
          </dl>
          {plan.bump ? (
            <p className="mt-4">
              You can add the benchmark pack for {money(plan.bump.amountCents)} on the next page.
            </p>
          ) : null}
          {plan.placesLeft !== null ? (
            <p className="mt-4">
              {plan.placesLeft} of {plan.product.places_total} founding places left.
            </p>
          ) : null}
          <p className="text-mute mt-4">
            Prices in {currency === "AUD" ? "Australian" : "US"} dollars. Not right for you? Refund
            it yourself from your account within {REFUND_DAYS} days, no reason needed.
          </p>
          <CheckoutButton
            action={startCheckout.bind(null, plan.product.slug)}
            label="Continue to secure payment"
          />
        </>
      )}
    </main>
  );
}
