import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Failed sign-in limits (docs/SECURITY.md, M2.5). Sign-in runs on the server,
// so Supabase Auth's own per-address limit sees the server, not the person.
// The database counts failures per email and per client address instead.
// Only the server can call these functions; browsers can't reach them.

async function clientAddress(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || "";
}

export async function signInAllowed(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("sign_in_allowed", {
    p_email: email,
    p_ip: await clientAddress(),
  });
  if (error) throw error;
  return data;
}

export async function recordSignIn(email: string, succeeded: boolean): Promise<void> {
  const { error } = await createAdminClient().rpc("record_sign_in", {
    p_email: email,
    p_ip: await clientAddress(),
    p_succeeded: succeeded,
  });
  if (error) throw error;
}
