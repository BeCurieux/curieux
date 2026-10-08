/**
 * Every environment variable the app reads, in one place.
 *
 * Locally nothing is required: without Supabase there are no accounts and
 * ads are free; without ANTHROPIC_API_KEY they come from templates. In
 * production, AI drafting is only switched on together with accounts, because
 * an AI endpoint with no sign-in in front of it is an open tab on our
 * Anthropic bill.
 */

import { randomBytes } from "node:crypto";
import type { SupabaseEnv } from "./supabase.js";

let devSecret: string | undefined;

export type Config = {
  production: boolean;
  anthropicKey?: string;
  etsyKey?: string;
  imageSecret: string;
  /** All three Supabase values, or none: accounts are on or off as a whole. */
  supabase?: SupabaseEnv;
  stripe?: { secretKey: string; webhookSecret: string };
  /** Where Stripe sends buyers back to. Defaults to the request's origin. */
  appUrl?: string;
};

const val = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

export function config(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production" && Boolean(env.VERCEL);
  let imageSecret = val(env.IMAGE_PROXY_SECRET);
  if (!imageSecret) {
    if (production) throw new Error("IMAGE_PROXY_SECRET must be set in production (any long random string).");
    imageSecret = devSecret ??= randomBytes(32).toString("hex");
  }

  const url = val(env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = val(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const secretKey = val(env.SUPABASE_SECRET_KEY);
  const someSupabase = url || publishableKey || secretKey;
  if (someSupabase && !(url && publishableKey && secretKey)) {
    throw new Error(
      "Supabase is half set up: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY are needed together.",
    );
  }

  const stripeKey = val(env.STRIPE_SECRET_KEY);
  const webhookSecret = val(env.STRIPE_WEBHOOK_SECRET);
  if ((stripeKey || webhookSecret) && !(stripeKey && webhookSecret)) {
    throw new Error("Stripe is half set up: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are needed together.");
  }

  return {
    production,
    ...(val(env.ANTHROPIC_API_KEY) ? { anthropicKey: val(env.ANTHROPIC_API_KEY)! } : {}),
    ...(val(env.ETSY_API_KEY) ? { etsyKey: val(env.ETSY_API_KEY)! } : {}),
    imageSecret,
    ...(url && publishableKey && secretKey ? { supabase: { url, publishableKey, secretKey } } : {}),
    ...(stripeKey && webhookSecret ? { stripe: { secretKey: stripeKey, webhookSecret } } : {}),
    ...(val(env.APP_URL) ? { appUrl: val(env.APP_URL)!.replace(/\/$/, "") } : {}),
  };
}
