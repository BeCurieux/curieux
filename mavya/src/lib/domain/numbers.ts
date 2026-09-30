import "server-only";
import { must, type Db } from "./db";
import { TALLY_DAYS } from "./fill";

// The records behind each number on the owner's Today page, so every figure
// can be opened and checked. Reads only, through the owner's own access.

export type NumberRow = {
  id: string;
  title: string;
  detail: string;
  when: string;
  timezone: string;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type LessonJoin = {
  starts_at: string;
  classes: { name: string; locations: { timezone: string } | null } | null;
} | null;

const childName = (c: { first_name: string; last_name: string } | null) =>
  c ? `${c.first_name} ${c.last_name}` : "A child";

// Absences reported for lessons in the next 7 days.
export async function absencesThisWeek(db: Db, now = new Date()): Promise<NumberRow[]> {
  const rows = must(
    await db
      .from("absences")
      .select(
        "id, reason, make_up_eligible, children (first_name, last_name), class_occurrences!inner (starts_at, classes (name, locations (timezone)))",
      )
      .gte("class_occurrences.starts_at", now.toISOString())
      .lt("class_occurrences.starts_at", new Date(now.getTime() + WEEK_MS).toISOString()),
  ) as unknown as {
    id: string;
    reason: string | null;
    make_up_eligible: boolean;
    children: { first_name: string; last_name: string } | null;
    class_occurrences: LessonJoin;
  }[];
  return rows
    .map((r) => ({
      id: r.id,
      title: childName(r.children),
      detail: [
        r.class_occurrences?.classes?.name,
        r.make_up_eligible ? "make-up credit issued" : "no credit",
        r.reason,
      ]
        .filter(Boolean)
        .join(" · "),
      when: r.class_occurrences!.starts_at,
      timezone: r.class_occurrences?.classes?.locations?.timezone ?? "Australia/Sydney",
    }))
    .sort((a, b) => a.when.localeCompare(b.when));
}

// Make-up credits still unused that run out in the next 7 days.
export async function creditsExpiringThisWeek(db: Db, now = new Date()): Promise<NumberRow[]> {
  const rows = must(
    await db
      .from("makeup_credits")
      .select("id, expires_at, children (first_name, last_name, families (display_name))")
      .eq("status", "available")
      .gt("expires_at", now.toISOString())
      .lt("expires_at", new Date(now.getTime() + WEEK_MS).toISOString())
      .order("expires_at"),
  ) as unknown as {
    id: string;
    expires_at: string;
    children: {
      first_name: string;
      last_name: string;
      families: { display_name: string } | null;
    } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    title: childName(r.children),
    detail: r.children?.families?.display_name ?? "",
    when: r.expires_at,
    timezone: "Australia/Sydney",
  }));
}

// Make-ups delivered in the tally's window: booked into lessons that have
// started, not cancelled.
export async function makeupsDelivered(db: Db, now = new Date()): Promise<NumberRow[]> {
  const since = new Date(now.getTime() - TALLY_DAYS * 24 * 60 * 60 * 1000);
  const rows = must(
    await db
      .from("makeup_bookings")
      .select(
        "id, children (first_name, last_name), class_occurrences!inner (starts_at, status, classes (name, locations (timezone)))",
      )
      .in("status", ["booked", "completed"])
      .neq("class_occurrences.status", "cancelled")
      .lte("class_occurrences.starts_at", now.toISOString())
      .gt("class_occurrences.starts_at", since.toISOString()),
  ) as unknown as {
    id: string;
    children: { first_name: string; last_name: string } | null;
    class_occurrences: LessonJoin;
  }[];
  return rows
    .map((r) => ({
      id: r.id,
      title: childName(r.children),
      detail: `Came to ${r.class_occurrences?.classes?.name ?? "a class"} as a make-up`,
      when: r.class_occurrences!.starts_at,
      timezone: r.class_occurrences?.classes?.locations?.timezone ?? "Australia/Sydney",
    }))
    .sort((a, b) => b.when.localeCompare(a.when));
}
