// Sending.
//
// Everything goes through sendOnce(). It is the single place that decides
// whether a message is actually delivered, and it enforces four things in
// order, because each is a way this product could become something people
// mute:
//
//   1. The message carries no archive content.       (privacy)
//   2. The recipient has not switched this kind off. (consent)
//   3. This exact message has not already been sent. (no duplicates)
//   4. A failure to send never fails the caller.     (a book must still
//      ship if the mail provider is down)

import type { SupabaseClient } from "@supabase/supabase-js";
import { containsArchiveContent } from "./messages";
import { getEmailProvider, type OutboundEmail } from "./provider";

export type EmailKind =
  | "invitation"
  | "contributions_waiting"
  | "book_ready"
  | "order_placed"
  | "order_shipped"
  | "year_closing";

/** Kinds a person may switch off. Anything else was asked for by paying. */
const OPTIONAL: Record<EmailKind, string | null> = {
  invitation: null,
  book_ready: null,
  order_placed: null,
  order_shipped: null,
  contributions_waiting: "contributions_waiting",
  year_closing: "year_closing",
};

export const isTransactional = (kind: EmailKind) => OPTIONAL[kind] === null;

export interface SendOnceInput {
  kind: EmailKind;
  message: OutboundEmail;
  /** One send per logical event; a retried job must not send twice. */
  dedupeKey: string;
  userId?: string | null;
  subjectId?: string | null;
}

export type SendOutcome =
  | { sent: true; id: string }
  | { sent: false; reason: "duplicate" | "opted_out" | "failed" | "unsafe" };

export async function sendOnce(
  db: SupabaseClient,
  input: SendOnceInput
): Promise<SendOutcome> {
  // 1. Privacy. A message that leaks the archive is never sent, and the
  //    failure is loud in the log rather than silent, because it is a bug.
  if (containsArchiveContent(input.message)) {
    console.error(`email ${input.kind} blocked: appears to contain archive content`);
    return { sent: false, reason: "unsafe" };
  }

  // 2. Consent.
  const optional = OPTIONAL[input.kind];
  if (optional && input.userId) {
    const { data: prefs } = await db
      .from("email_preferences")
      .select(`${optional}, opt_out_token`)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (prefs && (prefs as any)[optional] === false) {
      return { sent: false, reason: "opted_out" };
    }
  }

  // 3. Duplicates. Claim the key first: if the insert is refused, another
  //    run has already sent this and we must not send it again.
  const { error: claimErr } = await db.from("email_deliveries").insert({
    kind: input.kind,
    user_id: input.userId ?? null,
    email: input.message.to.email,
    subject_id: input.subjectId ?? null,
    dedupe_key: input.dedupeKey,
  });
  if (claimErr) return { sent: false, reason: "duplicate" };

  // 4. Send. A mail failure must not take down the job that asked for it —
  //    a book still ships if the provider is having a bad afternoon.
  try {
    const provider = getEmailProvider();
    const result = await provider.send(input.message);
    await db
      .from("email_deliveries")
      .update({ provider: result.provider, provider_id: result.id })
      .eq("dedupe_key", input.dedupeKey);
    return { sent: true, id: result.id };
  } catch (err) {
    // Release the claim so a later attempt can try again.
    await db.from("email_deliveries").delete().eq("dedupe_key", input.dedupeKey);
    console.error(`email ${input.kind} failed to send:`, (err as Error).message);
    return { sent: false, reason: "failed" };
  }
}

/** A person's opt-out token, created on first use. */
export async function optOutToken(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db
    .from("email_preferences")
    .select("opt_out_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.opt_out_token) return data.opt_out_token;

  const { data: created } = await db
    .from("email_preferences")
    .insert({ user_id: userId })
    .select("opt_out_token")
    .single();
  return created?.opt_out_token ?? "";
}

/**
 * A day-stamped key, so a stream of contributions becomes one message a day
 * rather than one per photograph. The date is passed in rather than read
 * from the clock, so the batching window is testable.
 */
export function dailyKey(kind: EmailKind, scopeId: string, day: Date): string {
  return `${kind}-${scopeId}-${day.toISOString().slice(0, 10)}`;
}
