// Reading the book-in-progress out of the archive.
//
// Six queries and no judgement — every decision worth arguing about is in
// forming.ts, which is pure and testable without a database. The one thing
// this does decide is *which period* the book covers, and it takes that from
// the book row when there is one so the projection and the real thing can
// never be about different years.

import type { SupabaseClient } from "@supabase/supabase-js";
import { bookSoFar, type BookSoFar } from "./forming";
import { startingYear } from "@/lib/onboarding/start";
import { todayIso } from "@/lib/time";
import { loadStoryMemories } from "@/lib/memories/scope";

export async function loadBookSoFar(
  db: SupabaseClient,
  subjectId: string,
  today = todayIso()
): Promise<BookSoFar | null> {
  const { data: subject } = await db
    .from("subjects")
    .select("id, family_id, display_name, subject_type, date_of_birth")
    .eq("id", subjectId)
    .single();
  if (!subject) return null;

  // The period. Taken from the book being collected when there is one, so
  // this screen and the real generator are always talking about the same
  // twelve months — a projection of a different year is worse than no
  // projection, because it looks right.
  const { data: book } = await db
    .from("books")
    .select("start_date, end_date, year_number")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const period = book?.start_date
    ? { start: book.start_date, end: book.end_date, yearNumber: book.year_number }
    : fallbackPeriod(subject, today);

  const memories = await loadStoryMemories(db, subject as any, {
    approvedOnly: true,
    familyVisibleOnly: true,
    // Undated memories count towards the archive but cannot be placed in a
    // period, and the real generator keeps them for the same reason.
    from: period.start,
    to: period.end,
  });

  const { data: clusterRows } = await db
    .from("memory_clusters")
    .select("*, cluster_memories(memory_id)")
    .eq("subject_id", subjectId);

  const clusters = ((clusterRows ?? []) as any[]).map((c) => ({
    ...c,
    memory_ids: (c.cluster_memories ?? []).map((cm: any) => cm.memory_id),
  }));

  const { data: littleThings } = await db
    .from("little_things")
    .select("*")
    .eq("subject_id", subjectId);

  return bookSoFar({
    subject,
    yearNumber: period.yearNumber ?? null,
    calendarYear: subject.subject_type === "family" ? Number(period.start.slice(0, 4)) : null,
    memories,
    clusters: clusters.filter((c) => c.status === "confirmed"),
    suggestedClusters: clusters.filter((c) => c.status === "suggested"),
    littleThings: littleThings ?? [],
    quotes: memories.filter((m) => m.type === "quote"),
    periodStart: period.start,
    periodEnd: period.end,
    today,
  });
}

/**
 * The period when no book has been started.
 *
 * A child's year runs birthday to birthday; everything else runs the
 * calendar. Both are what the real generator would choose, which is the only
 * property that matters here.
 */
function fallbackPeriod(subject: any, today: string) {
  if (subject.subject_type === "child" && subject.date_of_birth) {
    const year = startingYear(subject.date_of_birth, new Date(`${today}T00:00:00Z`));
    return { start: year.startDate, end: year.endDate, yearNumber: year.yearNumber };
  }
  const y = today.slice(0, 4);
  return { start: `${y}-01-01`, end: `${y}-12-31`, yearNumber: null };
}
