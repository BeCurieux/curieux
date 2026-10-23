import "server-only";
import { serverEnv } from "@/env";

// The Launch Pack is only offered for sale once its Gumroad product is
// connected (both the checkout link and the id used to verify licence keys).
// Until then every page says it isn't on sale yet, instead of showing a buy
// button that leads nowhere.
export function launchPackOnSale(): boolean {
  const env = serverEnv();
  return Boolean(env.GUMROAD_PRODUCT_URL && env.GUMROAD_PRODUCT_ID);
}
