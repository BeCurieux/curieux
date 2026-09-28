import * as Sentry from "@sentry/nextjs";
import { publicEnv } from "@/env";
import { sentryOptions } from "@/lib/observability/sentry-options";

// Runs once when the server starts. Validating the environment here makes a
// misconfigured deployment fail at boot, loudly, instead of on a user's
// first request.
export async function register() {
  const env = publicEnv();
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv } = await import("@/lib/supabase/server-env");
    serverEnv();
  }
  Sentry.init(sentryOptions(env.NEXT_PUBLIC_SENTRY_DSN));
}

export const onRequestError = Sentry.captureRequestError;
