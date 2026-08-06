// Mail arriving.
//
// The door that works on every phone ever made and requires installing
// nothing: forward a photograph to the child's private address and it is
// kept. It is also the only endpoint in the product that accepts content
// from people who are not signed in, so almost all of this file is about
// deciding whether to believe what turned up.
//
// Three gates, in order, and each one is capable of ending the request.
//
// **Is this our provider?** A shared secret, compared in constant time. An
// endpoint that parses attacker-supplied multipart before authenticating it
// is an endpoint that can be attacked by anyone who finds the URL.
//
// **Which child?** The token in the To address, compared in constant time
// against the stored one. A wrong token is a 200 and nothing else — telling
// a stranger that an address exists is telling them to keep guessing.
//
// **Who sent it?** Family addresses land straight in. Everyone else either
// goes to the review queue a parent already has, or is refused, depending on
// a setting that defaults to closed. The privacy brief's rule was to invite
// people individually rather than generate something anyone can post to,
// and an address that accepts anything from anyone is that with extra steps.

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/server";
import { tokenFrom, tokenMatches } from "@/lib/inbox/address";
import { receive, type IncomingFile } from "@/lib/inbox/receive";
import { normaliseAddress, verdictForSender } from "@/lib/inbox/triage";
import { trimQuoted } from "@/lib/inbox/mail";

export const dynamic = "force-dynamic";

/** How much of one message we will take. Beyond this it is not a memory. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Always 200, whatever happened.
 *
 * Two unrelated reasons that happen to agree. Mail providers retry on a
 * non-2xx, so a message we have decided not to accept would be redelivered
 * for hours. And the response is the only signal a prober gets: if "unknown
 * address" and "wrong sender" and "accepted" all look identical, there is
 * nothing to learn by trying.
 */
const done = () => NextResponse.json({ ok: true });

function secretMatches(presented: string | null): boolean {
  const expected = process.env.INBOX_WEBHOOK_SECRET ?? "";
  // Unset means the door is bolted, not open. A deployment that forgot to
  // configure this should reject mail rather than accept anyone's.
  if (!expected || !presented) return false;
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-inbox-secret"))) {
    // The one case that is not a 200: an unauthenticated caller has not
    // delivered mail, and should not be told this endpoint does anything.
    return NextResponse.json({ error: "no" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return done();

  const to = String((body as any).to ?? "");
  const from = String((body as any).from ?? "");
  const subject = String((body as any).subject ?? "").slice(0, 500);
  const text = String((body as any).text ?? "").slice(0, 8000);

  const token = tokenFrom(to);
  if (!token) return done();

  const db = adminClient();

  // Fetched by prefix rather than by equality so the comparison itself can
  // be constant time. An indexed lookup on the token would be fast, and
  // "fast" is the leak.
  const { data: inboxes } = await db
    .from("subject_inboxes")
    .select("subject_id, token, accept_from_anyone")
    .limit(2000);

  const inbox = ((inboxes ?? []) as any[]).find((row) => tokenMatches(token, row.token));
  if (!inbox) return done();

  // Who is allowed to write here, and as whom. A mail from Grandpa becomes a
  // memory created by Grandpa's account, so the moderation rules that
  // already exist apply unchanged — a contributor's mail waits for a parent
  // exactly as a contributor's upload does.
  const { familyId, members: family } = await familyFor(db, inbox.subject_id);
  if (!familyId) return done();
  const addresses = family.map((m) => m.email).filter(Boolean) as string[];

  const verdict = verdictForSender(from, {
    familyAddresses: addresses,
    acceptFromAnyone: inbox.accept_from_anyone,
  });
  if (verdict === "refuse") return done();

  const senderAddress = normaliseAddress(from);
  const sender = family.find((m) => normaliseAddress(m.email ?? "") === senderAddress);
  // An accepted stranger is recorded as having been sent by the archive's
  // owner, because a memory has to belong to an account and there isn't one
  // for them. It waits in the review queue either way.
  const createdBy = sender?.userId ?? family[0]?.userId;
  if (!createdBy) return done();

  const files: IncomingFile[] = [];
  let total = 0;
  for (const a of ((body as any).attachments ?? []) as any[]) {
    if (typeof a?.content !== "string") continue;
    const bytes = Buffer.from(a.content, "base64");
    total += bytes.length;
    if (bytes.length === 0 || total > MAX_BYTES) continue;
    files.push({
      bytes,
      mimeType: String(a.contentType ?? "application/octet-stream"),
      filename: String(a.name ?? "attachment"),
    });
  }

  await receive(db, {
    subjectId: inbox.subject_id,
    familyId,
    createdBy,
    via: "email",
    note: subject,
    // A mail signature is not a memory. Everything below the first quoted
    // line or "--" goes, which is crude and right: what survives is what the
    // person actually typed today.
    text: trimQuoted(text),
    files,
    status: verdict === "review" ? "pending" : undefined,
  });

  return done();
}

/** Members of the family this subject belongs to, with their addresses. */
async function familyFor(db: ReturnType<typeof adminClient>, subjectId: string) {
  const { data: subject } = await db
    .from("subjects")
    .select("family_id")
    .eq("id", subjectId)
    .single();
  if (!subject) return { familyId: null, members: [] };

  const { data: rows } = await db
    .from("family_memberships")
    .select("user_id, role, profiles(email)")
    .eq("family_id", subject.family_id);

  return {
    familyId: subject.family_id as string,
    members: ((rows ?? []) as any[]).map((r) => ({
      userId: r.user_id as string,
      role: r.role as string,
      email: (r.profiles?.email ?? null) as string | null,
    })),
  };
}
