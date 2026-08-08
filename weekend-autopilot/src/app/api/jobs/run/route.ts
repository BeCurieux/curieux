import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/server";
import { claimNext, complete, fail } from "@/lib/jobs/queue";
import { runJob } from "@/lib/jobs/handlers";
import { requireCronSecret } from "@/lib/security/cron";
import { flushAnalytics } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Leave headroom so a claimed job is finished, not killed mid-generation. */
const TIME_BUDGET_MS = 240_000;
const PER_JOB_BUDGET_MS = 90_000;

/**
 * The job runner (§40).
 *
 * Called frequently by cron. Claims jobs one at a time with FOR UPDATE SKIP
 * LOCKED, so several concurrent invocations cooperate rather than collide, and
 * stops before the platform’s timeout rather than being cut off — a generation
 * killed halfway leaves a run record with no plan, which is exactly the state
 * the retry logic then has to reason about.
 */
export async function POST(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const db = serviceClient();
  const startedAt = Date.now();
  const processed: Array<{ id: string; type: string; ok: boolean; error?: string }> = [];

  try {
    while (Date.now() - startedAt < TIME_BUDGET_MS - PER_JOB_BUDGET_MS) {
      const job = await claimNext(db);
      if (!job) break;

      try {
        await runJob(db, job);
        await complete(db, job);
        processed.push({ id: job.id, type: job.type, ok: true });
      } catch (error) {
        await fail(db, job, error);
        processed.push({
          id: job.id,
          type: job.type,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({ ok: true, processed: processed.length, jobs: processed });
  } finally {
    await flushAnalytics();
  }
}

/** GET is allowed too, because some cron providers only issue GETs. */
export async function GET(request: NextRequest) {
  return POST(request);
}
