import "server-only";
import { serverEnv } from "@/lib/supabase/server-env";
import type { Email } from "./messages";

// Hands one email to the email service. "resend" in production; "mailpit"
// is the local test mailbox; "off" sends nothing (and says so).

export class EmailOff extends Error {
  constructor() {
    super("Email isn't set up.");
    this.name = "EmailOff";
  }
}

export function emailOn(): boolean {
  return serverEnv().EMAIL_TRANSPORT !== "off";
}

// Returns the email service's id for the message.
export async function sendEmail(to: string, email: Email): Promise<string> {
  const env = serverEnv();
  if (env.EMAIL_TRANSPORT === "off") throw new EmailOff();

  if (env.EMAIL_TRANSPORT === "mailpit") {
    const [, name, address] = /^(.*)<(.+)>$/.exec(env.EMAIL_FROM!) ?? [null, "", env.EMAIL_FROM!];
    const response = await fetch(`${env.MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: address!.trim(), Name: name!.trim() },
        To: [{ Email: to }],
        Subject: email.subject,
        Text: email.text,
        HTML: email.html,
      }),
    });
    if (!response.ok) throw new Error(`Mailpit refused the email (${response.status}).`);
    return ((await response.json()) as { ID: string }).ID;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}).`);
  return ((await response.json()) as { id: string }).id;
}

export function appUrl(path: string): string {
  return `${serverEnv().APP_URL ?? ""}${path}`;
}
