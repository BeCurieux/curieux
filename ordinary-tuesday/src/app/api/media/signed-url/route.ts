// Short-lived signed URL for a user's own media asset.
// RLS on media_assets guarantees the asset lookup only succeeds for the
// owner; no permanent public URLs are ever issued (brief §4).

import { NextRequest, NextResponse } from "next/server";
import { adminClient, currentUser, userClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const assetId = new URL(req.url).searchParams.get("asset");
  if (!assetId) return NextResponse.json({ error: "asset required" }, { status: 400 });

  // Ownership check runs under RLS.
  const { data: asset } = await userClient()
    .from("media_assets")
    .select("storage_path")
    .eq("id", assetId)
    .single();
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: signed, error } = await adminClient()
    .storage.from("media")
    .createSignedUrl(asset.storage_path, 300);
  if (error || !signed) return NextResponse.json({ error: "sign failed" }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl, expiresIn: 300 });
}
