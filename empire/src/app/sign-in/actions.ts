"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appUrl, serverEnv, sessionSecret } from "@/env";
import { afterSignIn } from "@/lib/auth/after-sign-in";
import { LOCAL_SESSION_COOKIE, createLocalSession } from "@/lib/auth/local-session";
import { NEXT_COOKIE, safeNext } from "@/lib/auth/next-path";
import { requestOrigin } from "@/lib/auth/origin";
import { localStore } from "@/lib/data";
import { userClient } from "@/lib/supabase/clients";

export interface SignInState {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
}

const emailSchema = z.email("That doesn't look like an email address.").max(200);

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = emailSchema.safeParse(
    String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const email = parsed.data;
  const next = safeNext(form.get("next"));

  if (serverEnv().EMPIRE_BACKEND === "local") {
    // Local backend: no email is sent. Fine for development and tests only;
    // env.ts refuses this backend in production.
    const user = await localStore().upsertUser(email);
    const session = createLocalSession(user, sessionSecret());
    (await cookies()).set(LOCAL_SESSION_COOKIE, session.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && appUrl().startsWith("https:"),
      path: "/",
      maxAge: session.maxAge,
    });
    await afterSignIn(user);
    redirect(next);
  }

  // The emailed link comes back to /auth/callback, which reads this to send
  // her on to the page she wanted. A cookie rather than a query string, so
  // the callback URL stays exactly the one on Supabase's allow-list.
  const jar = await cookies();
  if (next === "/studio") jar.delete(NEXT_COOKIE);
  else
    jar.set(NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl().startsWith("https:"),
      path: "/",
      maxAge: 60 * 60,
    });
  const supabase = await userClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${requestOrigin(await headers(), appUrl())}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    // Rate limits and the like. Don't reveal whether the account exists.
    console.error("sign-in", error.message);
    return {
      status: "error",
      message: "We couldn't send a link just now. Wait a minute and try again.",
    };
  }
  return { status: "sent", email };
}
