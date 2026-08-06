// Short-lived signed URL for a user's own media asset.
// RLS on media_assets guarantees the asset lookup only succeeds for the
// owner; no permanent public URLs are ever issued (brief §4).

import { NextRequest, NextResponse } from "next/server";
import { adminClient, currentUser, userClient } from "@/lib/supabase/server";
import { SERVABLE_VERDICT } from "@/lib/media/verify";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const assetId = new URL(req.url).searchParams.get("asset");
  if (!assetId) return NextResponse.json({ error: "asset required" }, { status: 400 });

  // Ownership check runs under RLS. The verdict check is separate and does
  // not overlap with it: RLS answers "is this yours", the verdict answers
  // "have we read the bytes and found them to be what they claimed". A file
  // is served only when both are true — Supabase returns the stored
  // Content-Type with a signed URL, so an unverified upload is a header we
  // let the uploader choose.
  const { data: asset } = await userClient()
    .from("media_assets")
    .select("storage_path, scan_verdict, scan_reason")
    .eq("id", assetId)
    .single();
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (asset.scan_verdict !== SERVABLE_VERDICT) {
    // 409 rather than 404: the asset exists and is theirs, and a caller that
    // has just uploaded needs to tell "still being checked" apart from
    // "refused" — the first resolves on its own, the second never will.
    return NextResponse.json(
      {
        error: asset.scan_verdict === "pending" ? "still being checked" : "refused",
        reason: asset.scan_reason ?? null,
        retryable: asset.scan_verdict === "pending",
      },
      { status: 409 }
    );
  }

  const { data: signed, error } = await adminClient()
    .storage.from("media")
    .createSignedUrl(asset.storage_path, 300);
  if (error || !signed) return NextResponse.json({ error: "sign failed" }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl, expiresIn: 300 });
}
