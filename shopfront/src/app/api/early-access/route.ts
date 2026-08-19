/**
 * The contact form's endpoint.
 *
 * The second route in the system that takes input from anybody with a URL, and
 * it behaves the opposite way to the first. `api/events` answers 204 on
 * everything, because a shopper cannot act on a dropped analytics event and a
 * shop that visibly broke over one would be the tail wagging the dog. A
 * merchant whose message vanished *can* act on it — they can write again, or
 * email — so this route tells them the truth: 400 with the field that was
 * wrong, 503 when the write failed, 201 only when a row exists.
 *
 * No rate limiter, and that is a real gap rather than an oversight. The honest
 * answer is that rate limiting in-process is theatre on a platform that runs
 * many instances, and the correct version needs somewhere shared to count —
 * which means a service, which means asking. Until then the mitigations are
 * the size cap below and the fact that the table is service-role only, so the
 * worst case is junk rows in an inbox a human reads, not exposure.
 */

import { NextResponse } from "next/server";
import { EarlyAccessRequest, recordEarlyAccess } from "@/lib/earlyaccess/index";
import { notifyEarlyAccess } from "@/lib/earlyaccess/notify";
import { INBOX } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generous for four fields, small enough not to be a payload. */
const MAX_BYTES = 12_000;

export async function POST(request: Request): Promise<NextResponse> {
  let raw: string;
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BYTES) return bad("That is longer than this form takes.");

    raw = await request.text();
    if (raw.length > MAX_BYTES) return bad("That is longer than this form takes.");
  } catch {
    return bad("We could not read that.");
  }

  let parsed;
  try {
    parsed = EarlyAccessRequest.safeParse(JSON.parse(raw));
  } catch {
    return bad("We could not read that.");
  }

  if (!parsed.success) {
    // The first issue only. A form that lists four problems at once is a form
    // people abandon, and the fields are checked in the order they are read.
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, field: issue?.path[0] ?? null, error: issue?.message ?? "That did not look right." },
      { status: 400 },
    );
  }

  let record;
  try {
    record = await recordEarlyAccess(parsed.data);
  } catch (error) {
    // Logged in full, reported in outline. The person needs to know it failed
    // and what to do instead; a database error message is neither.
    console.error("[early-access] write failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { ok: false, error: `We could not save that. Email ${INBOX} and we will pick it up there.` },
      { status: 503 },
    );
  }

  /*
   * The notification, and why its failure is not the merchant's problem.
   *
   * The row exists by this point. That is the durable record and the reason
   * the form is allowed to say "Got it." — so an email we could not send is a
   * gap in *our* workflow, not in theirs, and there is nothing they could do
   * about it if we told them. Turning it into a 503 would ask somebody to
   * write again when we already have what they sent.
   *
   * Awaited rather than left dangling: this runs on a serverless function, and
   * a promise still in flight when the response returns may simply never be
   * finished. A send takes a few hundred milliseconds on a form somebody has
   * just spent a minute filling in.
   */
  const notified = await notifyEarlyAccess(record);
  if (notified.outcome === "failed") {
    console.error(`[early-access] row saved, notification failed: ${notified.reason}`);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

function bad(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}
