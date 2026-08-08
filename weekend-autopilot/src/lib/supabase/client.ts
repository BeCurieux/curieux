"use client";

/**
 * Browser Supabase client. Anon key only — the service role key must never be
 * reachable from a client bundle (§50).
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function browserClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase browser client is not configured");

  cached = createBrowserClient(url, key);
  return cached;
}
