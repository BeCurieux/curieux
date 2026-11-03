import "server-only";
import { cookies, headers } from "next/headers";
import { serverEnv } from "@/env";
import { DEFAULT_NEXT } from "./next-path";
import { NEXT_COOKIE } from "./next-cookie";
import { requestOrigin } from "./origin";
import { userClient } from "@/lib/supabase/server";

// Emails a sign-in link (Supabase Auth, no password). Used by /login and by
// the free sign-ups on /check and /hype. The link lands on /auth/confirm,
// which sends her on to `next` if she opens it in this browser (the cookie
// below), or to /learn if she opens it elsewhere.
export async function sendMagicLink(email: string, next: string): Promise<boolean> {
  const origin = requestOrigin(await headers(), serverEnv().APP_URL);
  const jar = await cookies();
  if (next === DEFAULT_NEXT) jar.delete(NEXT_COOKIE);
  else
    jar.set(NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https:"),
      path: "/",
      maxAge: 60 * 60,
    });

  const supabase = await userClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: true },
  });
  if (error) {
    // Rate limits and the like. Never say whether an account exists.
    console.error("magic link", error.message);
    return false;
  }
  return true;
}
