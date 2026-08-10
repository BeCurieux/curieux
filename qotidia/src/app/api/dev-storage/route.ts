// Somewhere for demo mode to put a file.
//
// The in-memory store lives in this process, so there is no URL a browser
// can PUT to — and without one, uploading in demo mode fails at the transfer
// with a fetch error, which is a poor way to discover that the product works
// everywhere except the part you were trying to look at.
//
// This is the write end of MemoryStore and nothing else. It refuses outright
// unless the memory store is the one in use, so it cannot become a way into
// a real bucket: there is no configuration in which this route is reachable
// and a real store is serving the archive.

import { NextRequest, NextResponse } from "next/server";
import { getObjectStore, type Bucket } from "@/lib/storage/provider";
import { requireUser } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  const store = getObjectStore();
  if (store.name !== "memory") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  // Still behind a login, and still confined to the caller's own prefix.
  // Demo mode is not a reason to write a route that behaves differently from
  // the thing it is standing in for.
  const user = await requireUser();

  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") as Bucket | null;
  const key = url.searchParams.get("key");
  if (!bucket || !key) return NextResponse.json({ error: "bucket and key required" }, { status: 400 });
  if (bucket !== "media" && bucket !== "renders") {
    return NextResponse.json({ error: "no such bucket" }, { status: 400 });
  }
  if (!key.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "not your prefix" }, { status: 403 });
  }

  const body = Buffer.from(await req.arrayBuffer());
  await store.put(bucket, key, body, req.headers.get("content-type") ?? "application/octet-stream");
  return new NextResponse(null, { status: 200 });
}
