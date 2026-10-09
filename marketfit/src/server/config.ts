/**
 * The app's configuration, read once from the environment and validated.
 * Missing configuration fails loudly at the first request rather than
 * degrading into "accept nothing", which is indistinguishable from an outage.
 */

import { z } from "zod";
import { parseTokenKey, type TokenKeys } from "./crypto.js";

const Env = z.object({
  SHOPIFY_API_KEY: z.string().min(1, "the app's client ID"),
  SHOPIFY_API_SECRET: z.string().min(1, "the app's client secret"),
  /** The previous secret during a rotation. Both verify for the overlap. */
  SHOPIFY_API_SECRET_PREVIOUS: z.string().optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  MARKETFIT_TOKEN_KEY: z.string().optional(),
  MARKETFIT_TOKEN_KEY_PREVIOUS: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

export type AppConfig = {
  clientId: string;
  secrets: string[];
  storage: { url: string; secretKey: string; tokenKeys: TokenKeys } | null;
  production: boolean;
};

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join(".")} (${i.message})`).join(", ");
    throw new Error(`MarketFit is not configured: ${missing}. See marketfit/README.md.`);
  }
  const e = parsed.data;
  const production = e.NODE_ENV === "production";

  const storageVars = [e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, e.MARKETFIT_TOKEN_KEY];
  if (storageVars.some(Boolean) && !storageVars.every(Boolean)) {
    throw new Error("SUPABASE_URL, SUPABASE_SECRET_KEY and MARKETFIT_TOKEN_KEY go together; set all three or none.");
  }
  const storage =
    e.SUPABASE_URL && e.SUPABASE_SECRET_KEY && e.MARKETFIT_TOKEN_KEY
      ? {
          url: e.SUPABASE_URL,
          secretKey: e.SUPABASE_SECRET_KEY,
          tokenKeys: {
            current: parseTokenKey(e.MARKETFIT_TOKEN_KEY),
            previous: e.MARKETFIT_TOKEN_KEY_PREVIOUS
              ? parseTokenKey(e.MARKETFIT_TOKEN_KEY_PREVIOUS, "MARKETFIT_TOKEN_KEY_PREVIOUS")
              : undefined,
          },
        }
      : null;
  if (production && !storage) {
    throw new Error("Production needs SUPABASE_URL, SUPABASE_SECRET_KEY and MARKETFIT_TOKEN_KEY; memory storage forgets every merchant.");
  }

  return {
    clientId: e.SHOPIFY_API_KEY,
    secrets: [e.SHOPIFY_API_SECRET, e.SHOPIFY_API_SECRET_PREVIOUS].filter((s): s is string => Boolean(s)),
    storage,
    production,
  };
}
