import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { recordCheckoutSession } from "@/lib/commerce/orders";

export const metadata: Metadata = { title: "Thank you" };

// Where Stripe sends her after paying. Records the purchase straight from
// Stripe (the same idempotent step as the webhook), so her access is there
// now rather than whenever the webhook lands.
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await requireUser("/learn");
  const { session_id: sessionId } = await searchParams;

  let outcome: Awaited<ReturnType<typeof recordCheckoutSession>> | null = null;
  if (sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      outcome = await recordCheckoutSession(sessionId);
    } catch (error) {
      console.error("checkout success", error instanceof Error ? error.message : error);
    }
  }
  const mine = outcome !== null && outcome.status !== "unpaid" && outcome.userId === user.id;
  const soldOut = mine && outcome?.status === "sold_out";

  return (
    <main id="main" className="mx-auto w-full max-w-md px-5 py-10">
      {soldOut ? (
        <>
          <h1 className="text-4xl">Sorry, the last place just went</h1>
          <p className="mt-4 text-lg">
            The founding cohort filled while you were paying. We've refunded you in full; it reaches
            your card in a few days.
          </p>
        </>
      ) : mine ? (
        <>
          <h1 className="text-4xl">You're in</h1>
          <p className="mt-4 text-lg" data-testid="purchase-confirmed">
            Payment received. Everything you bought is open now.
          </p>
          <p className="mt-8">
            <Link
              href="/learn"
              className="bg-accent text-on-accent inline-block rounded-full px-6 py-4 text-lg font-semibold no-underline"
            >
              Go to your course
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="text-4xl">Thank you</h1>
          <p className="mt-4 text-lg">
            If you've just paid, your access will appear in a minute.{" "}
            <Link href="/account">Check your account</Link>.
          </p>
        </>
      )}
    </main>
  );
}
