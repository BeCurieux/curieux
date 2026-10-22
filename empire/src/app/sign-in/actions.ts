"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appUrl, serverEnv, sessionSecret } from "@/env";
import { afterSignIn } from "@/lib/auth/after-sign-in";
import { LOCAL_SESSION_COOKIE, createLocalSession } from "@/lib/auth/local-session";
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
    redirect("/studio");
  }

  const supabase = await userClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${appUrl()}/auth/callback`, shouldCreateUser: true },
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
