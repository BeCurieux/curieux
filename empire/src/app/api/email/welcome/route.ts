import { NextResponse, type NextRequest } from "next/server";
import { isCronRequest } from "@/lib/cron";
import { systemRepo } from "@/lib/data";
import { senderFromEnv } from "@/lib/email/send";
import { runWelcome, welcomeDeps } from "@/lib/email/welcome";

// Daily (vercel.json cron): sends welcome emails 2 to 5 as they fall due.
// Email 1 goes out at sign-up.
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sender = senderFromEnv();
  if (!sender) return NextResponse.json({ skipped: "no email sender configured" });
  const result = await runWelcome(welcomeDeps(systemRepo(), sender));
  return NextResponse.json(result);
}
