/**
 * NotificationProvider abstraction (§23).
 *
 * Email is the only channel at launch, and deliberately so: the behaviour we
 * are trying to establish is Thursday email → open plan → do it → Sunday
 * feedback, and nothing about that requires an app to be installed. The
 * interface exists so that push and SMS are additive later rather than a
 * rewrite of every call site.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Deduplication key so a retried job cannot send twice (§40). */
  idempotencyKey: string;
  /** One-click unsubscribe, required by bulk senders and by decency. */
  unsubscribeUrl?: string;
  replyTo?: string;
}

export interface SendResult {
  ok: boolean;
  providerId: string | null;
  error: string | null;
}

export interface NotificationProvider {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<SendResult>;
}
