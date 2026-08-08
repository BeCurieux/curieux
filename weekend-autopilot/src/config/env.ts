/**
 * Environment access, validated once, server-side only.
 *
 * Two rules this file exists to enforce:
 *  1. No secret is ever read outside a server module (§50: nothing sensitive
 *     in the browser bundle). Only NEXT_PUBLIC_* values appear in `publicEnv`.
 *  2. A missing secret fails loudly at the point of use rather than producing
 *     a mysterious 500 three layers down.
 */

import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

/** Values safe to reference from client components. */
export const publicEnv = {
  productName: process.env.NEXT_PUBLIC_PRODUCT_NAME,
  productTagline: process.env.NEXT_PUBLIC_PRODUCT_TAGLINE,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY,
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
} as const;

const serverSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PILOT: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),

  AI_PROVIDER: z.string().default("mock"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-sonnet-5"),

  PLACES_PROVIDER: z.string().default("mock"),
  PLACES_API_KEY: z.string().optional(),

  ROUTES_PROVIDER: z.string().default("mock"),
  ROUTES_API_KEY: z.string().optional(),

  WEATHER_PROVIDER: z.string().default("open-meteo"),
  WEATHER_API_KEY: z.string().optional(),

  NOTIFICATIONS_PROVIDER: z.string().default("mock"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  POSTHOG_KEY: z.string().optional(),

  CRON_SECRET: z.string().optional(),
  SUPPORTED_MARKET: z.string().default("sydney"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests that mutate process.env between cases. */
export function resetEnvCache(): void {
  cached = null;
}

/**
 * Fetch a required secret. Throws a message naming the variable, because the
 * most common production incident in a product like this is a missing key.
 */
export function requireEnv(name: keyof ServerEnv): string {
  const value = serverEnv()[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function envFlag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return bool.parse(raw);
}
