import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv } from "@/env";

// Two clients, and the difference matters.
//
// userClient() acts as the signed-in customer: every query is subject to row
// level security. Product code uses this.
//
// adminClient() bypasses row level security. It is used only by the
// privileged repo (src/lib/data/supabase.ts → SupabaseSystemRepo) for
// payments, the usage ledger, analytics, and writing model generations after
// the server has checked ownership. `server-only` makes any browser import
// a build error.

export async function userClient(): Promise<SupabaseClient> {
  const env = serverEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the proxy refreshes sessions.
        }
      },
    },
  });
}

let admin: SupabaseClient | undefined;

export function adminClient(): SupabaseClient {
  const env = serverEnv();
  admin ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}
