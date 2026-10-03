import "server-only";
import { dayName, formatTime, shortDay } from "@/lib/format";
import { explain, must, type Db } from "./db";

// Locations, programs, levels and classes. What a caller sees is decided by
// row level security: owners and instructors get their organisation's
// timetable, parents only the classes their children are in.

export type Location = {
  id: string;
  name: string;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  timezone: string;
  active: boolean;
};

export type Level = { id: string; name: string; sortOrder: number };
export type Program = { id: string; name: string; levels: Level[] };

export type ClassSummary = {
  id: string;
  organisationId: string;
  name: string;
  levelId: string;
  level: string;
  programId: string;
  program: string;
  locationId: string;
  location: string;
  timezone: string;
  instructorId: string | null;
  weekday: number;
  day: string;
  shortDay: string;
  startTime: string;
  time: string;
  durationMinutes: number;
  capacity: number;
  // M7a: what one lesson costs, in cents; none means not charged.
  pricePerLessonCents: number | null;
  active: boolean;
  enrolled: number;
  nextLesson: string | null;
};

export type Lesson = {
  id: string;
  startsAt: string;
  status: "scheduled" | "cancelled" | "completed";
};

// ------------------------------------------------------------------ locations

export async function listLocations(db: Db): Promise<Location[]> {
  const rows = must(await db.from("locations").select("*").order("name"));
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    addressLine1: l.address_line1,
    suburb: l.suburb,
    state: l.state,
    postcode: l.postcode,
    timezone: l.timezone,
    active: l.active,
  }));
}

export type LocationInput = {
  name: string;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  timezone: string;
};

const locationRow = (input: LocationInput) => ({
  name: input.name,
  address_line1: input.addressLine1,
  suburb: input.suburb,
  state: input.state,
  postcode: input.postcode,
  timezone: input.timezone,
});

export async function createLocation(db: Db, organisationId: string, input: LocationInput) {
  return must(
    await db
      .from("locations")
      .insert({ organisation_id: organisationId, ...locationRow(input) })
      .select("id")
      .single(),
  ).id;
}

export async function updateLocation(db: Db, id: string, input: LocationInput) {
  must(await db.from("locations").update(locationRow(input)).eq("id", id).select("id").single());
}

// ------------------------------------------------------------------ programs

export async function listPrograms(db: Db): Promise<Program[]> {
  const [programs, levels] = await Promise.all([
    db.from("programs").select("id, name").eq("active", true).order("name"),
    db
      .from("levels")
      .select("id, name, sort_order, program_id")
      .eq("active", true)
      .order("sort_order"),
  ]);
  return must(programs).map((p) => ({
    id: p.id,
    name: p.name,
    levels: must(levels)
      .filter((l) => l.program_id === p.id)
      .map((l) => ({ id: l.id, name: l.name, sortOrder: l.sort_order })),
  }));
}

export async function createProgram(db: Db, organisationId: string, name: string) {
  return must(
    await db
      .from("programs")
      .insert({ organisation_id: organisationId, name })
      .select("id")
      .single(),
  ).id;
}

// New levels go after the program's existing ones.
export async function addLevel(db: Db, organisationId: string, programId: string, name: string) {
  const existing = must(await db.from("levels").select("sort_order").eq("program_id", programId));
  const next = existing.reduce((max, l) => Math.max(max, l.sort_order), 0) + 1;
  return must(
    await db
      .from("levels")
      .insert({ organisation_id: organisationId, program_id: programId, name, sort_order: next })
      .select("id")
      .single(),
  ).id;
}

// ------------------------------------------------------------------ classes

const CLASS_COLUMNS =
  "id, organisation_id, name, weekday, start_time, duration_minutes, capacity, price_per_lesson_cents, active, instructor_id, level_id, program_id, location_id, levels!classes_organisation_id_level_id_fkey (name), programs (name), locations (name, timezone)";

type ClassRow = {
  id: string;
  organisation_id: string;
  name: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  price_per_lesson_cents: number | null;
  active: boolean;
  instructor_id: string | null;
  level_id: string;
  program_id: string;
  location_id: string;
  levels: { name: string } | null;
  programs: { name: string } | null;
  locations: { name: string; timezone: string } | null;
};

function toSummary(row: ClassRow, enrolled: number, nextLesson: string | null): ClassSummary {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    levelId: row.level_id,
    level: row.levels?.name ?? "",
    programId: row.program_id,
    program: row.programs?.name ?? "",
    locationId: row.location_id,
    location: row.locations?.name ?? "",
    timezone: row.locations?.timezone ?? "Australia/Sydney",
    instructorId: row.instructor_id,
    weekday: row.weekday,
    day: dayName(row.weekday),
    shortDay: shortDay(row.weekday),
    startTime: row.start_time.slice(0, 5),
    time: formatTime(row.start_time),
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    pricePerLessonCents: row.price_per_lesson_cents,
    active: row.active,
    enrolled,
    nextLesson,
  };
}

