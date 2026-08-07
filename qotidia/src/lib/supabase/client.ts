// Browser Supabase client (publishable key, RLS enforced).
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectUrl, publishableKey } from "./keys";

let client: SupabaseClient | null = null;

export function browserClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      projectUrl()!,
      publishableKey()!
    );
  }
  return client;
}
