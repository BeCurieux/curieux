import "server-only";
import { serverEnv } from "@/env";

// Hands a rendered email to Resend (HTTP API, no SDK needed). Without a key,
// outside production, it logs instead, so development works with no account.

export interface Outgoing {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend refuses a second send with the same key for 24 hours. */
  idempotencyKey: string;
  headers?: Record<string, string>;
}

export function emailConfigured(): boolean {
  return Boolean(serverEnv().RESEND_API_KEY);
}

export async function deliver(email: Outgoing): Promise<{ id: string }> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    if (process.env.VERCEL_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.info(`[email not sent: no RESEND_API_KEY] to ${email.to}: ${email.subject}`);
    return { id: "not-sent" };
  }
  if (!env.EMAIL_FROM) throw new Error("EMAIL_FROM is not set");
  const response = await fetch(`${env.RESEND_API_BASE ?? "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
      ...(email.headers ? { headers: email.headers } : {}),
    }),
  });
  if (!response.ok)
    throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as { id: string };
}
