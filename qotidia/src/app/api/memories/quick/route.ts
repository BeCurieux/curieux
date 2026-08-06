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
import { keepMemory, storySubject } from "@/lib/memories/scope";

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

  const story = await storySubject(db, subjectId);
  if (!story) return NextResponse.json({ error: "no such subject" }, { status: 404 });

  const memoryId = await keepMemory(db, {
    familyId: story.family_id,
    about: [subjectId],
    memory: {
      created_by: user.id,
      type,
      raw_text: text.slice(0, 4000),
      memory_date: new Date().toISOString().slice(0, 10),
      arrived_via: "quick",
      filed_at: new Date().toISOString(),
      contribution_status: statusForNewMemory(membership.role),
      visibility: form.get("private") === "on" ? "private" : "family",
    },
  });

  // An insert can succeed while the returned row comes back empty, so this
  // checks the row rather than only the error — reading .id off null is a
  // 500 where the caller deserves an honest 400.
  if (!memoryId) {
    return NextResponse.json({ error: "could not keep that" }, { status: 400 });
  }
  const memory = { id: memoryId };

  // Same hourly batching as the other capture paths, so three things added
  // in a row produce one analysis job rather than three.
  const window = Math.floor(Date.now() / (60 * 60 * 1000));
  await enqueue(adminClient(), "analyse_memories", { subject_id: subjectId }, `analyse-${subjectId}-${window}`);

  return NextResponse.json({ id: memory.id });
}
