import { z } from "zod";

// Environment validation, parsed lazily so `next build` works without
// configuration. Every variable is listed in .env.example.
//
// Keys live in .env.local and in Vercel, never in the repository (SPEC.md →
// Build order).

const optional = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Server only. Bypasses row level security: used for the webhook, admin
  // actions and scripts, never for a signed-in customer's own reads.
  SUPABASE_SECRET_KEY: optional,
  APP_URL: z
    .url()
    .default("http://localhost:3300")
    .transform((value) => value.replace(/\/+$/, "")),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues
      .map((issue) => `${issue.path.join(".")} (${issue.message})`)
      .join(", ");
    throw new Error(`Invalid environment variables: ${names}. See .env.example.`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
