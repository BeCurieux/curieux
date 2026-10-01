import "server-only";
import { parseServerEnv, type ServerEnv } from "@/env";

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAILPIT_URL: process.env.MAILPIT_URL,
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  return cached;
}
