import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv } from "@/env";

// Two server clients, and the difference matters.
//
// userClient() acts as the signed-in person: every query is subject to row
// level security. Pages and actions use this.
//
// serviceClient() bypasses row level security. Only for work no customer
// does as herself: the Stripe webhook, admin actions, scripts. `server-only`
// makes importing it from browser code a build error.

export async function userClient(): Promise<SupabaseClient> {
  const env = serverEnv();
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
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
    },
  );
}

let service: SupabaseClient | undefined;

export function serviceClient(): SupabaseClient {
  const env = serverEnv();
  if (!env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY is not set");
  service ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return service;
}
