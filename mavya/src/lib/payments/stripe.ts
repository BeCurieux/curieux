import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/supabase/server-env";

// Ovyko's connection to Stripe (docs/M7_PAYMENTS.md, M7b). Off until
// STRIPE_SECRET_KEY is set. Locally and in CI it talks to Stripe's test
// double (STRIPE_API_URL), never to Stripe.

let cached: Stripe | undefined;

export function paymentsOn(): boolean {
  return Boolean(serverEnv().STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe isn't set up (STRIPE_SECRET_KEY).");
  if (!cached) {
    const mock = env.STRIPE_API_URL ? new URL(env.STRIPE_API_URL) : null;
    cached = new Stripe(env.STRIPE_SECRET_KEY, {
      appInfo: { name: "Ovyko" },
      ...(mock
        ? {
            host: mock.hostname,
            port: Number(mock.port || (mock.protocol === "https:" ? 443 : 80)),
            protocol: mock.protocol.replace(":", "") as "http" | "https",
          }
        : {}),
    });
  }
  return cached;
}

// Stripe's view of a school's account, in the three flags Ovyko keeps.
export const accountFlags = (a: Stripe.Account) => ({
  charges: Boolean(a.charges_enabled),
  payouts: Boolean(a.payouts_enabled),
  details: Boolean(a.details_submitted),
});
