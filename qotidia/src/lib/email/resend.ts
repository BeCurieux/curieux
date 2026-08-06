// Resend.
//
// Chosen because it sends plain mail without insisting on a template
// builder, tracking pixels or click rewriting — all of which would put the
// recipient's behaviour in a third party's hands for no benefit to them.
//
// Nothing here reaches for the archive: it sends exactly the message it is
// handed, and messages.ts is where the rule about what may be in one lives.

import { FROM, type EmailProvider, type OutboundEmail, type SendResult } from "./provider";

const ENDPOINT = "https://api.resend.com/emails";

export class ResendProvider implements EmailProvider {
  readonly name = "resend";

  private key(): string {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    return key;
  }

  async send(message: OutboundEmail): Promise<SendResult> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.key()}`,
      "Content-Type": "application/json",
    };

    const body: Record<string, unknown> = {
      from: `${FROM.name} <${FROM.address}>`,
      to: [message.to.name ? `${message.to.name} <${message.to.email}>` : message.to.email],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    };

    // One-click unsubscribe, so anything non-transactional can be stopped
    // from the mail client without hunting for a link in the footer.
    if (message.unsubscribeUrl) {
      body.headers = {
        "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };
    }

    const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      // The body can echo the recipient address; keep it out of logs.
      throw new Error(`Resend refused the message (${res.status})`);
    }
    const json = (await res.json()) as { id?: string };
    return { id: json.id ?? "unknown", provider: this.name };
  }
}
