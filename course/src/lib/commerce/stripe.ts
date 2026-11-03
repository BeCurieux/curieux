import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/env";

// The Stripe client. Test-mode keys in development and previews, live keys
// in production (README → Deploy). STRIPE_API_BASE points it at the test
// suite's stand-in server instead of api.stripe.com.

let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) return (client = null);
  const base = env.STRIPE_API_BASE ? new URL(env.STRIPE_API_BASE) : null;
  client = new Stripe(env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    ...(base
      ? {
          host: base.hostname,
          port: base.port || (base.protocol === "https:" ? 443 : 80),
          protocol: base.protocol === "https:" ? "https" : "http",
        }
      : {}),
  });
  return client;
}
