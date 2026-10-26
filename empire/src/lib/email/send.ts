import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "@/env";
import { SELLER } from "@/lib/billing/plans";

// Where emails go. Resend in production; outside it, without a key, a local
// outbox file (EMPIRE_DATA_DIR/outbox.jsonl) so development and the browser
// tests can see what would have been sent. Nothing here logs an address or
// the API key.

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers: Record<string, string>;
  /** Same key, same email: Resend sends it once even if we ask twice. */
  idempotencyKey: string;
}

export interface EmailSender {
  readonly name: "resend" | "outbox";
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

export function resendSender(opts: {
  apiKey: string;
  from: string;
  replyTo: string;
  fetchImpl?: typeof fetch;
}): EmailSender {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    name: "resend",
    async send(email) {
      const response = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": email.idempotencyKey,
        },
        body: JSON.stringify({
          from: opts.from,
          to: [email.to],
          reply_to: opts.replyTo,
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: email.headers,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!response.ok || !body.id)
        throw new Error(
          `Resend refused the email (${response.status}): ${body.message ?? "no reason given"}`,
        );
      return { id: body.id };
    },
  };
}

export function outboxSender(file: string): EmailSender {
  return {
    name: "outbox",
    async send(email) {
      await mkdir(path.dirname(file), { recursive: true });
      const id = `outbox-${email.idempotencyKey}`;
      await appendFile(file, `${JSON.stringify({ id, at: new Date().toISOString(), ...email })}\n`);
      return { id };
    },
  };
}

/** The configured sender, or null on Vercel without Resend (nothing is sent). */
export function senderFromEnv(): EmailSender | null {
  const env = serverEnv();
  if (env.RESEND_API_KEY && env.EMAIL_FROM)
    return resendSender({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO ?? SELLER.email,
    });
  // Vercel deployments can't keep a local file, so there's no outbox there.
  if (env.VERCEL_ENV) return null;
  return outboxSender(path.join(env.EMPIRE_DATA_DIR, "outbox.jsonl"));
}
