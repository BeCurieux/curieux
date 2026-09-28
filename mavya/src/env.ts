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
  NEXT_PUBLIC_POSTHOG_HOST: z
    .string()
    .optional()
    .transform((value) => value || "https://eu.i.posthog.com"),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
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
