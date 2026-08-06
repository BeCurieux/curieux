// The share sheet.
//
// A phone's share sheet posts here. There is no form, no confirmation and no
// screen in between, because the whole value of this door is that it is two
// taps from a photograph to a kept memory — and every question asked in the
// middle is a reason not to bother next time.
//
// Which means the awkward case has to be handled without a question. A
// family with two children shares a photograph and we cannot know whose it
// is. Rather than stop and ask, it lands with the child whose archive was
// added to most recently, unfiled, carrying that as the open question. The
// memory is kept either way; the one thing we could not tell is the one
// thing the inbox says out loud.

import { NextRequest, NextResponse } from "next/server";
import { currentUser, userClient } from "@/lib/supabase/server";
import { roleForSubject } from "@/lib/family/membership";
import { canEdit } from "@/lib/family/roles";
import { receive, type IncomingFile } from "@/lib/inbox/receive";

/** A share is bytes over the wire; nothing here can be prerendered. */
export const dynamic = "force-dynamic";

/**
 * The most reasonable guess at whose this is.
 *
 * Most recent activity rather than alphabetical or oldest: the child being
 * photographed this month is overwhelmingly the child a photograph shared
 * this afternoon belongs to.
 */
async function likeliestSubject(db: ReturnType<typeof userClient>, userId: string) {
  const { data: subjects } = await db
    .from("subjects")
    .select("id, display_name, family_id")
    .order("created_at", { ascending: false });

  const editable: { id: string; display_name: string; family_id: string }[] = [];
  for (const s of (subjects ?? []) as any[]) {
    const membership = await roleForSubject(db, s.id, userId);
    if (membership && canEdit(membership.role)) editable.push(s);
  }
  if (editable.length === 0) return { subject: null, ambiguous: false, others: [] };

  // Which archive was added to most recently. Two plain reads rather than a
  // join with an ordering on the embedded table: the shape is easier to
  // follow, and it is one guess on a page that must not stop to ask.
  const { data: newest } = await db
    .from("memories")
    .select("id")
    .eq("family_id", editable[0].family_id)
    .order("created_at", { ascending: false })
    .limit(1);

  const newestId = ((newest ?? []) as any[])[0]?.id;
  const { data: recent } = newestId
    ? await db.from("memory_subjects").select("subject_id").eq("memory_id", newestId)
    : { data: [] };

  const lastTouched = ((recent ?? []) as any[])[0]?.subject_id;
  const chosen = editable.find((s) => s.id === lastTouched) ?? editable[0];

  return {
    subject: chosen,
    ambiguous: editable.length > 1,
    others: editable.filter((s) => s.id !== chosen.id),
  };
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  // A share from a signed-out phone: send them to sign in rather than
  // dropping the photograph. They arrived here holding something.
  if (!user) return NextResponse.redirect(new URL("/login?from=share", req.url), 303);

  const form = await req.formData();
  const db = userClient();

  const { subject, ambiguous } = await likeliestSubject(db, user.id);
  if (!subject) return NextResponse.redirect(new URL("/home", req.url), 303);

  const files: IncomingFile[] = [];
  for (const entry of form.getAll("files")) {
    if (typeof entry === "string" || !entry) continue;
    const bytes = Buffer.from(await entry.arrayBuffer());
    if (bytes.length === 0) continue;
    files.push({
      bytes,
      mimeType: entry.type || "application/octet-stream",
      filename: entry.name || "shared",
    });
  }

  // A shared link arrives as `url`, sometimes with the page title as `text`.
  // Both are words somebody chose to send, so both are kept as words.
  const text = [form.get("text"), form.get("url")]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join("\n") || null;
  const title = typeof form.get("title") === "string" ? String(form.get("title")) : null;

  if (files.length === 0 && !text && !title) {
    return NextResponse.redirect(new URL(`/subjects/${subject.id}`, req.url), 303);
  }

  const received = await receive(db, {
    subjectId: subject.id,
    familyId: subject.family_id,
    createdBy: user.id,
    via: "share",
    note: title,
    text: text ?? title,
    files,
    guessedSubject: ambiguous,
  });

  // Straight to the archive when there was nothing to ask, which is the
  // common case and the one worth optimising: the parent sees the thing they
  // just shared, already kept, and carries on with their afternoon.
  const landing =
    received.unfiled > 0 || ambiguous
      ? `/subjects/${subject.id}/inbox`
      : `/subjects/${subject.id}`;

  return NextResponse.redirect(new URL(landing, req.url), 303);
}
