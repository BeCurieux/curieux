import { formatLessonDate } from "@/lib/format";
import { explain, must, type Db } from "./db";

// Terms and re-enrolment (docs/M6_MIGRATION_PILOT.md, M6e). The database
// checks who may do what, holds places offered for moves and applies the
// answers on the new term's first day; these are its typed doors.

export type Term = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  replyBy: string | null;
  askedAt: string | null;
  appliedAt: string | null;
};

export type Answer = "stay" | "move" | "leave";
export type Outcome = "kept" | "moved" | "left" | "move_failed";

export const ANSWER_LABELS: Record<Answer | "waiting", string> = {
  stay: "Staying",
  move: "Moving up",
  leave: "Leaving",
  waiting: "Not answered",
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  kept: "Kept their place",
  moved: "Moved",
  left: "Left",
  move_failed: "Couldn't move (class full), kept their place",
};

const toTerm = (t: {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  reply_by: string | null;
  asked_at: string | null;
  applied_at: string | null;
}): Term => ({
  id: t.id,
  name: t.name,
  startsOn: t.starts_on,
  endsOn: t.ends_on,
  replyBy: t.reply_by,
  askedAt: t.asked_at,
  appliedAt: t.applied_at,
});

const TERM_COLUMNS = "id, name, starts_on, ends_on, reply_by, asked_at, applied_at";

export async function listTerms(db: Db, organisationId: string): Promise<Term[]> {
  const { data, error } = await db
    .from("terms")
    .select(TERM_COLUMNS)
    .eq("organisation_id", organisationId)
    .order("starts_on");
  if (error) throw explain(error);
  return (data ?? []).map(toTerm);
}

