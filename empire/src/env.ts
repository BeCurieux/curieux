import { z } from "zod";

// Environment validation.
//
// Parsing is lazy so `next build` succeeds without configuration. Every
// variable is documented in docs/ENVIRONMENT.md and .env.example.
//
// Two backends:
//   local    — data in a JSON file under EMPIRE_DATA_DIR, sign-in by email
//              alone. For development, tests and demos. Refuses to run in a
//              Vercel production deployment.
//   supabase — Postgres with row level security, passwordless email sign-in.

const optional = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const serverSchema = z
  .object({
    EMPIRE_BACKEND: z.enum(["local", "supabase"]).default("local"),
    EMPIRE_DATA_DIR: z.string().default(".data/local"),
    EMPIRE_SESSION_SECRET: optional.pipe(z.string().min(32).optional()),
    VERCEL_ENV: optional,

    NEXT_PUBLIC_SUPABASE_URL: optional.pipe(z.url().optional()),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional,
    SUPABASE_SECRET_KEY: optional,

    APP_URL: optional
      .transform((value) => (value ? value.replace(/\/+$/, "") : undefined))
      .pipe(z.url().optional()),

    EMPIRE_AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
    ANTHROPIC_API_KEY: optional,
    EMPIRE_AI_MODEL: z.string().default("claude-opus-5-5"),
    EMPIRE_AI_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
    EMPIRE_AI_TIMEOUT_MS: z.coerce.number().int().min(10_000).max(300_000).default(120_000),
    // Hard stop for the whole platform per rolling 24 hours, in US dollars.
    EMPIRE_AI_DAILY_BUDGET_USD: z.coerce.number().min(0).default(25),

    GUMROAD_PRODUCT_ID: optional,
    GUMROAD_PRODUCT_URL: optional.pipe(z.url().optional()),
    GUMROAD_PING_SECRET: optional.pipe(z.string().min(24).optional()),
    // Optional seller token: lets us look sales up by id or email, which also
    // finds older purchases of products that never issued licence keys.
    GUMROAD_ACCESS_TOKEN: optional,
    CRON_SECRET: optional.pipe(z.string().min(24).optional()),

    ADMIN_EMAILS: optional,
  })
  .superRefine((env, ctx) => {
    const need = (key: keyof typeof env, why: string) => {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: why });
    };
    if (env.EMPIRE_BACKEND === "supabase") {
      need("NEXT_PUBLIC_SUPABASE_URL", "required for the supabase backend");
      need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "required for the supabase backend");
      need("SUPABASE_SECRET_KEY", "required for the supabase backend");
      need("APP_URL", "sign-in links point here");
    }
    if (env.EMPIRE_BACKEND === "local" && env.VERCEL_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["EMPIRE_BACKEND"],
        message: "the local backend has no real sign-in and must not serve production",
      });
    }
    if (env.EMPIRE_AI_PROVIDER === "anthropic") need("ANTHROPIC_API_KEY", "required for EMPIRE_AI_PROVIDER=anthropic");
    if (env.GUMROAD_PRODUCT_URL) {
      need("GUMROAD_PRODUCT_ID", "needed to verify Gumroad purchases");
      need("GUMROAD_PING_SECRET", "needed to accept Gumroad pings");
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues
      .map((issue) => `${issue.path.join(".")} (${issue.message})`)
      .join(", ");
    throw new Error(`Invalid environment variables: ${names}. See docs/ENVIRONMENT.md.`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Test seam: forget the parsed environment so the next call re-reads it. */
export function resetServerEnv(): void {
  cached = undefined;
}

// The local backend signs its session cookie with this. A fixed development
// value is fine there because the local backend never runs in production.
export function sessionSecret(): string {
  return serverEnv().EMPIRE_SESSION_SECRET ?? "local-development-secret-not-for-production-use";
}

export function appUrl(): string {
  return serverEnv().APP_URL ?? "http://localhost:3000";
}

export function isAdminEmail(email: string): boolean {
  const list = (serverEnv().ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
