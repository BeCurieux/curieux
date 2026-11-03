import { NextResponse, type NextRequest } from "next/server";
import { emailSecret } from "@/lib/email/send";
import { suppress } from "@/lib/email/suppress";
import { decodeEmail, verifyUnsubscribe } from "@/lib/email/unsubscribe";

// One-click unsubscribe (RFC 8058): mail apps POST here from the
// List-Unsubscribe header. Only a POST unsubscribes, so link scanners that
// fetch every URL in an email can't do it by accident.
export async function POST(request: NextRequest) {
  const email = decodeEmail(request.nextUrl.searchParams.get("e") ?? "");
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!email || !verifyUnsubscribe(email, token, emailSecret()))
    return NextResponse.json({ error: "bad link" }, { status: 400 });
  return (await suppress(email))
    ? NextResponse.json({ unsubscribed: true })
    : NextResponse.json({ error: "failed" }, { status: 500 });
}
