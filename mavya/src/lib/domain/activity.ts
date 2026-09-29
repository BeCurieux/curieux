import "server-only";
import { must, type Db } from "./db";

// The organisation's audit trail, described in plain language.

export type ActivityItem = { id: string; when: string; who: string; what: string };

const NOUN: Record<string, string> = {
  locations: "location",
  programs: "program",
  levels: "level",
  classes: "class",
  class_occurrences: "lesson",
  families: "family",
  children: "child",
  enrolments: "enrolment",
  staff_memberships: "staff member",
};

type Row = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  actor_user_id: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
};

function label(row: Row): string {
  const data = row.after_json ?? row.before_json ?? {};
  if (row.entity_type === "children")
    return `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
  if (row.entity_type === "families") return String(data.display_name ?? "");
  if (typeof data.name === "string") return data.name;
  return "";
}

function describe(row: Row): string {
  const noun = NOUN[row.entity_type] ?? row.entity_type;
  const name = label(row);
  const named = name ? ` ${noun} “${name}”` : ` ${noun}`;
  if (row.entity_type === "enrolments") {
    if (row.action === "insert") return "Enrolled a child";
    if (row.after_json?.status === "ended") return "Ended an enrolment";
  }
  if (row.entity_type === "staff_memberships" && row.action === "update") {
    if (row.after_json?.status === "suspended") return "Removed a staff member's access";
    if (row.after_json?.status === "active") return "Gave a staff member access again";
  }
  if (row.action === "insert") return `Added${named}`;
  if (row.action === "delete") return `Removed${named}`;
  return `Updated${named}`;
}

export async function recentActivity(
  db: Db,
  organisationId: string,
  limit = 50,
): Promise<ActivityItem[]> {
  const rows = must(
    await db
      .from("audit_events")
      .select("id, created_at, action, entity_type, actor_user_id, before_json, after_json")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ) as Row[];
  const actorIds = [
    ...new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => Boolean(id))),
  ];
  const actors = actorIds.length
    ? must(await db.from("users").select("id, name").in("id", actorIds))
    : [];
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({
    id: r.id,
    when: r.created_at,
    who: r.actor_user_id ? (names.get(r.actor_user_id) ?? "A former staff member") : "Oviko setup",
    what: describe(r),
  }));
}
