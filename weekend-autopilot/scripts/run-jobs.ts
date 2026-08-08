/**
 * Local job runner.
 *
 * In production the queue is drained by /api/jobs/run on a cron. This runs the
 * same handlers from a terminal, which is how you watch a generation happen
 * end to end while developing.
 *
 *   npm run jobs            drain the queue once
 *   npm run jobs -- --watch keep draining every few seconds
 *   npm run jobs -- --schedule  run the scheduler first, then drain
 */

import { createClient } from "@supabase/supabase-js";
import { claimNext, complete, fail } from "../src/lib/jobs/queue";
import { runJob } from "../src/lib/jobs/handlers";
import { runScheduler } from "../src/lib/jobs/scheduler";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const watch = process.argv.includes("--watch");
const schedule = process.argv.includes("--schedule");

async function drain(): Promise<number> {
  let processed = 0;

  for (;;) {
    const job = await claimNext(db);
    if (!job) break;

    const startedAt = Date.now();
    process.stdout.write(`→ ${job.type} `);

    try {
      await runJob(db, job);
      await complete(db, job);
      console.log(`ok (${Date.now() - startedAt}ms)`);
    } catch (error) {
      await fail(db, job, error);
      console.log(`failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    processed++;
  }

  return processed;
}

async function main(): Promise<void> {
  if (schedule) {
    const outcomes = await runScheduler(db);
    for (const outcome of outcomes) {
      console.log(
        `${outcome.market_id}: ${outcome.action} for ${outcome.weekend_date} (${outcome.households} households)`
      );
    }
  }

  if (!watch) {
    const count = await drain();
    console.log(count === 0 ? "Queue is empty." : `Processed ${count} job(s).`);
    return;
  }

  console.log("Watching the queue. Ctrl-C to stop.");
  for (;;) {
    await drain();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
