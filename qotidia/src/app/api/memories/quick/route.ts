// Quick-add endpoint.
//
// The quick-add sheet posts here rather than using a server action, so the
// field keeps focus and the page does not navigate — someone standing in a
// kitchen adding three things in a row should not be bounced to the top of
// a re-rendered page between each one.
//
// It does nothing the server action doesn't: same membership check, same
// moderation rule, same visibility rule. This is a transport, not a
// shortcut around the rules.

import { NextRequest, NextResponse } from "next/server";
import { currentUser, adminClient, userClient } from "@/lib/supabase/server";
import { roleForSubject } from "@/lib/family/membership";
import { statusForNewMemory } from "@/lib/family/roles";
import { enqueue } from "@/lib/jobs/queue";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const form = await req.formData();
  const subjectId = String(form.get("subject_id") ?? "");
  const type = String(form.get("type")) === "quote" ? "quote" : "text";
  const text = String(form.get("text") ?? "").trim();
  if (!subjectId || !text) {
    return NextResponse.json({ error: "nothing to keep" }, { status: 400 });
  }

  const db = userClient();
  const membership = await roleForSubject(db, subjectId, user.id);
  if (!membership) return NextResponse.json({ error: "not your family" }, { status: 403 });

  const { data: memory, error } = await db
    .from("memories")
    .insert({
      subject_id: subjectId,
      created_by: user.id,
      type,
      raw_text: text.slice(0, 4000),
      memory_date: new Date().toISOString().slice(0, 10),
      contribution_status: statusForNewMemory(membership.role),
      visibility: form.get("private") === "on" ? "private" : "family",
    })
    .select("id")
    .single();

  // Checking `error` alone is not enough: an insert can succeed while the
  // returned row comes back empty, and reading .id off null is a 500 rather
  // than the honest 400 the caller can act on.
  if (error || !memory) {
    return NextResponse.json(
      { error: error?.message ?? "could not keep that" },
      { status: 400 }
    );
  }

  // Same hourly batching as the other capture paths, so three things added
  // in a row produce one analysis job rather than three.
  const window = Math.floor(Date.now() / (60 * 60 * 1000));
  await enqueue(adminClient(), "analyse_memories", { subject_id: subjectId }, `analyse-${subjectId}-${window}`);

  return NextResponse.json({ id: memory.id });
}