export async function getTerm(db: Db, id: string): Promise<Term | null> {
  const { data, error } = await db.from("terms").select(TERM_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw explain(error);
  return data ? toTerm(data) : null;
}

export type TermInput = { name: string; startsOn: string; endsOn: string };

export async function saveTerm(
  db: Db,
  organisationId: string,
  input: TermInput,
  termId?: string,
): Promise<string> {
  return must(
    await db.rpc("save_term", {
      p_org: organisationId,
      p_name: input.name,
      p_starts_on: input.startsOn,
      p_ends_on: input.endsOn,
      p_term: termId,
    }),
  );
}

export async function deleteTerm(db: Db, termId: string) {
  const { error } = await db.rpc("delete_term", { p_term: termId });
  if (error) throw explain(error);
}

// The school's term-only choice and its timezone (for "today").
export async function termSettings(
  db: Db,
  organisationId: string,
): Promise<{ termOnly: boolean; timezone: string }> {
  const { data, error } = await db
    .from("organisations")
    .select("lessons_in_term_only, timezone")
    .eq("id", organisationId)
    .single();
  if (error) throw explain(error);
  return { termOnly: data.lessons_in_term_only, timezone: data.timezone };
}

export async function setLessonsInTermOnly(db: Db, organisationId: string, on: boolean) {
  const { error } = await db.rpc("set_lessons_in_term_only", { p_org: organisationId, p_on: on });
  if (error) throw explain(error);
}

// ------------------------------------------------------------------ asking

export async function prepareAsks(db: Db, termId: string): Promise<number> {
  const { data, error } = await db.rpc("prepare_term_asks", { p_term: termId });
  if (error) throw explain(error);
  return data ?? 0;
}

export async function askFamilies(db: Db, termId: string, replyBy: string): Promise<number> {
  const { data, error } = await db.rpc("ask_families", { p_term: termId, p_reply_by: replyBy });
  if (error) throw explain(error);
  return data ?? 0;
}

export async function remindFamilies(db: Db, termId: string): Promise<number> {
  const { data, error } = await db.rpc("remind_term_families", { p_term: termId });
  if (error) throw explain(error);
  return data ?? 0;
}

export async function offerMove(db: Db, askId: string, classId: string | null) {
  const { error } = await db.rpc("offer_term_move", {
    p_ask: askId,
    p_class: classId as string,
  });
  if (error) throw explain(error);
}

export async function answerAsk(db: Db, askId: string, answer: Answer) {
  const { error } = await db.rpc("answer_term_ask", { p_ask: askId, p_answer: answer });
  if (error) throw explain(error);
}

export type ClassNextTerm = {
  classId: string;
  capacity: number;
  staying: number;
  movingOut: number;
  leaving: number;
  waiting: number;
  movingIn: number;
  freeNextTerm: number;
};

export async function termSummary(db: Db, termId: string): Promise<ClassNextTerm[]> {
  const { data, error } = await db.rpc("term_summary", { p_term: termId });
  if (error) throw explain(error);
  return (data ?? []).map((r) => ({
    classId: r.class_id,
    capacity: r.capacity,
    staying: r.staying,
    movingOut: r.moving_out,
    leaving: r.leaving,
    waiting: r.waiting,
    movingIn: r.moving_in,
    freeNextTerm: r.free_next_term,
  }));
}

export type OwnerAsk = {
  id: string;
  childId: string;
  childName: string;
  familyId: string;
  classId: string;
  offeredClassId: string | null;
  answer: Answer | null;
  outcome: Outcome | null;
};

// Every child's question for the term, for the owner.
export async function termAsks(db: Db, termId: string): Promise<OwnerAsk[]> {
  const { data, error } = await db
    .from("reenrolment_asks")
    .select(
      "id, child_id, class_id, offered_class_id, answer, outcome, children (first_name, last_name, family_id)",
    )
    .eq("term_id", termId);
  if (error) throw explain(error);
  return (data ?? [])
    .map((a) => ({
      id: a.id,
      childId: a.child_id,
      childName: [a.children?.first_name, a.children?.last_name].filter(Boolean).join(" "),
      familyId: a.children?.family_id ?? "",
      classId: a.class_id,
      offeredClassId: a.offered_class_id,
      answer: a.answer as Answer | null,
      outcome: a.outcome as Outcome | null,
    }))
    .sort((a, b) => a.childName.localeCompare(b.childName));
}

export type ClassBrief = { name: string; weekday: number; start: string; location: string };

export type FamilyAsk = {
  id: string;
  term: string;
  startsOn: string;
  replyBy: string | null;
  school: string;
  childFirstName: string;
  current: ClassBrief;
  offered: ClassBrief | null;
  answer: Answer | null;
};

// The signed-in parent's open questions.
export async function myTermAsks(db: Db): Promise<FamilyAsk[]> {
  const { data, error } = await db.rpc("my_term_asks");
  if (error) throw explain(error);
  return (data ?? []).map((a) => ({
    id: a.id,
    term: a.term_name,
    startsOn: a.starts_on,
    replyBy: a.reply_by,
    school: a.school,
    childFirstName: a.child_first_name,
    current: {
      name: a.class_name,
      weekday: a.class_weekday,
      start: a.class_start,
      location: a.class_location,
    },
    offered: a.offered_class_name
      ? {
          name: a.offered_class_name,
          weekday: a.offered_weekday!,
          start: a.offered_start!,
          location: a.offered_location ?? "",
        }
      : null,
    answer: a.answer as Answer | null,
  }));
}

// ------------------------------------------------------------------ dates

// "2026-10-03" plus n days.
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Today's date where the school is.
export function schoolToday(timeZone = "Australia/Sydney", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export type TermStage = "planned" | "asking" | "under_way" | "finished";

export function termStage(term: Term, today: string): TermStage {
  if (term.endsOn < today) return "finished";
  if (term.startsOn <= today || term.appliedAt) return "under_way";
  if (term.askedAt) return "asking";
  return "planned";
}

// When to ask families about a term, and the reply-by date: 3 and 1 weeks
// before the term before it ends (or before this one starts, if there's
// none), never before today and always before the term starts.
export function suggestedDates(terms: Term[], term: Term, today: string) {
  const before = terms
    .filter((t) => t.endsOn < term.startsOn)
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
  const anchor = before ? before.endsOn : addDays(term.startsOn, -1);
  const askOn = addDays(anchor, -21);
  const lastReplyDay = addDays(term.startsOn, -1);
  let replyBy = addDays(anchor, -7);
  if (replyBy < today) replyBy = today;
  if (replyBy > lastReplyDay) replyBy = lastReplyDay;
  return { askOn, replyBy };
}

// "Mon 13 Oct".
export function shortDate(day: string): string {
  return formatLessonDate(`${day}T00:00:00Z`, "UTC");
}
