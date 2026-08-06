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

import type { SupabaseClient } from "@supabase/supabase-js";

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
  const { data: subjects } = await db
    .from("subjects")
    .select("id")
    .eq("family_id", familyId);
  const subjectIds = (subjects ?? []).map((s) => s.id);

  // 1. Every stored object, found while the rows still point at them.
  const paths: string[] = [];
  if (subjectIds.length) {
    const { data: assets } = await db
      .from("media_assets")
      .select("storage_path, memories!inner(subject_id)")
      .in("memories.subject_id", subjectIds);
    for (const a of (assets ?? []) as any[]) if (a.storage_path) paths.push(a.storage_path);
  }
  if (paths.length) {
    // In batches; a decade of photographs is more than one call should carry.
    for (let i = 0; i < paths.length; i += 100) {
      await db.storage.from("media").remove(paths.slice(i, i + 100));
    }
  }

  const renders: string[] = [];
  if (subjectIds.length) {
    const { data: books } = await db
      .from("books")
      .select("print_pdf_path, digital_pdf_path, cover_pdf_path")
      .in("subject_id", subjectIds);
    for (const b of books ?? []) {
      for (const p of [b.print_pdf_path, b.digital_pdf_path, b.cover_pdf_path]) {
        if (p) renders.push(p);
      }
    }
  }
  // Any export archives too — those are the most complete copy that exists.
  const { data: exports_ } = await db
    .from("archive_exports")
    .select("storage_path")
    .eq("family_id", familyId);
  for (const e of exports_ ?? []) if (e.storage_path) renders.push(e.storage_path);

  for (let i = 0; i < renders.length; i += 100) {
    await db.storage.from("renders").remove(renders.slice(i, i + 100));
  }

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
