/**
 * The app's configuration, read once from the environment and validated.
 *
 * Missing configuration fails loudly at the first request rather than
 * degrading: an app with no client secret would verify no webhook and no
 * session, and "accept nothing" is correct but indistinguishable from an
 * outage unless it says why.
 */

import { z } from "zod";
import { isPlanHandle, type PlanHandle } from "../shopify/plans.js";
import { parseTokenKey, type TokenKeys } from "./crypto.js";

const Env = z.object({
  SHOPIFY_API_KEY: z.string().min(1, "the app's client ID"),
  SHOPIFY_API_SECRET: z.string().min(1, "the app's client secret"),
  /** The previous secret during a rotation. Both verify for the overlap. */
  SHOPIFY_API_SECRET_PREVIOUS: z.string().optional(),
  /** The `handle` in shopify.app.toml; the plan-selection page is keyed on it. */
  SHOPIFY_APP_HANDLE: z.string().min(1).default("tildie"),
  /** Partner API access for the plan lookup. All three, or the lookup is off. */
  SHOPIFY_PARTNER_ORG_ID: z.string().optional(),
  SHOPIFY_PARTNER_API_TOKEN: z.string().optional(),
  SHOPIFY_APP_GID: z.string().optional(),
  /**
   * Development only: pretend every shop is on this plan instead of asking the
   * Partner API. Refused in production, where it would give every installer a
   * paid plan for free.
   */
  TILDIE_DEV_PLAN: z.string().optional(),
  /** Storage (stage 3). All three, or the app uses memory — refused in production. */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  TILDIE_TOKEN_KEY: z.string().optional(),
  /** The previous token key during a rotation; opens, never seals. */
  TILDIE_TOKEN_KEY_PREVIOUS: z.string().optional(),
  /** Vercel sends it as a bearer token on cron calls; the prune route refuses without it. */
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

export type AppConfig = {
  clientId: string;
  secrets: string[];
  appHandle: string;
  partner: { orgId: string; token: string; appGid: string } | null;
  devPlan: PlanHandle | null;
  storage: { url: string; secretKey: string; tokenKeys: TokenKeys } | null;
  cronSecret: string | null;
  production: boolean;
};

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join(".")} (${i.message})`).join(", ");
    throw new Error(`Tildie's Shopify app is not configured: ${missing}. See SHOPIFY-APP.md.`);
  }
  const e = parsed.data;
  const production = e.NODE_ENV === "production";

  let devPlan: PlanHandle | null = null;
  if (e.TILDIE_DEV_PLAN) {
    if (production) throw new Error("TILDIE_DEV_PLAN is set in production; it would give every shop a free plan.");
    if (!isPlanHandle(e.TILDIE_DEV_PLAN)) throw new Error(`TILDIE_DEV_PLAN must be starter, growth or studio.`);
    devPlan = e.TILDIE_DEV_PLAN;
  }

  const partner =
    e.SHOPIFY_PARTNER_ORG_ID && e.SHOPIFY_PARTNER_API_TOKEN && e.SHOPIFY_APP_GID
      ? { orgId: e.SHOPIFY_PARTNER_ORG_ID, token: e.SHOPIFY_PARTNER_API_TOKEN, appGid: e.SHOPIFY_APP_GID }
      : null;

  const storageVars = [e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, e.TILDIE_TOKEN_KEY];
  if (storageVars.some(Boolean) && !storageVars.every(Boolean)) {
    throw new Error("SUPABASE_URL, SUPABASE_SECRET_KEY and TILDIE_TOKEN_KEY go together; set all three or none.");
  }
  const storage =
    e.SUPABASE_URL && e.SUPABASE_SECRET_KEY && e.TILDIE_TOKEN_KEY
      ? {
          url: e.SUPABASE_URL,
          secretKey: e.SUPABASE_SECRET_KEY,
          tokenKeys: {
            current: parseTokenKey(e.TILDIE_TOKEN_KEY),
            previous: e.TILDIE_TOKEN_KEY_PREVIOUS
              ? parseTokenKey(e.TILDIE_TOKEN_KEY_PREVIOUS, "TILDIE_TOKEN_KEY_PREVIOUS")
              : undefined,
          },
        }
      : null;
  if (production && !storage) {
    throw new Error("Production needs SUPABASE_URL, SUPABASE_SECRET_KEY and TILDIE_TOKEN_KEY; memory storage forgets every merchant.");
  }

  return {
    clientId: e.SHOPIFY_API_KEY,
    secrets: [e.SHOPIFY_API_SECRET, e.SHOPIFY_API_SECRET_PREVIOUS].filter((s): s is string => Boolean(s)),
    appHandle: e.SHOPIFY_APP_HANDLE,
    partner,
    devPlan,
    storage,
    cronSecret: e.CRON_SECRET || null,
    production,
  };
}
