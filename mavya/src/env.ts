import { z } from "zod";

// Environment validation.
//
// Parsing is lazy so `next build` succeeds without any configuration; the
// server checks everything once at startup (see instrumentation.ts), so a
// misconfigured deployment fails on boot with a clear message rather than on
// a user's first request.
//
// Browser code can only see NEXT_PUBLIC_ values Next inlines at build time,
// and it only inlines them when they are written out literally, which is
// why each one is listed by name below instead of passing process.env.

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  // No default: PostHog has no Australian region, so where analytics goes
  // is a deliberate choice. Without both a key and a host, it stays off.
  NEXT_PUBLIC_POSTHOG_HOST: optionalString,
});

const serverSchema = z
  .object({
    SUPABASE_SECRET_KEY: z.string().min(1),
    // Email (M6c). "off" sends nothing; "mailpit" is the local test mailbox;
    // "resend" is the real service.
    EMAIL_TRANSPORT: z
      .enum(["off", "mailpit", "resend"])
      .optional()
      .transform((value) => value ?? "off"),
    EMAIL_FROM: optionalString,
    RESEND_API_KEY: optionalString,
    MAILPIT_URL: optionalString,
    // The address links in emails point to, e.g. https://app.ovyko.com.au.
    APP_URL: z
      .string()
      .optional()
      .transform((value) => (value ? value.replace(/\/+$/, "") : undefined))
      .pipe(z.url().optional()),
    // Shared with the database's schedule, which calls the email sender.
    CRON_SECRET: z
      .string()
      .optional()
      .transform((value) => (value ? value : undefined))
      .pipe(z.string().min(32).optional()),
    // Card payments (M7b). Off unless set. The secret key starts sk_test_
    // or sk_live_; the webhook secret (whsec_) checks Stripe's messages.
    STRIPE_SECRET_KEY: optionalString.pipe(
      z
        .string()
        .regex(/^[sr]k_(test|live)_/)
        .optional(),
    ),
    STRIPE_WEBHOOK_SECRET: optionalString.pipe(z.string().startsWith("whsec_").optional()),
    // Local and CI only: Stripe's test double (stripe-mock), e.g.
    // http://localhost:12111. Never set in a deployed environment.
    STRIPE_API_URL: optionalString.pipe(z.url().optional()),
  })
  .superRefine((env, ctx) => {
    const need = (key: keyof typeof env) => {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required" });
    };
    if (env.EMAIL_TRANSPORT !== "off") {
      need("EMAIL_FROM");
      need("APP_URL");
      need("CRON_SECRET");
    }
    if (env.EMAIL_TRANSPORT === "resend") need("RESEND_API_KEY");
    if (env.EMAIL_TRANSPORT === "mailpit") need("MAILPIT_URL");
    if (env.STRIPE_SECRET_KEY) need("APP_URL");
  });

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicSchema.safeParse(source);
  if (!result.success) throw new Error(describe("public", result.error));
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) throw new Error(describe("server", result.error));
  return result.data;
}

function describe(kind: string, error: z.ZodError): string {
  const names = error.issues.map((issue) => issue.path.join(".")).join(", ");
  return `Invalid ${kind} environment variables: ${names}. See .env.example.`;
}

let cachedPublic: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  cachedPublic ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  return cachedPublic;
}
