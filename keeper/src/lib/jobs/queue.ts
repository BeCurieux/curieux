// Background job queue (brief §26).
// Postgres-backed; jobs are claimed atomically via the claim_job() SQL
// function (FOR UPDATE SKIP LOCKED), so multiple runners are safe.
// Jobs are idempotent: enqueueing with the same idempotency key is a no-op.

import type { SupabaseClient } from "@supabase/supabase-js";

export type JobType =
  | "analyse_memories"
  | "cluster_memories"
  | "generate_questions"
  | "generate_book"
  | "render_pdf"
  | "submit_print"
  | "poll_print_status";

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: "queued" | "running" | "done" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
}

export async function enqueue(
  db: SupabaseClient,
  type: JobType,
  payload: Record<string, unknown>,
  idempotencyKey: string
): Promise<void> {
  const { error } = await db.from("jobs").insert({
    type,
    payload,
    idempotency_key: idempotencyKey,
  });
  // 23505 = unique_violation: job already enqueued — idempotent no-op.
  if (error && error.code !== "23505") throw new Error(`enqueue failed: ${error.message}`);
}

export async function claimNext(db: SupabaseClient): Promise<Job | null> {
  const { data, error } = await db.rpc("claim_job");
  if (error) throw new Error(`claim_job failed: ${error.message}`);
  const rows = data as Job[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function complete(db: SupabaseClient, job: Job): Promise<void> {
  await db.from("jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", job.id);
}

export async function fail(db: SupabaseClient, job: Job, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const dead = job.attempts >= job.max_attempts;
  // Exponential backoff: 30s, 60s, 120s, ...
  const delaySeconds = 30 * 2 ** (job.attempts - 1);
  await db
    .from("jobs")
    .update({
      status: dead ? "dead" : "queued",
      last_error: message.slice(0, 1000),
      run_after: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

/** Admin retry: put a dead/failed job back on the queue. */
export async function retry(db: SupabaseClient, jobId: string): Promise<void> {
  await db
    .from("jobs")
    .update({ status: "queued", attempts: 0, last_error: null, run_after: new Date().toISOString() })
    .eq("id", jobId);
}
