// Where an upload got to.
//
// The bytes go straight from the browser to storage, so the server only sees
// a file after the fact — which means "uploaded" and "kept" are genuinely
// different moments, and the uploader has to be able to tell the parent
// which one they are looking at.
//
// Reads under RLS, so this returns nothing for assets that are not theirs.
// It exposes the verdict and the plain-English reason and nothing else: not
// the signature, not the declared type, not the storage path.

import { NextRequest, NextResponse } from "next/server";
import { currentUser, userClient } from "@/lib/supabase/server";

/** Asking about more than this in one go is not a page loading its own uploads. */
const MAX_ASSETS = 200;

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const ids = (new URL(req.url).searchParams.get("assets") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ASSETS);
  if (ids.length === 0) return NextResponse.json({ verdicts: {} });

  const { data } = await userClient()
    .from("media_assets")
    .select("id, scan_verdict, scan_reason")
    .in("id", ids);

  const verdicts: Record<string, { verdict: string; reason: string | null }> = {};
  for (const row of data ?? []) {
    verdicts[row.id] = { verdict: row.scan_verdict, reason: row.scan_reason };
  }
  return NextResponse.json({ verdicts });
}
