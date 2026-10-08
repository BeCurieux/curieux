/**
 * The only file that talks to Supabase: who is signed in, and the credit
 * functions in Postgres. Everything above it takes these as injected
 * dependencies.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Credits } from "../billing/credits.js";

export type SupabaseEnv = { url: string; publishableKey: string; secretKey: string };
export type Viewer = { id: string; email?: string };

/** A client acting as whoever's session cookie came with this request. In a
 *  route handler it can also set cookies, which is how signing in and out
 *  land in the browser. */
export async function sessionClient(env: SupabaseEnv) {
  const store = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Read-only context. The proxy refreshes the session on every request.
        }
      },
    },
  });
}

export async function viewer(env: SupabaseEnv): Promise<Viewer | null> {
  const supabase = await sessionClient(env);
  // getUser() asks Supabase Auth to validate the token, rather than trusting
  // whatever the cookie claims.
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, ...(data.user.email ? { email: data.user.email } : {}) } : null;
}

/** The secret-key client. Bypasses row-level security; only ever used after
 *  the server has checked who is asking, or that Stripe signed the message. */
export function adminClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function supabaseCredits(db: SupabaseClient): Credits {
  const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  };
  return {
    async balance(user) {
      const { data, error } = await db.from("accounts").select("credits").eq("user_id", user).maybeSingle();
      if (error) throw new Error(`balance: ${error.message}`);
      return (data as { credits: number } | null)?.credits ?? 0;
    },
    spend: (user, ref) => rpc<number | null>("spend_credit", { p_user: user, p_ref: ref }),
    refund: (user, ref) => rpc<number | null>("refund_credit", { p_user: user, p_ref: ref }),
    grantPurchase: (user, session, credits, amountCents, currency) =>
      rpc<boolean>("grant_purchase", {
        p_user: user,
        p_session: session,
        p_credits: credits,
        p_amount_cents: amountCents,
        p_currency: currency,
      }),
  };
}
