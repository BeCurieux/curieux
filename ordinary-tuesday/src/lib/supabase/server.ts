// Supabase clients for server code.
// - userClient: acts as the signed-in user; RLS enforced. Used by all
//   user-facing server actions and pages.
// - adminClient: service role; bypasses RLS. Used ONLY by background jobs,
//   webhooks and the admin panel. Never expose to request-scoped user code
//   without an explicit ownership check.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEMO_USER, demoClient, isDemoMode } from "./demo";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const ACCESS_COOKIE = "kp-access-token";
export const REFRESH_COOKIE = "kp-refresh-token";

/** RLS-enforced client authenticated as the current user (or anon). */
export function userClient(): SupabaseClient {
  // Demo mode runs the whole interface against an in-memory fixture so the
  // product can be walked end to end without provisioning anything.
  if (isDemoMode()) return demoClient();
  const token = cookies().get(ACCESS_COOKIE)?.value;
  return createClient(url(), anonKey(), {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
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
  return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
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
