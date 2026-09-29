import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { USERS } from "../../scripts/fixtures";

// These tests go through the public API with the publishable key, exactly as
// a browser would. Nothing here uses the secret key: a test that did would
// bypass row level security and prove nothing.

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Start Supabase (npm run db:start), run scripts/local-env.sh, then npm run db:reset.`,
    );
  }
  return value;
}

export const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
export const PUBLISHABLE_KEY = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const PASSWORD = env("SEED_PASSWORD");

export type Client = SupabaseClient<Database>;
export type SeededUser = keyof typeof USERS;

function newClient(): Client {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonymous(): Client {
  return newClient();
}

export type Session = { client: Client; accessToken: string };

export async function signInAs(user: SeededUser): Promise<Session> {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: USERS[user].email,
    password: PASSWORD,
  });
  if (error || !data.session) throw new Error(`sign in as ${String(user)}: ${error?.message}`);
  return { client, accessToken: data.session.access_token };
}

// A hand-built request to the REST API, the way someone poking at the API
// with a stolen-but-valid token of their own would do it.
export async function rawRest(path: string, accessToken?: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

export const TABLES = [
  "users",
  "organisations",
  "staff_memberships",
  "families",
  "family_members",
  "children",
  "locations",
  "programs",
  "levels",
  "classes",
  "class_occurrences",
  "enrolments",
  "audit_events",
] as const;
