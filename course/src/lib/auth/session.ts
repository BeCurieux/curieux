import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase/server";

// The server-side check every signed-in page makes. The proxy also bounces
// signed-out visitors, but that is a convenience: this is the boundary.

export async function currentUser(): Promise<User | null> {
  const supabase = await userClient();
  // getUser() validates the token with Supabase Auth; getSession() would
  // trust whatever the cookie says.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(next: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Whether the signed-in person is in the admins table (RLS lets her see her own row). */
export async function isAdmin(): Promise<boolean> {
  const supabase = await userClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("is_admin", error.message);
    return false;
  }
  return data === true;
}
