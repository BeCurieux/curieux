import "server-only";
import { serverEnv, sessionSecret } from "@/env";
import { systemRepo } from "@/lib/data";
import { GumroadProvider } from "./gumroad";
import type { BillingDeps } from "./service";

export function billingDeps(): BillingDeps {
  const env = serverEnv();
  return {
    repo: systemRepo(),
    provider: new GumroadProvider({
      launchPackProductId: env.GUMROAD_PRODUCT_ID ?? null,
      accessToken: env.GUMROAD_ACCESS_TOKEN ?? null,
    }),
    secret: sessionSecret(),
  };
}
