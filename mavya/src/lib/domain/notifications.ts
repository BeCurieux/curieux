import "server-only";
import { must, type Db } from "./db";
import { offerDetails, type OfferDetails } from "./fill";

// A parent's notifications. The database creates them when a skill is
// achieved (M3), a lesson is cancelled (M4) or a spot is offered (M5) and
// stores ids only (and an offer's claim code); names are looked up here,
// with the parent's own access, after they've signed in.

export type AppNotification = {
  id: string;
  kind: "skill_achieved" | "lesson_cancelled" | "spot_offered";
  organisation: string;
  childFirstName: string;
  // The skill achieved, or the cancelled lesson's start.
  skill: string;
  lessonStartsAt: string | null;
  lessonTimezone: string | null;
  createdAt: string;
  unread: boolean;
  // For a spot offered: its claim code and what it offers, while the offer
  // is theirs to see.
  offer: { code: string; details: OfferDetails } | null;
};

export async function myNotifications(db: Db, limit = 30): Promise<AppNotification[]> {
  const rows = must(
    await db
      .from("notifications")
      .select("id, type, organisation_id, payload_json, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  if (rows.length === 0) return [];
  const payload = (p: unknown) =>
    (p ?? {}) as { child_id?: string; skill_id?: string; occurrence_id?: string; code?: string };
  const childIds = [...new Set(rows.flatMap((r) => payload(r.payload_json).child_id ?? []))];
  const skillIds = [...new Set(rows.flatMap((r) => payload(r.payload_json).skill_id ?? []))];
  const lessonIds = [...new Set(rows.flatMap((r) => payload(r.payload_json).occurrence_id ?? []))];
  const codes = [...new Set(rows.flatMap((r) => payload(r.payload_json).code ?? []))];
  const [children, skills, organisations, lessons, offers] = await Promise.all([
    db.from("children").select("id, first_name").in("id", childIds),
    db.from("skills").select("id, name").in("id", skillIds),
    db.from("organisations").select("id, name"),
    db
      .from("class_occurrences")
      .select("id, starts_at, classes (locations (timezone))")
      .in("id", lessonIds),
    Promise.all(codes.map(async (code) => [code, await offerDetails(db, code)] as const)),
  ]);
  const offerByCode = new Map(offers);
  const childNames = new Map(must(children).map((c) => [c.id, c.first_name]));
  const skillNames = new Map(must(skills).map((s) => [s.id, s.name]));
  const orgNames = new Map(must(organisations).map((o) => [o.id, o.name]));
  const lessonTimes = new Map(
    (
      must(lessons) as unknown as {
        id: string;
        starts_at: string;
        classes: { locations: { timezone: string } | null } | null;
      }[]
    ).map((l) => [l.id, { startsAt: l.starts_at, tz: l.classes?.locations?.timezone ?? null }]),
  );
  return rows.flatMap((r) => {
    const { child_id, skill_id, occurrence_id, code } = payload(r.payload_json);
    const offer = code ? offerByCode.get(code) : null;
    // An offered spot's lesson isn't in the family's classes; its time comes
    // with the offer.
    const lesson = offer
      ? { startsAt: offer.startsAt, tz: offer.timezone }
      : occurrence_id
        ? lessonTimes.get(occurrence_id)
        : undefined;
    const child = child_id ? childNames.get(child_id) : undefined;
    // A child who has left the family is no longer this parent's to hear about.
    if (!child) return [];
    return [
      {
        id: r.id,
        kind: r.type as AppNotification["kind"],
        lessonStartsAt: lesson?.startsAt ?? null,
        lessonTimezone: lesson?.tz ?? null,
        organisation: (r.organisation_id && orgNames.get(r.organisation_id)) || "",
        childFirstName: child,
        skill: (skill_id && skillNames.get(skill_id)) || "a new skill",
        createdAt: r.created_at,
        unread: r.read_at === null,
        offer: code && offer ? { code, details: offer } : null,
      },
    ];
  });
}

export async function unreadCount(db: Db): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markAllRead(db: Db) {
  const { error } = await db.rpc("mark_notifications_read");
  must({ data: true, error });
}

// What an email subject or push preview says (docs/SECURITY.md, "Neutral
// notifications"): never the child's name, the skill or a place, because
// these show on lock screens and in shared inboxes. Details wait until the
// parent has signed in. Used when email and push delivery arrive (M6).
export function outboundMessage(organisation: string): { subject: string; preview: string } {
  const from = organisation.trim() || "your activity provider";
  return {
    subject: `New progress update from ${from}`,
    preview: "Sign in to Ovyko to see it.",
  };
}
