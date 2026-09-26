/**
 * Where a POP's brief and decisions live, beside the shop it publishes as.
 *
 * A POP is published through `lib/publish` like any shop; this stores what a
 * shop row cannot hold: the confirmed brief, the ranked shortlist the model
 * saw, what the filter excluded and why, the guard's repairs, and one decision
 * per product. Local JSON or Supabase, chosen the same way `lib/publish`
 * chooses (`storeNameFromEnv`).
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { storeNameFromEnv } from "@/lib/publish/store";
import type { PopBrief } from "./brief";
import type { PopDecision } from "./decisions";
import type { Excluded } from "./filter";

export type PopStatus = "draft" | "live" | "paused" | "ended";

export interface PopRecord {
  id: string;
  shopSlug: string;
  sentence: string;
  brief: PopBrief;
  status: PopStatus;
  lockedHandles: string[];
  excludedHandles: string[];
  createdAt: string;
}

export interface ShortlistEntry {
  handle: string;
  score: number;
  matched: string[];
  notes: string[];
  pinnedVariantId: string | null;
}

export interface PopVersionRecord {
  id: string;
  popId: string;
  shopVersionId: string;
  version: number;
  brief: PopBrief;
  shortlist: ShortlistEntry[];
  excluded: Excluded[];
  repairs: string[];
  taxonomyVersion: string;
  briefPromptVersion: string | null;
  decisions: PopDecision[];
  createdAt: string;
}

export interface RecordPopInput {
  shopSlug: string;
  shopVersionId: string;
  brief: PopBrief;
  shortlist: ShortlistEntry[];
  excluded: Excluded[];
  repairs: string[];
  decisions: PopDecision[];
  taxonomyVersion: string;
  briefPromptVersion: string | null;
}

export interface PopStore {
  readonly name: string;
  /** Upsert the POP on its slug, then append an immutable version. */
  record(input: RecordPopInput): Promise<{ pop: PopRecord; version: PopVersionRecord }>;
  find(slug: string): Promise<{ pop: PopRecord; versions: PopVersionRecord[] } | null>;
}

// ------------------------------------------------------------------- local

interface LocalData {
  pops: PopRecord[];
  versions: PopVersionRecord[];
}

export function localPopPath(root = process.cwd()): string {
  return path.join(root, ".cache", "pop", "db.json");
}

export function createLocalPopStore(file = localPopPath()): PopStore {
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<LocalData> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as LocalData;
    } catch {
      return { pops: [], versions: [] };
    }
  };
  return {
    name: "local",
    record(input) {
      const run = queue.then(async () => {
        const data = await read();
        const now = new Date().toISOString();
        let pop = data.pops.find((p) => p.shopSlug === input.shopSlug);
        if (pop) {
          Object.assign(pop, popFields(input));
        } else {
          pop = { id: randomUUID(), shopSlug: input.shopSlug, status: "live", createdAt: now, ...popFields(input) };
          data.pops.push(pop);
        }
        const version: PopVersionRecord = {
          id: randomUUID(),
          popId: pop.id,
          version: data.versions.filter((v) => v.popId === pop!.id).length + 1,
          createdAt: now,
          ...versionFields(input),
        };
        data.versions.push(version);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(`${file}.tmp`, JSON.stringify(data));
        await rename(`${file}.tmp`, file);
        return { pop, version };
      });
      queue = run.catch(() => undefined);
      return run;
    },
    async find(slug) {
      const data = await read();
      const pop = data.pops.find((p) => p.shopSlug === slug);
      if (!pop) return null;
      return { pop, versions: data.versions.filter((v) => v.popId === pop.id).sort((a, b) => a.version - b.version) };
    },
  };
}

export function popFields(input: RecordPopInput) {
  return {
    sentence: input.brief.sentence,
    brief: input.brief,
    lockedHandles: input.brief.rules.includeHandles,
    excludedHandles: input.brief.rules.excludeHandles,
  };
}

export function versionFields(input: RecordPopInput) {
  return {
    shopVersionId: input.shopVersionId,
    brief: input.brief,
    shortlist: input.shortlist,
    excluded: input.excluded,
    repairs: input.repairs,
    taxonomyVersion: input.taxonomyVersion,
    briefPromptVersion: input.briefPromptVersion,
    decisions: input.decisions,
  };
}

export async function defaultPopStore(): Promise<PopStore> {
  if (storeNameFromEnv() === "supabase") {
    const { createSupabasePopStore } = await import("./store-supabase");
    return createSupabasePopStore();
  }
  return createLocalPopStore();
}
