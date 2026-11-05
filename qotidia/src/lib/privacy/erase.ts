// Deleting everything, for real.
//
// "Contact us and we'll assess your request" is not deletion. This is: the
// files go from storage, the rows go from the database, and what remains is
// a single dated record that a deletion happened — kept because we have to
// be able to prove we did it, and because a deletion record that itself gets
// deleted proves nothing.
//
// The order matters. Storage objects are removed first, because a row is the
// only thing that tells us where a file is: delete the rows first and the
// photographs become unreachable orphans that are still there. That is the
// difference between deleted and merely invisible.
//
// Every select here is paged, for the same reason. PostgREST returns the
// first thousand rows and does not mention it, so an unpaged read of a large
// family's assets deletes what it saw and silently leaves the rest — and
// then deletes the rows that said where the rest lived.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getObjectStore } from "@/lib/storage/provider";
import { readAllPages } from "@/lib/supabase/paged";

/** How long encrypted backups take to roll off, stated honestly. */
export const BACKUP_EXPIRY_DAYS = 30;

export interface EraseResult {
  filesRemoved: number;
  subjectsRemoved: number;
}

export async function eraseFamily(
  db: SupabaseClient,
  familyId: string
): Promise<EraseResult> {
  const subjects = await readAllPages<{ id: string }>("subjects", (from, to) =>
    db.from("subjects").select("id").eq("family_id", familyId).order("id").range(from, to)
  );
  const subjectIds = subjects.map((s) => s.id);

  // 1. Every stored object, found while the rows still point at them.
  const paths: string[] = [];
  if (subjectIds.length) {
    const assets = await readAllPages<{
      storage_path: string | null;
      thumbnail_path: string | null;
    }>("media_assets", (from, to) =>
      db
        .from("media_assets")
        .select("id, storage_path, thumbnail_path, memories!inner(subject_id)")
        .in("memories.subject_id", subjectIds)
        .order("id")
        .range(from, to)
    );
    for (const a of assets) {
      if (a.storage_path) paths.push(a.storage_path);
      // The thumbnail too. It is a derived copy of the same photograph and
      // nothing about the word "deleted" makes an exception for a smaller
      // one. Nothing writes thumbnail_path today, which is exactly why it
      // is easy to leave out here and impossible to notice afterwards: the
      // day something starts filling it in, this quietly stops being true.
      if (a.thumbnail_path) paths.push(a.thumbnail_path);
    }
  }
  // Batching is the store's problem now — it knows what its own API can
  // carry, and a decade of photographs is more than one call should.
  if (paths.length) await getObjectStore().remove("media", paths);

  const renders: string[] = [];
  if (subjectIds.length) {
    const books = await readAllPages<{
      print_pdf_path: string | null;
      digital_pdf_path: string | null;
      cover_pdf_path: string | null;
    }>("books", (from, to) =>
      db
        .from("books")
        .select("id, print_pdf_path, digital_pdf_path, cover_pdf_path")
        .in("subject_id", subjectIds)
        .order("id")
        .range(from, to)
    );
    for (const b of books) {
      for (const p of [b.print_pdf_path, b.digital_pdf_path, b.cover_pdf_path]) {
        if (p) renders.push(p);
      }
    }
  }
  // Any export archives too — those are the most complete copy that exists.
  const exports_ = await readAllPages<{ storage_path: string | null }>(
    "archive_exports",
    (from, to) =>
      db
        .from("archive_exports")
        .select("id, storage_path")
        .eq("family_id", familyId)
        .order("id")
        .range(from, to)
  );
  for (const e of exports_) if (e.storage_path) renders.push(e.storage_path);

  if (renders.length) await getObjectStore().remove("renders", renders);

  // 2. The rows. Every table cascades from families, so one delete is enough
  //    — but the cascade is asserted in tests rather than assumed here.
  await db.from("families").delete().eq("id", familyId);

  return { filesRemoved: paths.length + renders.length, subjectsRemoved: subjectIds.length };
}

/**
 * The wording shown to someone before they press it. Precise about what is
 * immediate and what is not, because "deleted instantly" is not true of any
 * system that takes backups, and a promise that is not true is worse than a
 * slower one that is.
 */
export const DELETION_TERMS =
  `Every photograph, recording, note and book will be removed from our live ` +
  `systems straight away and cannot be recovered — not by you, and not by us. ` +
  `Encrypted backup copies roll off within ${BACKUP_EXPIRY_DAYS} days and are ` +
  `never restored except to recover from a failure affecting everyone. ` +
  `Anyone you invited loses access immediately.`;
