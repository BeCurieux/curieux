import { NextResponse, type NextRequest } from "next/server";
import { unsubscribe } from "@/app/unsubscribe/actions";

// One-click unsubscribe from the mail app (RFC 8058): Gmail, Apple Mail and
// others POST here from the List-Unsubscribe header, with no page to open.
// The emailed link goes to /unsubscribe, which asks for a click first so
// link scanners can't unsubscribe anyone.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  await unsubscribe(token);
  // The same answer whatever the token, so it can't be used to test tokens.
  return NextResponse.json({ ok: true });
}
