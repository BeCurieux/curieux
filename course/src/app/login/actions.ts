"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/env";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/next-path";
import { NEXT_COOKIE } from "@/lib/auth/next-cookie";
import { requestOrigin } from "@/lib/auth/origin";
import { userClient } from "@/lib/supabase/server";

export interface LoginState {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
}

const emailSchema = z.email("That doesn't look like an email address.").max(200);

export async function requestMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(
    String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const email = parsed.data;
  const next = safeNext(form.get("next"));
  const origin = requestOrigin(await headers(), serverEnv().APP_URL);

  // The link lands on /auth/confirm, which reads this to send her on to the
  // page she wanted. If she opens the email in another browser the cookie
  // isn't there and she lands on /learn, which is fine.
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
    console.error("login", error.message);
    return {
      status: "error",
      message: "We couldn't send a link just now. Wait a minute and try again.",
    };
  }
  return { status: "sent", email };
}
