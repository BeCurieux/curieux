import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deliverPending } from "@/lib/email/deliver";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/supabase/server-env";

// Sends the emails waiting in the outbox. Called every minute by the
// database's schedule (private.kick_email_sender) with CRON_SECRET; nobody
// else can call it.
export async function POST(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  const tally = await deliverPending(createAdminClient());
  return NextResponse.json(tally);
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
