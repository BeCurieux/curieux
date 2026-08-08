import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/server";
import { runScheduler } from "@/lib/jobs/scheduler";
import { requireCronSecret } from "@/lib/security/cron";
import { flushAnalytics } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly cron (§41). Asks every live market whether its generation hour has
 * arrived, and queues work if so. Queuing is cheap; the jobs runner does the
 * expensive part, which keeps this endpoint well inside its time limit however
 * many households exist.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  try {
    const outcomes = await runScheduler(serviceClient());
    return NextResponse.json({ ok: true, outcomes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduler failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await flushAnalytics();
  }
}
