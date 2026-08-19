/**
 * Telling somebody a merchant wrote in.
 *
 * The form has always written a row to `public.early_access` and stopped there.
 * That is a complete record and a useless workflow: a contact form nobody
 * watches loses the merchants it was built to catch, and "check the table when
 * you remember" is not a process. The owner asked for email, and `CLAUDE.md`
 * has Resend recorded against it — a service added on their explicit call
 * rather than assumed.
 *
 * Three decisions, all of them about failure.
 *
 * **A failed notification never fails the request.** By the time this is
 * called the row exists, which means the merchant's message is safe and there
 * is nothing for them to do differently. Turning our missing email into their
 * 503 would tell them to write again when we already have what they sent. So
 * this reports by return value and the caller logs it; it does not throw and
 * the route does not await a decision from it.
 *
 * **No key configured is not an error.** A deployment without `RESEND_API_KEY`
 * — a preview, a local run, the state this project was in for its whole life
 * until now — should record the row and say nothing. `skipped` is a normal
 * outcome, distinguishable from `failed` so a log can tell them apart.
 *
 * **The transport is injected.** Same shape as the Shopify Admin client, for
 * the same reason: every path here is then testable without a network, without
 * a key, and without anybody's inbox receiving a test.
 *
 * What it does not do: retry, queue, or persist a send failure. All three are
 * real, and all three want somewhere shared to keep state — which is a bigger
 * decision than this one. The row is the durable record and it is already
 * written; the email is a convenience over the top of it, and it is worth
 * being clear which of the two is the system of record.
 */

import { INBOX } from "@/lib/origin";
import type { EarlyAccessRecord } from "./types";

/** What Resend's send endpoint needs, and nothing else. */
export interface Mail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

/**
 * Anything that can put a message somewhere. Returns nothing on success and
 * throws on failure, which is what `fetch`-shaped code does anyway.
 */
export type MailTransport = (mail: Mail) => Promise<void>;

export type NotifyOutcome = "sent" | "skipped" | "failed";

export interface NotifyResult {
  outcome: NotifyOutcome;
  /** Present only when `failed`. Safe to log; never carries the key. */
  reason?: string;
}

export interface NotifyOptions {
  transport?: MailTransport | null;
  /** Defaults to `INBOX`. Overridable so a deployment can route elsewhere. */
  to?: string;
  /**
   * The envelope sender. Resend requires a verified domain, so this is
   * configuration rather than a constant — a wrong value here is the single
   * most likely reason a correctly-wired send is rejected.
   */
  from?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * The message, as plain text.
 *
 * Deliberately not HTML. This is one person telling another person that a
 * third person wants a shop; it is read on a phone, forwarded, and replied to.
 * Every field is exactly what the merchant typed, because the point of the
 * email is to carry their words rather than our summary of them.
 *
 * `replyTo` is theirs, so answering is one tap and does not require going and
 * finding the address in a table.
 */
export function composeEarlyAccessMail(record: EarlyAccessRecord, to: string, from: string): Mail {
  const lines = [
    `${record.name} wants a shop.`,
    "",
    `Store:  ${record.store}`,
    `Email:  ${record.email}`,
    "",
    record.brief?.trim() ? record.brief.trim() : "(no brief — they left that blank)",
    "",
    "—",
    "Reply to this and it goes straight to them.",
    "The row is in Supabase under public.early_access either way.",
  ];

  return {
    from,
    to,
    replyTo: record.email,
    // The store, not the name: an inbox sorted by subject is then sorted by
    // the thing you would go looking for.
    subject: `popuup — ${record.store}`,
    text: lines.join("\n"),
  };
}

/** The real transport. Kept separate so nothing else in here touches `fetch`. */
export function resendTransport(apiKey: string): MailTransport {
  return async (mail: Mail): Promise<void> => {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        // The key goes in exactly one place and is never logged, never
        // returned, and never put in an error message. `reason` below carries
        // the status and Resend's own text, both of which are safe.
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        reply_to: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend answered ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
    }
  };
}

/**
 * The transport a deployment gets, or null when it has no key.
 *
 * Null rather than a throwing stub: "not configured" is a state this project
 * spent its whole life in and is still a legitimate one for a preview.
 */
export function transportFromEnv(): MailTransport | null {
  const key = process.env.RESEND_API_KEY;
  return key ? resendTransport(key) : null;
}

export async function notifyEarlyAccess(
  record: EarlyAccessRecord,
  options: NotifyOptions = {},
): Promise<NotifyResult> {
  const transport = options.transport === undefined ? transportFromEnv() : options.transport;
  if (!transport) return { outcome: "skipped" };

  const to = options.to ?? process.env.EARLY_ACCESS_NOTIFY_TO ?? INBOX;
  const from = options.from ?? process.env.EARLY_ACCESS_NOTIFY_FROM ?? `popuup <${INBOX}>`;

  try {
    await transport(composeEarlyAccessMail(record, to, from));
    return { outcome: "sent" };
  } catch (error) {
    return { outcome: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}
