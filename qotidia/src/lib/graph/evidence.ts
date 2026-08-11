// What an observation was counted from.
//
// Every line this product says about a family carries the memory ids it was
// computed from — presence.ts, notice.ts, context.ts and the discovery
// engine all do it, and until now nothing showed them to anybody. The rule
// existed; the receipt did not.
//
// That gap is the thing worth closing. "The dinosaur hat, four times this
// week" is either a fact about the archive or a product being plausible, and
// the only difference a parent can perceive is whether they can look. Being
// able to look is also what makes the *wrong* ones safe: an observation a
// family can check is one they can correct, and a correction is worth more
// than the observation was.
//
// This is deliberately not a "sources" footnote in small grey type. It is
// the photographs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVABLE_VERDICT } from "@/lib/media/verify";
import { resolvePhotoUrls } from "@/lib/book/photos";

export interface Evidence {
  memoryId: string;
  /** ISO date, or null for something undated. */
  date: string | null;
  /** What the family wrote, if they wrote anything. */
  text: string | null;
  /** A short-lived signed URL, when there is a photograph and it is servable. */
  photoUrl: string | null;
}

/**
 * How many to resolve.
 *
 * Twelve. An observation counted from forty memories does not need forty
 * thumbnails to be believed — it needs enough to recognise, and the count
 * beside them is the claim. Resolving forty signed URLs to render a
 * disclosure nobody may open is also the wrong amount of work.
 */
export const MOST_SHOWN = 12;

/**
 * Load the memories behind an observation.
 *
 * Reads through the caller's own client, so row-level security decides what
 * comes back: an observation shown to a contributor resolves only to the
 * memories that contributor may see. That matters — the weekly note is
 * computed server-side from the whole archive, and the receipt must not
 * become a way to read past the wall the rest of the product maintains.
 */
export async function evidenceFor(
  db: SupabaseClient,
  memoryIds: string[],
  limit = MOST_SHOWN
): Promise<Evidence[]> {
  const ids = [...new Set(memoryIds)].filter(Boolean);
  if (ids.length === 0) return [];

  const { data } = await db
    .from("memories")
    .select("id, memory_date, raw_text, type")
    .in("id", ids)
    .order("memory_date", { ascending: true });

  const rows = (data ?? []).slice(0, limit) as any[];
  if (rows.length === 0) return [];

  // Photographs only for the ones that have one and have been read. The
  // same gate as everywhere else — a receipt is not a reason to serve a
  // file nothing has checked.
  const photoIds = rows.filter((r) => r.type === "photo").map((r) => r.id as string);
  const urls = photoIds.length ? await resolvePhotoUrls(db, photoIds) : new Map<string, string>();

  return rows.map((r) => ({
    memoryId: r.id as string,
    date: (r.memory_date as string) ?? null,
    text: (r.raw_text as string) ?? null,
    photoUrl: urls.get(r.id as string) ?? null,
  }));
}

/** Whether it is worth offering to show. One memory is not evidence. */
export const worthShowing = (memoryIds: string[]) => memoryIds.length >= 2;

export { SERVABLE_VERDICT };
