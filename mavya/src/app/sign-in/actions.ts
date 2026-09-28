"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for an unknown email and a wrong password, so the form
    // can't be used to find out who has an account.
    return { error: "That email and password don't match. Try again.", email };
  }

  redirect("/");
}
