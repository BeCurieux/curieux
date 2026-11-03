"use server";

import { redirect } from "next/navigation";
import { emailSecret } from "@/lib/email/send";
import { suppress } from "@/lib/email/suppress";
import { decodeEmail, verifyUnsubscribe } from "@/lib/email/unsubscribe";

export async function confirmUnsubscribe(form: FormData): Promise<void> {
  const e = String(form.get("e") ?? "");
  const t = String(form.get("t") ?? "");
  const email = decodeEmail(e);
  if (!email || !verifyUnsubscribe(email, t, emailSecret())) redirect("/unsubscribe?status=bad");
  redirect(
    (await suppress(email))
      ? "/unsubscribe?status=done"
      : `/unsubscribe?e=${e}&t=${t}&status=failed`,
  );
}
