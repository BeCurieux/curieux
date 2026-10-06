import { explain, type Db } from "./db";

// Support access (docs/M6_MIGRATION_PILOT.md, M6g): a school lets Ovyko
// support in for 48 hours; support sees how it's set up, never who is in
// it; every look is recorded for the school's owners.

export type SupportGrant = { note: string | null; expiresAt: string };

// The school's open grant, if it hasn't run out.
export async function openSupportGrant(
  db: Db,
  organisationId: string,
): Promise<SupportGrant | null> {
  const { data, error } = await db
    .from("support_grants")
    .select("note, expires_at")
    .eq("organisation_id", organisationId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw explain(error);
  return data ? { note: data.note, expiresAt: data.expires_at } : null;
}

export async function grantSupportAccess(db: Db, organisationId: string, note: string) {
  const { data, error } = await db.rpc("grant_support_access", {
    p_org: organisationId,
    p_note: note,
  });
  if (error) throw explain(error);
  return data;
}

export async function endSupportAccess(db: Db, organisationId: string) {
  const { error } = await db.rpc("end_support_access", { p_org: organisationId });
  if (error) throw explain(error);
}

export async function supportLooks(db: Db, organisationId: string) {
  const { data, error } = await db.rpc("support_looks", { p_org: organisationId });
  if (error) throw explain(error);
  return (data ?? []).map((l) => ({ lookedAt: l.looked_at, lookedBy: l.looked_by }));
}

// For Ovyko support: the schools that have let support in right now.
export async function supportSchools(db: Db) {
  const { data, error } = await db.rpc("support_schools");
  if (error) throw explain(error);
  return (data ?? []).map((s) => ({
    organisationId: s.organisation_id,
    name: s.name,
    note: s.note,
    expiresAt: s.expires_at,
  }));
}

export type SupportView = {
  school: {
    name: string;
    activity_type: string;
    timezone: string;
    status: string;
    created_at: string;
    is_demo: boolean;
    lessons_in_term_only: boolean;
    fee_reminders: boolean;
    instalments_on: boolean;
    voucher_schemes: string[];
    owner_two_step_required: boolean;
  };
  grant: { note: string | null; expires_at: string } | null;
  staff: Record<string, number>;
  locations: { name: string; suburb: string | null; timezone: string; active: boolean }[];
  levels: { program: string; level: string; active: boolean }[];
  classes: {
    name: string;
    level: string;
    location: string;
    weekday: number;
    start_time: string;
    duration_minutes: number;
    capacity: number;
    enrolled: number;
    has_instructor: boolean;
    price_per_lesson_cents: number | null;
    active: boolean;
  }[];
  terms: { name: string; starts_on: string; ends_on: string; asked: boolean; applied: boolean }[];
  families: { count: number; joined: number; children_enrolled: number };
  payments: {
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
  } | null;
  plan: {
    status: string | null;
    locations: number | null;
    trial_end: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  trial_ends: string;
  imports: {
    created_at: string;
    counts: Record<string, unknown>;
    problems: number;
    undone: boolean;
  }[];
  emails_7d: { kind: string; status: string; count: number }[];
};

// One look at a school, recorded on the school. Null when it isn't open.
export async function supportSchoolView(
  db: Db,
  organisationId: string,
): Promise<SupportView | null> {
  const { data, error } = await db.rpc("support_school_view", { p_org: organisationId });
  if (error?.code === "42501") return null;
  if (error) throw explain(error);
  return data as unknown as SupportView;
}
