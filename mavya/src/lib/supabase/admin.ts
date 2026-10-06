import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/env";
import type { Database } from "./database.types";
import { serverEnv } from "./server-env";

// Bypasses row level security. Only for trusted server-side code that checks
// permissions itself. At runtime it is used only for sign-in throttling
// (src/lib/auth/throttle.ts), which runs before anyone is signed in, the
// email sender, and Stripe payments (src/lib/payments), each after checking
// who is asking or that the message really came from Stripe; and "Try it
// yourself" (src/lib/site/try-demo.ts), which makes a throwaway sign-in and
// pretend school that the database limits per visitor.
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
