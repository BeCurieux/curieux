// Provider-agnostic email adapter (brief §3).
//
// One rule governs everything in this directory, and it is a privacy rule
// rather than a design one: **an email never carries the archive**. No
// photographs, no quotes, no memory text, no generated prose. Email passes
// through a third party, sits unencrypted in an inbox, and is forwarded and
// searched and breached. The archive is private by default and stays behind
// a login.
//
// So an email may say: whose archive it is, that something is waiting, how
// many things, and a link. It may not say what they are. That constraint is
// enforced in email/messages.ts, where the bodies are built, and tested.

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface OutboundEmail {
  to: EmailAddress;
  subject: string;
  /** Plain text. Always present — some people read mail as text. */
  text: string;
  /** Optional simple HTML. No tracking pixels, no remote images. */
  html?: string;
  /** Where a reply should go, if not the sending address. */
  replyTo?: string;
  /**
   * Set on anything that is not strictly transactional, so the provider and
   * the recipient's client both honour one-click unsubscribe.
   */
  unsubscribeUrl?: string;
}

export interface SendResult {
  id: string;
  provider: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: OutboundEmail): Promise<SendResult>;
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const name = process.env.EMAIL_PROVIDER ?? "mock";
  if (name === "resend") {
    const { ResendProvider } = require("./resend") as typeof import("./resend");
    cached = new ResendProvider();
  } else {
    const { MockEmailProvider } = require("./mock") as typeof import("./mock");
    cached = new MockEmailProvider();
  }
  return cached;
}

/** Test seam. */
export function setEmailProvider(provider: EmailProvider | null): void {
  cached = provider;
}

export const FROM = {
  address: process.env.EMAIL_FROM ?? "hello@qotidia.com",
  name: "Qotidia",
};
