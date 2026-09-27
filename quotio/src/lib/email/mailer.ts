// Sending email (brief §44: optional, and honest about it).
//
// The application depends on this interface and never on a mail vendor. Two
// implementations ship, mirroring lib/ai/provider.ts:
//
//   log      writes the message to the server log and reports it as not sent.
//            What `npm run dev` uses out of the box, so the whole reset flow
//            is walkable with no account anywhere — you read the link off the
//            console.
//   resend   the real one, when RESEND_API_KEY is set.
//
// No SDK. Resend's API is one POST, and a dependency for that is a dependency
// to keep patched forever.
//
// The important rule is §41. `emailEnabled()` exists so the UI can tell the
// truth: a "check your inbox" screen shown by a deployment that cannot send
// email is a lie, and the one place it matters most is the screen someone
// reaches when they are already locked out.

export interface Email {
  to: string;
  subject: string;
  /** Plain text. Every message this product sends is short enough not to need
   *  HTML, and text never renders as a blank box in somebody's client. */
  body: string;
}

export interface SendResult {
  /** True only when a provider accepted it. The log mailer always returns false. */
  sent: boolean;
  /** Plain English, for the server log. Never shown to a visitor. */
  detail?: string;
}

export interface Mailer {
  send(email: Email): Promise<SendResult>;
}

/**
 * Development, and any deployment that hasn't configured mail.
 *
 * Deliberately reports `sent: false`. Returning true would make every caller
 * believe a message went out, and the caller is what decides whether to tell
 * someone to go and check their inbox.
 */
export class LogMailer implements Mailer {
  async send(email: Email): Promise<SendResult> {
    console.info(
      `[email] not sent — no RESEND_API_KEY.\n  to: ${email.to}\n  subject: ${email.subject}\n${email.body}`
    );
    return { sent: false, detail: "no mail provider configured" };
  }
}

/**
 * Where the provider lives.
 *
 * Overridable because a deployment behind an egress proxy has to send through
 * it rather than straight out, and because it is the only way to exercise a
 * successful send without posting real mail at somebody.
 */
export const RESEND_ENDPOINT = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly endpoint: string = RESEND_ENDPOINT
  ) {}

  async send(email: Email): Promise<SendResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [email.to],
          subject: email.subject,
          text: email.body,
        }),
      });

      if (!response.ok) {
        // Logged, not thrown. A failed send must not take down the request
        // that triggered it — a signup should still succeed when the welcome
        // mail bounces off a misconfigured domain.
        const detail = `${response.status} ${await response.text().catch(() => "")}`.trim();
        console.error(`[email] provider rejected the message: ${detail}`);
        return { sent: false, detail };
      }
      return { sent: true };
    } catch (error) {
      console.error("[email] could not reach the provider:", error);
      return { sent: false, detail: String(error) };
    }
  }
}

let cached: Mailer | null = null;

/** Whether this deployment can actually send email (§41). */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function getMailer(): Mailer {
  if (cached) return cached;
  cached = emailEnabled()
    ? new ResendMailer(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM!)
    : new LogMailer();
  return cached;
}

/** Test seam, matching setAIProvider / setStore. */
export function setMailer(mailer: Mailer | null): void {
  cached = mailer;
}
