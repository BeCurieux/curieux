/**
 * Notification provider selection and the send-once wrapper.
 */

import { Resend } from "resend";
import { serverEnv } from "@/config/env";
import { EMAIL_FROM, SUPPORT_EMAIL } from "@/config/brand";
import type { EmailMessage, NotificationProvider, SendResult } from "./provider";

class ResendNotificationProvider implements NotificationProvider {
  readonly name = "resend";
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo ?? SUPPORT_EMAIL,
        headers: message.unsubscribeUrl
          ? {
              "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              // Resend deduplicates on this, so a retried job is safe.
              "Idempotency-Key": message.idempotencyKey,
            }
          : { "Idempotency-Key": message.idempotencyKey },
      });

      if (error) return { ok: false, providerId: null, error: error.message };
      return { ok: true, providerId: data?.id ?? null, error: null };
    } catch (err) {
      return {
        ok: false,
        providerId: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/** Development and CI: records what would have been sent. */
export class MockNotificationProvider implements NotificationProvider {
  readonly name = "mock";
  public readonly sent: EmailMessage[] = [];

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    this.sent.push(message);
    return { ok: true, providerId: `mock_${this.sent.length}`, error: null };
  }
}

export function buildNotificationProvider(): NotificationProvider {
  const env = serverEnv();
  if (env.NOTIFICATIONS_PROVIDER === "resend" && env.RESEND_API_KEY) {
    return new ResendNotificationProvider(env.RESEND_API_KEY);
  }
  return new MockNotificationProvider();
}

export type { EmailMessage, NotificationProvider, SendResult } from "./provider";
