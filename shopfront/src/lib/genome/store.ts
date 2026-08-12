/**
 * Where a Genome lives before Supabase exists.
 *
 * "Stored alongside the catalogue," says CLAUDE.md — alongside rather than
 * inside. A Genome and an ingest have different lifetimes: an ingest is re-read
 * whenever prices might have moved, and re-running a model pass over an
 * unchanged catalogue every time would be paying for the same read repeatedly.
 * Separate files let one be refreshed without the other.
 *
 * `staleFor()` is the seam that makes that safe. A Genome that predates products
 * the catalogue now has is still usable for the products it covers, and knowing
 * which ones it misses is better than either trusting it blindly or throwing it
 * away whole.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Catalogue } from "@/lib/ingest/types";
import type { CatalogueGenome } from "./types";

const DIR = path.join(process.cwd(), ".cache", "genome");

export function genomePath(key: string): string {
  return path.join(DIR, `${safeKey(key)}.json`);
}

export async function saveGenome(key: string, genome: CatalogueGenome): Promise<string> {
  const file = genomePath(key);
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(genome, null, 2));
  return file;
}

/** Absent is a normal answer — the merchandiser runs without one. */
export async function loadGenome(key: string): Promise<CatalogueGenome | null> {
  try {
    return JSON.parse(await readFile(genomePath(key), "utf8")) as CatalogueGenome;
  } catch {
    return null;
  }
}

export interface Staleness {
  /** Handles in the catalogue with no Genome entry. */
  missing: string[];
  /** Handles the Genome covers that have left the catalogue. */
  departed: string[];
  /** True when nothing in the catalogue is uncovered. */
  complete: boolean;
}

export function staleFor(genome: CatalogueGenome, catalogue: Catalogue): Staleness {
  const covered = new Set(genome.products.map((entry) => entry.handle));
  const current = new Set(catalogue.products.map((product) => product.handle));

  const missing = [...current].filter((handle) => !covered.has(handle));
  const departed = [...covered].filter((handle) => !current.has(handle));

  return { missing, departed, complete: missing.length === 0 };
}

/** No traversal out of the cache directory from a store key. */
function safeKey(key: string): string {
  const cleaned = key.replace(/[^a-z0-9._-]/gi, "_");
  if (!cleaned || cleaned.startsWith(".")) throw new Error(`Unusable genome key: ${key}`);
  return cleaned;
}
