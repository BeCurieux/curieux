"use server";

import { z } from "zod";
import { safeNext } from "@/lib/auth/next-path";
import { sendMagicLink } from "@/lib/auth/magic-link";

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
  if (!(await sendMagicLink(email, safeNext(form.get("next")))))
    return {
      status: "error",
      message: "We couldn't send a link just now. Wait a minute and try again.",
    };
  return { status: "sent", email };
}
