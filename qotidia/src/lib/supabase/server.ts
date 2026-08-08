// Supabase clients for server code.
// - userClient: acts as the signed-in user; RLS enforced. Used by all
//   user-facing server actions and pages.
// - adminClient: service role; bypasses RLS. Used ONLY by background jobs,
//   webhooks and the admin panel. Never expose to request-scoped user code
//   without an explicit ownership check.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEMO_USER, demoClient, isDemoMode } from "./demo";
import { publishableKey, projectUrl, secretKey, whatIsMissing } from "./keys";

const url = () => projectUrl()!;
const anonKey = () => publishableKey()!;

export const ACCESS_COOKIE = "kp-access-token";
export const REFRESH_COOKIE = "kp-refresh-token";

/** RLS-enforced client authenticated as the current user (or anon). */
export function userClient(): SupabaseClient {
  // Demo mode runs the whole interface against an in-memory fixture so the
  // product can be walked end to end without provisioning anything.
  if (isDemoMode()) return demoClient();
  const missing = whatIsMissing();
  if (missing) throw new Error(missing);
  const token = cookies().get(ACCESS_COOKIE)?.value;
  return createClient(url(), anonKey(), {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A client for the calls that happen before there is a user: signing up,
 * signing in, exchanging a token, asking what a session has proved.
 *
 * This existed three times — in actions.ts, in the session route and in the
 * step-up check — each reading `NEXT_PUBLIC_SUPABASE_ANON_KEY` out of the
 * environment directly and asserting it non-null. That is the one key
 * Supabase renamed, so a project set up from today's dashboard, with the
 * publishable key under the name the dashboard gives it, ran perfectly
 * everywhere except sign-in, which failed with `supabaseKey is required`
 * pointing at a line of framework code.
 *
 * keys.ts was written to take either name. Nothing may reach past it.
 */
export function authClient(): SupabaseClient {
  if (isDemoMode()) return demoClient();
  const missing = whatIsMissing();
  if (missing) throw new Error(missing);
  return createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function currentUser() {
  if (isDemoMode()) return DEMO_USER as any;
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const { data, error } = await userClient().auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

/** Service-role client. RLS bypassed — jobs/webhooks/admin only. */
export function adminClient(): SupabaseClient {
  if (isDemoMode()) return demoClient();
  // Named rather than asserted: a missing key here produced a fetch to
  // "undefined/auth/v1/token", which names neither the setting nor the file
  // it belongs in — and whoever hits it is setting the product up for the
  // first time, which is the worst moment to be handed that.
  const missing = whatIsMissing();
  if (missing) throw new Error(missing);
  return createClient(url(), secretKey()!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin() {
  const user = await requireUser();
  if (isDemoMode()) return user;
  const { data } = await adminClient()
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!data?.is_admin) throw new Error("not authorised");
  return user;
}
