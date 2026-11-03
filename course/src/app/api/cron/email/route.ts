import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { sweepEmails } from "@/lib/email/sweep";

// The daily email run (SPEC.md → Email: sequences run from a daily Vercel
// cron). Vercel calls it with "Authorization: Bearer $CRON_SECRET".

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  try {
    const result = await sweepEmails();
    const count = (outcome: string) => result.results.filter((r) => r.outcome === outcome).length;
    const summary = {
      due: result.due,
      sent: count("sent"),
      failed: count("failed"),
      skipped: count("duplicate") + count("suppressed"),
    };
    console.info("email cron", summary);
    return NextResponse.json(summary, { status: summary.failed ? 500 : 200 });
  } catch (error) {
    console.error("email cron", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
