import "server-only";
import { must, type Db } from "./db";
import type { ClassSummary } from "./timetable";

// Real lessons with who's away and who's coming as a make-up. Reads only;
// row level security decides what each caller sees.

export type LessonState = {
  // Children reported away, by child: the absence id.
  away: Map<string, string>;
  // Children booked in as make-ups, by child: the booking id.
  makeups: Map<string, string>;
};

const emptyState = (): LessonState => ({ away: new Map(), makeups: new Map() });

export async function lessonStates(
  db: Db,
  occurrenceIds: string[],
): Promise<Map<string, LessonState>> {
  const states = new Map<string, LessonState>(occurrenceIds.map((id) => [id, emptyState()]));
  if (occurrenceIds.length === 0) return states;
  const [absences, bookings] = await Promise.all([
    db.from("absences").select("id, child_id, occurrence_id").in("occurrence_id", occurrenceIds),
    db
      .from("makeup_bookings")
      .select("id, child_id, target_occurrence_id")
      .eq("status", "booked")
      .in("target_occurrence_id", occurrenceIds),
  ]);
  for (const a of must(absences)) states.get(a.occurrence_id)?.away.set(a.child_id, a.id);
  for (const b of must(bookings)) states.get(b.target_occurrence_id)?.makeups.set(b.child_id, b.id);
  return states;
}

export type Lesson = { id: string; startsAt: string; endsAt: string };

// Each class's next lesson that hasn't finished, skipping cancelled ones.
export async function nextLessons(db: Db, classIds: string[]): Promise<Map<string, Lesson>> {
  const next = new Map<string, Lesson>();
  if (classIds.length === 0) return next;
  const rows = must(
    await db
      .from("class_occurrences")
      .select("id, class_id, starts_at, ends_at")
      .in("class_id", classIds)
      .eq("status", "scheduled")
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
  );
  for (const r of rows) {
    if (!next.has(r.class_id))
      next.set(r.class_id, { id: r.id, startsAt: r.starts_at, endsAt: r.ends_at });
  }
  return next;
}

export type ClassView = ClassSummary & {
  lesson: Lesson | null;
  absences: number;
  makeups: number;
  // Children expected at the next lesson.
  expected: number;
  // Places an absence has freed that no make-up has taken yet (Fill Empty
  // Spots, M5).
  temporaryVacancies: number;
  occupancy: number;
};

// Classes with their next lesson's numbers.
export async function classViews(db: Db, classes: ClassSummary[]): Promise<ClassView[]> {
  const lessons = await nextLessons(
    db,
    classes.map((c) => c.id),
  );
  const states = await lessonStates(
    db,
    [...lessons.values()].map((l) => l.id),
  );
  return classes.map((c) => {
    const lesson = lessons.get(c.id) ?? null;
    const state = lesson ? states.get(lesson.id) : undefined;
    const absences = state?.away.size ?? 0;
    const makeups = state?.makeups.size ?? 0;
    const expected = c.enrolled - absences + makeups;
    return {
      ...c,
      lesson,
      absences,
      makeups,
      expected,
      temporaryVacancies: Math.max(0, absences - makeups),
      occupancy: c.capacity ? Math.round((expected / c.capacity) * 100) : 0,
    };
  });
}

export async function classView(db: Db, c: ClassSummary): Promise<ClassView> {
  return (await classViews(db, [c]))[0]!;
}

// ------------------------------------------------------------------ owners

