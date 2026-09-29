"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LAST_SEEN_COOKIE, lastSeenCookie } from "@/lib/auth/idle";
import { recordSignIn, signInAllowed } from "@/lib/auth/throttle";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error?: string; email?: string };

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Enter your email and password.", email };
  }

  // Checked before the password, and the same whether or not the email has
  // an account.
  if (!(await signInAllowed(parsed.data.email))) {
    return {
      error: "Too many attempts. Wait 15 minutes, then try again.",
      email,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  await recordSignIn(parsed.data.email, !error);
  if (error) {
    // Same message for an unknown email and a wrong password, so the form
    // can't be used to find out who has an account.
    return { error: "That email and password don't match. Try again.", email };
  }

  // A fresh session starts un-idle, whatever an earlier one left behind.
  (await cookies()).set(LAST_SEEN_COOKIE, String(Date.now()), lastSeenCookie);
  redirect("/");
}
