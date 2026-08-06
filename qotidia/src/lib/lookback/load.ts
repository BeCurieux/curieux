// Getting today's look-back out of the database.
//
// Kept apart from the engine so the engine stays pure and every branch of it
// is testable without a database. This half does two things and nothing
// else: fetch, and resolve the photographs.
//
// It reads dated memories across every year rather than the current one. An
// archive that only looks back within the year it is collecting would go
// quiet in January, which is exactly when a parent most wants to be shown
// something.

import type { SupabaseClient } from "@supabase/supabase-js";
import { lookBackFor, type LookBack, type LookBackCandidate } from "./engine";
import { resolvePhotoUrls } from "@/lib/book/photos";
import type { FamilyRole } from "@/lib/family/roles";

/** Today where the family lives, not where the server is. */
export function todayIso(now: Date = new Date(), timeZone = "Australia/Sydney"): string {
  // en-CA renders ISO order, which is the one formatting shortcut here that
  // is not a hack: it is the documented output for that locale.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export interface LoadedLookBack extends LookBack {
  /** Signed URLs by memory id, for whichever of them have a photograph. */
  photoUrls: Map<string, string>;
}

export async function loadLookBack(
  db: SupabaseClient,
  subjectId: string,
  viewer: { userId: string; role: FamilyRole | null },
  today = todayIso()
): Promise<LoadedLookBack> {
  const { data: rows } = await db
    .from("memories")
    .select("id, memory_date, type, raw_text, transcript, contribution_status, created_by, visibility")
    .eq("subject_id", subjectId)
    .not("memory_date", "is", null)
    // Bounded so a ten-year archive does not pull everything on every page
    // load. Ordered by date so what comes back is the recent decade, which
    // is where a look-back is going to land anyway.
    .order("memory_date", { ascending: false })
    .limit(4000);

  const candidates: LookBackCandidate[] = (rows ?? []).map((m: any) => ({
    id: m.id,
    date: m.memory_date,
    type: m.type,
    text: m.raw_text ?? m.transcript ?? null,
    hasPhoto: m.type === "photo",
    contributionStatus: m.contribution_status ?? "approved",
    createdBy: m.created_by,
    visibility: m.visibility ?? "family",
  }));

  const { data: things } = await db
    .from("little_things")
    .select("category, value, recorded_date")
    .eq("subject_id", subjectId);

  const now = Date.parse(today);
  const littleThings = (things ?? []).map((t: any) => ({
    category: t.category,
    value: t.value,
    // recorded_date, not created_at: what matters is how long ago the fact
    // was true, not when the row happened to be written.
    monthsOld: t.recorded_date
      ? Math.floor((now - Date.parse(t.recorded_date)) / (30 * 86_400_000))
      : 0,
  }));

  const look = lookBackFor({ today, memories: candidates, littleThings, viewer });

  // Only the ones actually being shown get a signed URL. resolvePhotoUrls
  // applies the scan gate, so a photograph that has not been read
  // server-side does not appear here either.
  const photoUrls = await resolvePhotoUrls(
    db,
    look.memories.filter((m) => m.hasPhoto).map((m) => m.id)
  );

  return { ...look, photoUrls };
}
