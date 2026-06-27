import { createClient } from '@supabase/supabase-js'

// Supabase client, configured from Vite env vars. When they're absent the app
// runs in in-memory "demo mode" (nothing is saved) — so it never breaks if the
// database isn't wired up yet.
//
// Set these in a `.env` file at the repo root (and in your host's env vars):
//   VITE_SUPABASE_URL=https://<your-project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<your anon public key>

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const hasDatabase = !!supabase
