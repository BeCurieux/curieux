// Job runner endpoint. Invoked by a scheduler (cron) or `npm run jobs`.
// Protected by a shared secret; processes up to `batch` jobs per call.

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/server";
import { claimNext, complete, enqueue, fail } from "@/lib/jobs/queue";
import { runJob } from "@/lib/jobs/handlers";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-jobs-secret");
  if (!process.env.JOBS_SECRET || secret !== process.env.JOBS_SECRET) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const db = adminClient();
  const batch = Math.min(Number(new URL(req.url).searchParams.get("batch") ?? 5), 20);
  const results: { id: string; type: string; ok: boolean; error?: string }[] = [];

  // The daily sweep rides on the runner rather than needing a second cron.
  // The key is the date, so a scheduler calling this every few minutes still
  // produces exactly one digest a day — enqueue() is a no-op on a repeat.
  const today = new Date().toISOString().slice(0, 10);
  await enqueue(db, "notify_digest", { day: today }, `digest-${today}`);

  for (let i = 0; i < batch; i++) {
    const job = await claimNext(db);
    if (!job) break;
    try {
      await runJob(db, job);
      await complete(db, job);
      results.push({ id: job.id, type: job.type, ok: true });
    } catch (err) {
      await fail(db, job, err);
      results.push({
        id: job.id,
        type: job.type,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
