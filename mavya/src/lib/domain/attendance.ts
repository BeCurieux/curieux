import "server-only";
import { must, type Db } from "./db";

// Attendance for one lesson (docs/M3_ATTENDANCE_PROGRESS.md). Who may mark
// which child, and when, is decided by the database's record_attendance;
// this only reads and forwards.

export type AttendanceStatus = "present" | "absent" | "makeup";

// Attendance opens an hour before a lesson and stays open for 14 days. The
// database enforces the same window; this only chooses which lesson to show.
const OPENS_BEFORE_MS = 60 * 60 * 1000;
const CLOSES_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export type CurrentLesson = {
  id: string;
  startsAt: string;
  // False for a lesson that hasn't opened yet, shown so the page can say when.
  open: boolean;
};

// The lesson on now or most recently, or else the next one.
export async function currentLessons(
  db: Db,
  classIds: string[],
  now = new Date(),
): Promise<Map<string, CurrentLesson>> {
  const lessons = new Map<string, CurrentLesson>();
  if (classIds.length === 0) return lessons;
  const rows = must(
    await db
      .from("class_occurrences")
      .select("id, class_id, starts_at")
      .in("class_id", classIds)
      .neq("status", "cancelled")
      .gte("starts_at", new Date(now.getTime() - CLOSES_AFTER_MS).toISOString())
      .order("starts_at"),
  );
  const opensBy = now.getTime() + OPENS_BEFORE_MS;
  for (const r of rows) {
    const open = new Date(r.starts_at).getTime() <= opensBy;
    const seen = lessons.get(r.class_id);
    // Rows are oldest first: keep the latest open lesson, else the first upcoming one.
    if (open) lessons.set(r.class_id, { id: r.id, startsAt: r.starts_at, open });
    else if (!seen) lessons.set(r.class_id, { id: r.id, startsAt: r.starts_at, open });
  }
  return lessons;
}

export async function currentLesson(db: Db, classId: string, now = new Date()) {
  return (await currentLessons(db, [classId], now)).get(classId) ?? null;
}

// Each marked child's status for these lessons, by lesson then child.
export async function lessonAttendance(
  db: Db,
  occurrenceIds: string[],
): Promise<Map<string, Map<string, AttendanceStatus>>> {
  const byLesson = new Map<string, Map<string, AttendanceStatus>>();
  if (occurrenceIds.length === 0) return byLesson;
  const rows = must(
    await db
      .from("attendance")
      .select("occurrence_id, child_id, status")
      .in("occurrence_id", occurrenceIds),
  );
  for (const r of rows) {
    const lesson = byLesson.get(r.occurrence_id) ?? new Map<string, AttendanceStatus>();
    lesson.set(r.child_id, r.status as AttendanceStatus);
    byLesson.set(r.occurrence_id, lesson);
  }
  return byLesson;
}

export async function recordAttendance(
  db: Db,
  input: { occurrenceId: string; childId: string; status: "present" | "absent" },
) {
  const { error } = await db.rpc("record_attendance", {
    p_occurrence_id: input.occurrenceId,
    p_child_id: input.childId,
    p_status: input.status,
  });
  must({ data: true, error });
}
