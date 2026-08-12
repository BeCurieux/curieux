// Copying an archive from one store to another.
//
// The seam makes this small: both ends are an ObjectStore, so this file has
// no idea whether it is reading from Supabase and writing to R2 or the other
// way round, and the same code runs against MemoryStore in the tests.
//
// ## What this is careful about
//
//   **A missing object is not a failed copy.** A row can point at a file
//   that is not there — an upload that died between the PUT and the insert,
//   something deleted out of band. That is worth reporting and is not worth
//   stopping a migration for, because the alternative is a run that dies at
//   3% and has to be restarted by a human who then has to decide the same
//   thing anyway.
//
//   **An unrecognised error is a failure, not a missing object.** These two
//   get conflated by anything that treats "the read threw" as "the file is
//   gone", and the consequence is a summary that says a photograph was never
//   there when in fact the network blinked. Only errors that actually look
//   like absence are counted as absence; everything else is loud.
//
//   **Bytes are compared, not trusted.** A PUT that returns 200 is a claim.
//   Reading it back and comparing is the only way to know the copy is the
//   file — and this is a one-time move of the only copy of somebody's
//   photographs, which is exactly when paying twice for certainty is right.

import { createHash } from "node:crypto";
import type { ObjectStore } from "./provider";
import type { StoredObject } from "./inventory";

export type CopyOutcome = "copied" | "skipped" | "missing" | "failed";

export interface CopyResult {
  bucket: string;
  key: string;
  outcome: CopyOutcome;
  bytes: number;
  error?: string;
}

export interface MigrateSummary {
  total: number;
  copied: number;
  skipped: number;
  missing: number;
  failed: number;
  bytes: number;
  /** The ones somebody has to look at, kept whole rather than counted. */
  problems: CopyResult[];
}

export interface MigrateOptions {
  from: ObjectStore;
  to: ObjectStore;
  objects: StoredObject[];
  /**
   * Objects already done, as `bucket/key`. A migration of a real archive
   * takes hours and will be interrupted; starting over is not an option
   * somebody should have to accept.
   */
  alreadyDone?: Set<string>;
  /**
   * Read the copy back and compare it. Default on. Doubles the reads, which
   * on the destination is free on R2 and is the point of moving there.
   */
  verify?: boolean;
  /**
   * How many objects in flight. Deliberately low: the seam is Buffer-based,
   * so each one is held whole in memory, and this archive holds phone video.
   * Eight at 200MB is 1.6GB of resident set and an OOM two hours in.
   */
  concurrency?: number;
  /** Called as each object finishes, for the ledger and for progress. */
  onDone?: (result: CopyResult) => void | Promise<void>;
}

const at = (object: StoredObject) => `${object.bucket}/${object.key}`;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Does this error mean the object is not there, as opposed to the read
 * having gone wrong?
 *
 * Matched on the message, which is not something to be proud of — but the
 * alternative is a typed error the two SDKs do not agree on, and the failure
 * mode of guessing wrong is chosen deliberately: anything unrecognised is
 * treated as a real failure, so a transient fault is reported loudly rather
 * than being quietly filed as "that file never existed".
 */
export function looksMissing(error: unknown): boolean {
  return /not found|404|no such key|nosuchkey|does not exist/i.test(message(error));
}

/** Retry the things that are worth retrying, which is not absence. */
async function withRetry<T>(what: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await what();
    } catch (error) {
      last = error;
      // Absence will not become presence by asking again.
      if (looksMissing(error)) throw error;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
      }
    }
  }
  throw last;
}

const digest = (body: Buffer) => createHash("sha256").update(body).digest("hex");

/** Copy one object, reporting rather than throwing. */
export async function copyOne(
  object: StoredObject,
  from: ObjectStore,
  to: ObjectStore,
  verify: boolean
): Promise<CopyResult> {
  const where = { bucket: object.bucket, key: object.key };

  let body: Buffer;
  try {
    body = await withRetry(() => from.get(object.bucket, object.key));
  } catch (error) {
    return {
      ...where,
      outcome: looksMissing(error) ? "missing" : "failed",
      bytes: 0,
      error: message(error),
    };
  }

  try {
    // Octet-stream only where the database knows no better. It is the
    // honest answer: guessing a type from the extension is how a .mov gets
    // served as something a browser refuses to play.
    await withRetry(() =>
      to.put(object.bucket, object.key, body, object.contentType ?? "application/octet-stream")
    );

    if (verify) {
      const back = await withRetry(() => to.get(object.bucket, object.key));
      if (digest(back) !== digest(body)) {
        return {
          ...where,
          outcome: "failed",
          bytes: body.length,
          error: `copy does not match source (${body.length} bytes in, ${back.length} back)`,
        };
      }
    }
  } catch (error) {
    return { ...where, outcome: "failed", bytes: body.length, error: message(error) };
  }

  return { ...where, outcome: "copied", bytes: body.length };
}

/** Copy everything, with a bounded number in flight. */
export async function migrate(options: MigrateOptions): Promise<MigrateSummary> {
  const {
    from,
    to,
    objects,
    alreadyDone = new Set<string>(),
    verify = true,
    concurrency = 4,
    onDone,
  } = options;

  const summary: MigrateSummary = {
    total: objects.length,
    copied: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    bytes: 0,
    problems: [],
  };

  const queue = [...objects];
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const result = alreadyDone.has(at(next))
        ? { bucket: next.bucket, key: next.key, outcome: "skipped" as const, bytes: 0 }
        : await copyOne(next, from, to, verify);

      summary[result.outcome]++;
      summary.bytes += result.bytes;
      if (result.outcome === "missing" || result.outcome === "failed") {
        summary.problems.push(result);
      }
      await onDone?.(result);
    }
  });

  await Promise.all(workers);
  return summary;
}
