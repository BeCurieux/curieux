/**
 * Durable job queue (§40).
 *
 * The brief suggests Trigger.dev or Inngest. This implementation is a
 * Postgres-backed queue instead, for one reason that matters at this stage:
 * plan generation must not depend on a second external service being reachable
 * on a Thursday morning, and the database is already a hard dependency. Jobs
 * are claimed with FOR UPDATE SKIP LOCKED so multiple runners are safe, retried
 * with exponential backoff, and keyed for idempotency exactly as the brief
 * specifies (household_id + weekend_date + plan_type).
 *
 * The handlers in ./handlers.ts are plain async functions over (db, payload).
 * Moving to a hosted orchestrator later means calling the same handlers from a
 * different trigger — that is the whole reason they are separated from this
 * file.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type JobType =
  | "generate-weekend-plan"
  | "verify-weekend-plan"
  | "deliver-weekend-plan"
  | "send-feedback-request"
  | "process-feedback"
  | "expire-pilot"
  | "subscription-conversion-reminder"
  | "retry-failed-generation";

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

/**
 * The idempotency key the brief specifies (§40). Everything that could run
 * twice is keyed on it, so a retried cron, a duplicated webhook or two runners
 * racing produce one plan rather than three.
 */
export function planJobKey(
  type: JobType,
  householdId: string,
  weekendDate: string,
  planType = "PRIMARY"
): string {
  return `${type}:${householdId}:${weekendDate}:${planType}`;
}

export async function enqueue(
  db: SupabaseClient,
  type: JobType,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  runAfter?: Date
): Promise<{ enqueued: boolean }> {
  const { error } = await db.from("jobs").insert({
    type,
    payload,
    idempotency_key: idempotencyKey,
    run_after: (runAfter ?? new Date()).toISOString(),
  });

  // 23505 is unique_violation: the job already exists, which is success.
  if (error && error.code !== "23505") {
    throw new Error(`enqueue(${type}): ${error.message}`);
  }
  return { enqueued: !error };
}

export async function claimNext(db: SupabaseClient): Promise<Job | null> {
  const { data, error } = await db.rpc("claim_job");
  if (error) throw new Error(`claim_job: ${error.message}`);
  const rows = data as Job[] | null;
  return rows?.[0] ?? null;
}

export async function complete(db: SupabaseClient, job: Job): Promise<void> {
  await db.from("jobs").update({ status: "done", last_error: null }).eq("id", job.id);
}

export async function fail(db: SupabaseClient, job: Job, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const exhausted = job.attempts >= job.max_attempts;

  // 30s, 60s, 120s, 240s… Plan generation failures are frequently transient
  // (a provider rate limit, a slow model), and Thursday is hours away.
  const delaySeconds = 30 * 2 ** Math.max(0, job.attempts - 1);

  await db
    .from("jobs")
    .update({
      status: exhausted ? "dead" : "queued",
      last_error: message.slice(0, 2000),
      run_after: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    })
    .eq("id", job.id);
}

/** Admin retry from the dashboard (§42). */
export async function requeue(db: SupabaseClient, jobId: string): Promise<void> {
  await db
    .from("jobs")
    .update({ status: "queued", attempts: 0, last_error: null, run_after: new Date().toISOString() })
    .eq("id", jobId);
}

export async function deadJobs(db: SupabaseClient, limit = 50): Promise<Job[]> {
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("status", "dead")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Job[];
}
