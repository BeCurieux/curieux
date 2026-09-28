import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/env";
import type { Database } from "./database.types";
import { serverEnv } from "./server-env";

// Bypasses row level security. Only for trusted server-side domain services
// that check permissions themselves. Nothing in M0 needs it at runtime; it
// exists so later milestones have one audited place to reach for it, and
// `server-only` makes any import from browser code a build error.
export function createAdminClient() {
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
