// Downloading an export.
//
// Never a permanent URL. An export is the single most complete copy of a
// family's private life that exists anywhere, so the link is signed, short,
// and issued only to someone the database agrees is in that family — and
// taking one is written to the log they can read.

import { NextRequest, NextResponse } from "next/server";
import { adminClient, currentUser, userClient } from "@/lib/supabase/server";
import { getObjectStore, TTL } from "@/lib/storage/provider";
import { record } from "@/lib/privacy/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: { exportId: string } }
) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  // RLS decides this: the select returns nothing unless the caller is in the
  // family the export belongs to.
  const db = userClient();
  const { data: exp } = await db
    .from("archive_exports")
    .select("id, family_id, storage_path, status, expires_at")
    .eq("id", params.exportId)
    .maybeSingle();

  if (!exp || exp.status !== "ready" || !exp.storage_path) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  if (new Date(exp.expires_at) < new Date()) {
    return NextResponse.json({ error: "this copy has expired — prepare a new one" }, { status: 410 });
  }

  const admin = adminClient();
  let downloadUrl: string;
  try {
    downloadUrl = await getObjectStore().readUrl("renders", exp.storage_path, TTL.download, {
      downloadAs: "your-archive.zip",
    });
  } catch {
    return NextResponse.json({ error: "could not prepare the download" }, { status: 500 });
  }

  await record(admin, {
    familyId: exp.family_id,
    actorId: user.id,
    actorLabel: user.email?.split("@")[0] ?? "Someone",
    kind: "exported_archive",
    detail: "downloaded the copy",
  });

  return NextResponse.redirect(downloadUrl);
}
