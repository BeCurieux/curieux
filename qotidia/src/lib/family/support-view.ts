// Looking at a family's archive, with their permission.
//
// One rule, and everything else here follows from it:
//
//   **Every read goes through the staff member's own client.**
//
// Not adminClient(). The service credential bypasses row-level security
// entirely, so a support view built on it would ignore the grant, ignore its
// expiry, ignore the revocation, ignore the private-memory exclusion, and
// ignore the read-only rule — and would look exactly the same on screen. The
// gate 0026 added would become decoration, which is worse than not having
// built it, because the /help page now describes it.
//
// A test reads this file and fails if adminClient appears in it. That guard
// is doing more work than it looks: adminClient() is the ordinary way to
// read across families everywhere else in this codebase, so the wrong thing
// is also the habitual thing.
//
// The one exception is the write to the activity log, which uses the admin
// client on purpose. A family's record of who looked at their archive must
// not be something the looker can decline to write.

import type { SupabaseClient } from "@supabase/supabase-js";
import { record } from "@/lib/privacy/activity";

export interface Grant {
  id: string;
  familyId: string;
  familyName: string | null;
  /** What the family said they needed help with. */
  reason: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Grants that are open right now.
 *
 * The expiry is filtered here as well as in the policy. Not redundancy for
 * its own sake — support_may_read() decides what the *content* policies
 * allow, and this list is what a staff member sees before they click. An
 * expired grant appearing in a list of families to look at would be an
 * invitation to a page that correctly shows nothing, which reads as a bug
 * and teaches people to distrust the gate.
 */
export async function openGrants(db: SupabaseClient): Promise<Grant[]> {
  const now = new Date().toISOString();
  const { data } = await db
    .from("support_grants")
    .select("id, family_id, reason, expires_at, created_at")
    .is("revoked_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  // Names come back only for families whose grant is live — the families
  // policy is gated on support_may_read(). A missing name is therefore not
  // an error; it is the gate working, and the id is enough to proceed.
  const { data: families } = await db
    .from("families")
    .select("id, family_name")
    .in("id", rows.map((r) => r.family_id));
  const names = new Map((families ?? []).map((f: any) => [f.id, f.family_name]));

  return rows.map((r) => ({
    id: r.id as string,
    familyId: r.family_id as string,
    familyName: names.get(r.family_id) ?? null,
    reason: r.reason as string,
    expiresAt: r.expires_at as string,
    createdAt: r.created_at as string,
  }));
}

/** The one grant for a family, if it is open. */
export async function grantFor(db: SupabaseClient, familyId: string): Promise<Grant | null> {
  const all = await openGrants(db);
  return all.find((g) => g.familyId === familyId) ?? null;
}

/** Hours left, rounded down, floored at zero. */
export const hoursLeft = (expiresAt: string, now = new Date().toISOString()) =>
  Math.max(0, Math.floor((Date.parse(expiresAt) - Date.parse(now)) / 3_600_000));

/**
 * How long between entries in the family's log.
 *
 * Logging every page render would fill a family's activity log with noise
 * from one support session and teach them to skim it, which defeats a log
 * whose whole value is being read. Ten minutes treats a session of looking
 * as one look. Under-logging is the worse error, so this is short.
 */
export const QUIET_MINUTES = 10;

/**
 * Write it into the family's log.
 *
 * Through the admin client, deliberately. Everything else in this module
 * reads as the staff member so the database can refuse them; this one write
 * must succeed regardless, because a record of who looked that the looker
 * could suppress is not a record.
 */
export async function noteSupportLook(
  admin: SupabaseClient,
  input: { familyId: string; staffId: string; staffLabel: string; reason: string }
): Promise<boolean> {
  const since = new Date(Date.now() - QUIET_MINUTES * 60_000).toISOString();
  const { data: recent } = await admin
    .from("activity_log")
    .select("id")
    .eq("family_id", input.familyId)
    .eq("kind", "support_access_used")
    .gt("created_at", since)
    .limit(1);

  if ((recent ?? []).length > 0) return false;

  await record(admin, {
    familyId: input.familyId,
    actorId: input.staffId,
    actorLabel: input.staffLabel,
    kind: "support_access_used",
    // The family's own words about what they wanted help with, so the entry
    // reads as the thing they asked for rather than as a stranger looking.
    detail: input.reason.slice(0, 120),
  });
  return true;
}

export interface Shape {
  subjects: { id: string; name: string; bornOn: string | null }[];
  memories: number;
  photos: number;
  awaitingCheck: number;
  books: { id: string; title: string | null; year: number | null; status: string; pages: number }[];
}

/**
 * What support can actually see: the shape of the archive, not the contents.
 *
 * Counts, statuses and titles. Enough to answer "why is her book stuck" —
 * which is what the grant was given for — without a screen full of somebody
 * else's children. The policies would permit rendering the photographs; the
 * grant does not make that the right thing to put on a support page, and a
 * capability nobody built is a capability nobody misuses.
 */
export async function shapeOf(db: SupabaseClient, familyId: string): Promise<Shape> {
  const [subjects, memories, photos, awaiting] = await Promise.all([
    db.from("subjects").select("id, display_name, date_of_birth").eq("family_id", familyId),
    db.from("memories").select("id", { count: "exact", head: true }).eq("family_id", familyId),
    db.from("memories").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("type", "photo"),
    db.from("media_assets").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("scan_verdict", "pending"),
  ]);

  // Scoped by subject rather than left to row-level security. The books
  // policy would already keep another family's out — but a staff member
  // holding two open grants at once would see both families' books in one
  // list, silently, with nothing on the page to say so. Every other query
  // here names the family; this one has to as well.
  const subjectIds = (subjects.data ?? []).map((s: any) => s.id as string);
  const books = subjectIds.length
    ? await db
        .from("books")
        .select("id, title, year_number, status, page_count")
        .in("subject_id", subjectIds)
        .order("year_number")
    : { data: [] as any[] };

  return {
    subjects: (subjects.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.display_name,
      bornOn: s.date_of_birth ?? null,
    })),
    memories: memories.count ?? 0,
    photos: photos.count ?? 0,
    awaitingCheck: awaiting.count ?? 0,
    books: (books.data ?? []).map((b: any) => ({
      id: b.id,
      title: b.title ?? null,
      year: b.year_number ?? null,
      status: b.status,
      pages: b.page_count ?? 0,
    })),
  };
}
