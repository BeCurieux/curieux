import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { serverEnv, sessionSecret } from "@/env";
import { localStore } from "@/lib/data";
import { userClient } from "@/lib/supabase/clients";
import { LOCAL_SESSION_COOKIE, readLocalSession } from "./local-session";

export interface SessionUser {
  id: string;
  email: string;
}

/** The signed-in customer, or null. Cached per request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  if (serverEnv().EMPIRE_BACKEND === "local") {
    const jar = await cookies();
    const session = readLocalSession(jar.get(LOCAL_SESSION_COOKIE)?.value, sessionSecret());
    if (!session) return null;
    // A deleted account's cookie must not keep working.
    const user = await localStore().getUser(session.id);
    return user ? { id: user.id, email: user.email } : null;
  }
  const supabase = await userClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return { id: user.id, email: user.email };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}
