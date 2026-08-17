/**
 * Where an early-access request goes.
 *
 * Two adapters, same seam as publishing and the funnel: Supabase in
 * production, an append-only NDJSON file locally. The local one is not a stub.
 * There is no database configured in this repository yet, and a contact form
 * that only worked once somebody had provisioned Postgres would be a contact
 * form that dropped the first merchant who ever wrote in.
 *
 * The rule this file exists to enforce is in `index.ts` and worth stating
 * here too: **if the write fails, the person is told.** A form that swallows
 * its own failure and says "thanks" is the exact dishonesty the rest of the
 * product is arranged against, and it is the single most common way a landing
 * page lies. The funnel endpoint answers 204 on everything, deliberately,
 * because a shopper cannot act on a dropped analytics event. A merchant whose
 * message vanished can act on it — they can send it again — so they are told.
 */

import { mkdir, appendFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EarlyAccessRecord, EarlyAccessRequest } from "./types";

export interface EarlyAccessStore {
  readonly name: string;
  record(request: EarlyAccessRequest): Promise<EarlyAccessRecord>;
  /** Newest first. For a human reading their inbox, not for a page. */
  list(): Promise<EarlyAccessRecord[]>;
}

/**
 * A line per request, appended.
 *
 * Append rather than read-modify-write for the same reason the event log is:
 * an interrupted write costs one record instead of the file.
 */
export function createLocalEarlyAccessStore(
  options: { dir?: string; now?: () => Date; id?: () => string } = {},
): EarlyAccessStore {
  const dir = options.dir ?? path.join(process.cwd(), ".cache");
  const file = path.join(dir, "early-access.ndjson");
  const now = options.now ?? (() => new Date());
  const id = options.id ?? randomUUID;

  return {
    name: "local",

    async record(request: EarlyAccessRequest): Promise<EarlyAccessRecord> {
      const record: EarlyAccessRecord = { ...request, id: id(), receivedAt: now().toISOString() };
      await mkdir(dir, { recursive: true });
      await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
      return record;
    },

    async list(): Promise<EarlyAccessRecord[]> {
      let raw: string;
      try {
        raw = await readFile(file, "utf8");
      } catch {
        return [];
      }

      return raw
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as EarlyAccessRecord];
          } catch {
            // A truncated last line from an interrupted append.
            return [];
          }
        })
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    },
  };
}

/**
 * Service role only, and the table has no policy at all.
 *
 * See `schema.sql`. An anon key can neither write a row nor read anybody's —
 * which matters more here than it does for events, because these rows are the
 * only personal data in the system. Everything else popuup stores is a public
 * product feed or a random session id.
 */
export function createSupabaseEarlyAccessStore(
  client: SupabaseClient,
  options: { now?: () => Date } = {},
): EarlyAccessStore {
  const now = options.now ?? (() => new Date());

  return {
    name: "supabase",

    async record(request: EarlyAccessRequest): Promise<EarlyAccessRecord> {
      const { data, error } = await client
        .from("early_access")
        .insert({
          name: request.name,
          email: request.email,
          store: request.store,
          brief: request.brief ?? null,
          received_at: now().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Supabase early-access insert failed: ${error?.message ?? "unknown error"}`);
      }
      return toRecord(data);
    },

    async list(): Promise<EarlyAccessRecord[]> {
      const { data, error } = await client
        .from("early_access")
        .select()
        .order("received_at", { ascending: false });

      if (error) throw new Error(`Supabase early-access read failed: ${error.message}`);
      return (data ?? []).map(toRecord);
    },
  };
}

function toRecord(row: Record<string, unknown>): EarlyAccessRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    store: String(row.store),
    brief: row.brief == null ? undefined : String(row.brief),
    receivedAt: String(row.received_at),
  };
}