async function enrolledCounts(db: Db, classIds: string[]) {
  const counts = new Map<string, number>();
  if (classIds.length === 0) return counts;
  const rows = must(
    await db.from("enrolments").select("class_id").eq("status", "active").in("class_id", classIds),
  );
  for (const r of rows) counts.set(r.class_id, (counts.get(r.class_id) ?? 0) + 1);
  return counts;
}

async function nextLessons(db: Db, classIds: string[]) {
  const next = new Map<string, string>();
  if (classIds.length === 0) return next;
  const rows = must(
    await db
      .from("class_occurrences")
      .select("class_id, starts_at")
      .in("class_id", classIds)
      .eq("status", "scheduled")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at"),
  );
  for (const r of rows) if (!next.has(r.class_id)) next.set(r.class_id, r.starts_at);
  return next;
}

// Sorted Monday first, then by start time.
export async function listClasses(
  db: Db,
  filter: { activeOnly?: boolean; instructorId?: string } = {},
): Promise<ClassSummary[]> {
  let query = db.from("classes").select(CLASS_COLUMNS).order("weekday").order("start_time");
  if (filter.activeOnly) query = query.eq("active", true);
  if (filter.instructorId) query = query.eq("instructor_id", filter.instructorId);
  const rows = must(await query) as unknown as ClassRow[];
  const ids = rows.map((r) => r.id);
  const [counts, next] = await Promise.all([enrolledCounts(db, ids), nextLessons(db, ids)]);
  return rows.map((r) => toSummary(r, counts.get(r.id) ?? 0, next.get(r.id) ?? null));
}

export async function getClass(db: Db, id: string): Promise<ClassSummary | null> {
  const { data, error } = await db.from("classes").select(CLASS_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw explain(error);
  if (!data) return null;
  const [counts, next] = await Promise.all([enrolledCounts(db, [id]), nextLessons(db, [id])]);
  return toSummary(data as unknown as ClassRow, counts.get(id) ?? 0, next.get(id) ?? null);
}

export async function upcomingLessons(db: Db, classId: string, limit = 12): Promise<Lesson[]> {
  const rows = must(
    await db
      .from("class_occurrences")
      .select("id, starts_at, status")
      .eq("class_id", classId)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(limit),
  );
  return rows.map((r) => ({
    id: r.id,
    startsAt: r.starts_at,
    status: r.status as Lesson["status"],
  }));
}

export type ClassInput = {
  name: string;
  locationId: string;
  programId: string;
  levelId: string;
  instructorId: string | null;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  // Left out (undefined) keeps the price as it is.
  pricePerLessonCents?: number | null;
};

const classRow = (input: ClassInput) => ({
  name: input.name,
  location_id: input.locationId,
  program_id: input.programId,
  level_id: input.levelId,
  instructor_id: input.instructorId,
  weekday: input.weekday,
  start_time: input.startTime,
  duration_minutes: input.durationMinutes,
  capacity: input.capacity,
  ...(input.pricePerLessonCents !== undefined
    ? { price_per_lesson_cents: input.pricePerLessonCents }
    : {}),
});

// The database schedules the class's lessons as soon as it exists.
export async function createClass(db: Db, organisationId: string, input: ClassInput) {
  return must(
    await db
      .from("classes")
      .insert({ organisation_id: organisationId, ...classRow(input) })
      .select("id")
      .single(),
  ).id;
}

export async function updateClass(db: Db, id: string, input: ClassInput) {
  must(await db.from("classes").update(classRow(input)).eq("id", id).select("id").single());
}

export async function setClassActive(db: Db, id: string, active: boolean) {
  must(await db.from("classes").update({ active }).eq("id", id).select("id").single());
}

// ------------------------------------------------------------------ staff

export type Instructor = { membershipId: string; name: string };

// Staff who can be given a class. Owners see their staff's names.
export async function listInstructors(db: Db, organisationId: string): Promise<Instructor[]> {
  const memberships = must(
    await db
      .from("staff_memberships")
      .select("id, user_id, role")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
  );
  const users = must(
    await db
      .from("users")
      .select("id, name")
      .in(
        "id",
        memberships.map((m) => m.user_id),
      ),
  );
  const names = new Map(users.map((u) => [u.id, u.name]));
  return memberships
    .map((m) => ({ membershipId: m.id, name: names.get(m.user_id) ?? "Staff member" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
