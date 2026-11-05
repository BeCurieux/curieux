// Everything the archive has stored, according to the only thing that knows.
//
// There is no listing call in the ObjectStore interface and there should not
// be one. A bucket listing answers "what is in the bucket", which is not the
// question a move asks. The question is "what does the product still point
// at" — and only the database can answer that. An object nothing references
// is not a file to carry forward; it is litter from an interrupted upload,
// and copying it would move that litter into the new store and pay to keep
// it there forever.
//
// This is the same reasoning erase.ts already runs on, from the other
// direction: the row is the map to the file, which is why erase.ts deletes
// objects *before* rows. Delete the rows first and the photographs become
// unreachable orphans that are still there. Migrate from a bucket listing
// and you carry the orphans across.

import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllPages, type PageResult } from "@/lib/supabase/paged";
import type { Bucket } from "./provider";

/** Which table named this key. Reported, so a shortfall names its table. */
export type KeySource =
  | "media_assets"
  | "media_assets.thumbnail"
  | "books"
  | "archive_exports";

export interface StoredObject {
  bucket: Bucket;
  key: string;
  source: KeySource;
  /**
   * What to write it back as.
   *
   * Known for uploads, because the browser told us and we stored it. Known
   * by construction for the things we generate. Absent only where neither
   * is true, and the caller decides what to do about that.
   */
  contentType?: string;
}

/**
 * Every read here is paged, ordered by a unique column so pages cannot
 * overlap or skip. See paged.ts for what goes wrong otherwise — briefly,
 * PostgREST hands back the first thousand rows without mentioning it, and a
 * migration that reads "every asset" would move a thousand of them and
 * report that it was done.
 */
const readAll = (db: SupabaseClient, table: string, columns: string) =>
  readAllPages<Record<string, unknown>>(table, (from, to) =>
    // The cast is because the column list is a variable rather than a
    // literal, which is all supabase-js needs to give up on inferring a row
    // type and hand back GenericStringError[]. The three callers below are
    // the only ones, and each names its columns immediately above.
    db.from(table).select(columns).order("id", { ascending: true }).range(from, to) as unknown as
      PromiseLike<PageResult<Record<string, unknown>>>
  );

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** Every object the database still points at, in both buckets. */
export async function inventory(db: SupabaseClient): Promise<StoredObject[]> {
  const found: StoredObject[] = [];

  for (const a of await readAll(
    db,
    "media_assets",
    "id, storage_path, thumbnail_path, mime_type"
  )) {
    const key = text(a.storage_path);
    if (key) {
      found.push({
        bucket: "media",
        key,
        source: "media_assets",
        contentType: text(a.mime_type) ?? undefined,
      });
    }

    // Nothing writes thumbnail_path today — it is in the schema and in the
    // types and is null everywhere. It is read anyway, because a migration
    // that skips a column the schema has is a bug that surfaces the day
    // somebody starts filling it in, by which point the move is long
    // finished and the thumbnails are in the bucket nobody looks at.
    const thumb = text(a.thumbnail_path);
    if (thumb) {
      found.push({ bucket: "media", key: thumb, source: "media_assets.thumbnail" });
    }
  }

  for (const b of await readAll(
    db,
    "books",
    "id, digital_pdf_path, print_pdf_path, cover_pdf_path"
  )) {
    for (const column of ["digital_pdf_path", "print_pdf_path", "cover_pdf_path"] as const) {
      const key = text(b[column]);
      if (key) {
        found.push({ bucket: "renders", key, source: "books", contentType: "application/pdf" });
      }
    }
  }

  for (const e of await readAll(db, "archive_exports", "id, storage_path")) {
    const key = text(e.storage_path);
    if (key) {
      found.push({
        bucket: "renders",
        key,
        source: "archive_exports",
        contentType: "application/zip",
      });
    }
  }

  return dedupe(found);
}

/**
 * One object can be named by two rows — a re-render pointing both books at
 * the same cover, an export retried onto the same path. Copying it twice is
 * harmless, but the count would be wrong, and the count is the number
 * somebody checks the move against.
 */
export function dedupe(objects: StoredObject[]): StoredObject[] {
  const seen = new Map<string, StoredObject>();
  for (const object of objects) {
    const at = `${object.bucket}/${object.key}`;
    const already = seen.get(at);
    // Keep whichever entry knows a content type, so a duplicate cannot
    // downgrade a known type to a guess.
    if (!already || (!already.contentType && object.contentType)) seen.set(at, object);
  }
  return [...seen.values()];
}

/** Counts for a report, broken down the way somebody would want to check them. */
export function tally(objects: StoredObject[]): Record<string, number> {
  const counts: Record<string, number> = { total: objects.length, media: 0, renders: 0 };
  for (const object of objects) {
    counts[object.bucket]++;
    counts[object.source] = (counts[object.source] ?? 0) + 1;
  }
  return counts;
}
