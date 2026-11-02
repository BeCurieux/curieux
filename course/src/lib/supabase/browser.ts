"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// The browser client, for client components that need the signed-in
// person's own rows (calculator autosave, mark-complete). It carries her
// session cookie and is bound by row level security like userClient().
//
// It is never the only check: every gated page and route verifies access on
// the server (SPEC.md → Non-negotiables).

let client: SupabaseClient | undefined;

export function browserClient(): SupabaseClient {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}
