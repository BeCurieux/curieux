import "server-only";
import { must, type Db } from "./db";

// A parent's notifications (docs/M3_ATTENDANCE_PROGRESS.md). The database
// creates them when a skill is achieved and stores ids only; names are
// looked up here, with the parent's own access, after they've signed in.

export type AppNotification = {
  id: string;
  organisation: string;
  childFirstName: string;
  skill: string;
  createdAt: string;
  unread: boolean;
};

export async function myNotifications(db: Db, limit = 30): Promise<AppNotification[]> {
  const rows = must(
    await db
      .from("notifications")
      .select("id, organisation_id, payload_json, created_at, read_at")
      .eq("type", "skill_achieved")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  if (rows.length === 0) return [];
  const payload = (p: unknown) => (p ?? {}) as { child_id?: string; skill_id?: string };
  const childIds = [...new Set(rows.flatMap((r) => payload(r.payload_json).child_id ?? []))];
  const skillIds = [...new Set(rows.flatMap((r) => payload(r.payload_json).skill_id ?? []))];
  const [children, skills, organisations] = await Promise.all([
    db.from("children").select("id, first_name").in("id", childIds),
    db.from("skills").select("id, name").in("id", skillIds),
    db.from("organisations").select("id, name"),
  ]);
  const childNames = new Map(must(children).map((c) => [c.id, c.first_name]));
  const skillNames = new Map(must(skills).map((s) => [s.id, s.name]));
  const orgNames = new Map(must(organisations).map((o) => [o.id, o.name]));
  return rows.flatMap((r) => {
    const { child_id, skill_id } = payload(r.payload_json);
    const child = child_id ? childNames.get(child_id) : undefined;
    // A child who has left the family is no longer this parent's to hear about.
    if (!child) return [];
    return [
      {
        id: r.id,
        organisation: (r.organisation_id && orgNames.get(r.organisation_id)) || "",
        childFirstName: child,
        skill: (skill_id && skillNames.get(skill_id)) || "a new skill",
        createdAt: r.created_at,
        unread: r.read_at === null,
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
