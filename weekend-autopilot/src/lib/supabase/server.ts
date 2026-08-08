/**
 * Supabase clients, server side.
 *
 * Three distinct clients, and using the wrong one is a security bug:
 *
 *   userClient()    — respects RLS, acts as the signed-in customer.
 *                     Use this for anything reached from a request.
 *   serviceClient() — bypasses RLS. Jobs, webhooks and admin only. Never
 *                     constructed in response to unvalidated user input.
 *   anonClient()    — unauthenticated, for public reads (waitlist insert).
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv, publicEnv } from "@/config/env";

function url(): string {
  const value = publicEnv.supabaseUrl;
  if (!value) throw new Error("Missing SUPABASE_URL");
  return value;
}

function anonKey(): string {
  const value = publicEnv.supabaseAnonKey;
  if (!value) throw new Error("Missing SUPABASE_ANON_KEY");
  return value;
}

/** RLS-respecting client bound to the request's session cookie. */
export function userClient(): SupabaseClient {
  const store = cookies();
  return createServerClient(url(), anonKey(), {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          store.set({ name, value, ...options });
        } catch {
          // Server components cannot set cookies; the middleware refreshes the
          // session instead. Swallowing here keeps reads working in RSC.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          store.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // As above.
        }
      },
    },
  });
}

/**
 * Full-privilege client. Bypasses RLS entirely, so every call site must have
 * already established what the caller is allowed to touch.
 */
export function serviceClient(): SupabaseClient {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Unauthenticated client for genuinely public writes. */
export function anonClient(): SupabaseClient {
  return createClient(url(), anonKey(), { auth: { persistSession: false } });
}

/**
 * The signed-in user, or null.
 *
 * Fails closed: if the session cannot be verified — Supabase unreachable, keys
 * missing, token malformed — the answer is "not signed in", not an exception.
 * A transient auth outage should send someone to the login page, not to a
 * stack trace, and treating "cannot verify" as "unauthenticated" is also the
 * only safe direction to be wrong in.
 */
export async function currentUser() {
  try {
    const { data } = await userClient().auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user, or throw. For routes that have already been guarded. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  try {
    const { data } = await userClient()
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    return Boolean(data?.is_admin);
  } catch {
    // Same principle: an unanswerable question about privilege is a "no".
    return false;
  }
}