export type OwnerNumbers = {
  expectedToday: number;
  absencesThisWeek: number;
  temporaryVacancies: number;
  creditsExpiringThisWeek: number;
  capacityPercent: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The Today page's numbers for the owner's organisation.
export async function ownerNumbers(
  db: Db,
  views: ClassView[],
  now = new Date(),
): Promise<OwnerNumbers> {
  const weekAhead = new Date(now.getTime() + WEEK_MS).toISOString();
  const [absences, credits] = await Promise.all([
    db
      .from("absences")
      .select("id, class_occurrences!inner (starts_at)", { count: "exact", head: true })
      .gte("class_occurrences.starts_at", now.toISOString())
      .lt("class_occurrences.starts_at", weekAhead),
    db
      .from("makeup_credits")
      .select("id", { count: "exact", head: true })
      .eq("status", "available")
      .gt("expires_at", now.toISOString())
      .lt("expires_at", weekAhead),
  ]);
  if (absences.error) throw absences.error;
  if (credits.error) throw credits.error;
  const today = (iso: string, tz: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const capacity = views.reduce((sum, c) => sum + c.capacity, 0);
  const expected = views.reduce((sum, c) => sum + c.expected, 0);
  return {
    expectedToday: views
      .filter((c) => c.lesson && today(c.lesson.startsAt, c.timezone))
      .reduce((sum, c) => sum + c.expected, 0),
    absencesThisWeek: absences.count ?? 0,
    temporaryVacancies: views.reduce((sum, c) => sum + c.temporaryVacancies, 0),
    creditsExpiringThisWeek: credits.count ?? 0,
    capacityPercent: capacity ? Math.round((expected / capacity) * 100) : 0,
  };
}

// ------------------------------------------------------------------ families

export type FamilyLesson = {
  occurrenceId: string;
  classId: string;
  childId: string;
  startsAt: string;
  status: "scheduled" | "cancelled" | "completed";
  kind: "regular" | "makeup";
  // Set when the child is reported away (regular) or booked (make-up).
  absenceId: string | null;
  bookingId: string | null;
};

// A family's lessons in the next `days`: each child's regular lessons, with
// any reported absence, and their booked make-ups.
export async function familyLessons(
  db: Db,
  children: { id: string; classIds: string[] }[],
  days = 7,
  now = new Date(),
): Promise<FamilyLesson[]> {
  const childIds = children.map((c) => c.id);
  const classIds = [...new Set(children.flatMap((c) => c.classIds))];
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const [occurrences, absences, bookings] = await Promise.all([
    classIds.length
      ? db
          .from("class_occurrences")
          .select("id, class_id, starts_at, ends_at, status")
          .in("class_id", classIds)
          .gt("ends_at", now.toISOString())
          .lt("starts_at", until)
          .order("starts_at")
      : Promise.resolve({ data: [], error: null }),
    childIds.length
      ? db.from("absences").select("id, child_id, occurrence_id").in("child_id", childIds)
      : Promise.resolve({ data: [], error: null }),
    childIds.length
      ? db
          .from("makeup_bookings")
          .select(
            "id, child_id, class_occurrences!inner (id, class_id, starts_at, ends_at, status)",
          )
          .eq("status", "booked")
          .in("child_id", childIds)
          .gt("class_occurrences.ends_at", now.toISOString())
          .lt("class_occurrences.starts_at", until)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const away = new Map(
    (must(absences) as { id: string; child_id: string; occurrence_id: string }[]).map((a) => [
      `${a.child_id}:${a.occurrence_id}`,
      a.id,
    ]),
  );
  const lessons: FamilyLesson[] = [];
  for (const o of must(occurrences) as {
    id: string;
    class_id: string;
    starts_at: string;
    status: FamilyLesson["status"];
  }[]) {
    for (const child of children) {
      if (!child.classIds.includes(o.class_id)) continue;
      lessons.push({
        occurrenceId: o.id,
        classId: o.class_id,
        childId: child.id,
        startsAt: o.starts_at,
        status: o.status,
        kind: "regular",
        absenceId: away.get(`${child.id}:${o.id}`) ?? null,
        bookingId: null,
      });
    }
  }
  for (const b of must(bookings) as unknown as {
    id: string;
    child_id: string;
    class_occurrences: {
      id: string;
      class_id: string;
      starts_at: string;
      status: FamilyLesson["status"];
    };
  }[]) {
    lessons.push({
      occurrenceId: b.class_occurrences.id,
      classId: b.class_occurrences.class_id,
      childId: b.child_id,
      startsAt: b.class_occurrences.starts_at,
      status: b.class_occurrences.status,
      kind: "makeup",
      absenceId: null,
      bookingId: b.id,
    });
  }
  return lessons.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// The caller's children's upcoming make-up bookings and absences, by id.
export async function lessonStatesForChildren(db: Db, now = new Date()) {
  const [bookings, absences] = await Promise.all([
    db
      .from("makeup_bookings")
      .select("id, class_occurrences!inner (starts_at)")
      .eq("status", "booked")
      .gt("class_occurrences.starts_at", now.toISOString()),
    db
      .from("absences")
      .select("id, class_occurrences!inner (starts_at)")
      .gt("class_occurrences.starts_at", now.toISOString()),
  ]);
  return {
    bookings: must(bookings).map((b) => b.id),
    absences: must(absences).map((a) => a.id),
  };
}
