// Where a family stands, from the database.
//
// Two reads and no judgement — the policy is in free.ts, which is pure and
// tested without a database. The same split as storage/usage.ts against
// storage/allowance.ts, for the same reason.
//
// The count is of memories a family has kept, not of media assets. A
// photograph, a quote and a thirty-second recording are one memory each, and
// a family should not discover that their child's voice costs more than
// their child's face.

import type { SupabaseClient } from "@supabase/supabase-js";
import { roomForMore, standingFor, tierOf, type Standing, type Verdict } from "./free";

/** What plan a family is on and how much of the free cap they have used. */
export async function standingForFamily(
  db: SupabaseClient,
  familyId: string
): Promise<Standing> {
  const [{ data: family }, { count }] = await Promise.all([
    db.from("families").select("membership_state, paid_until").eq("id", familyId).maybeSingle(),
    db.from("memories").select("id", { count: "exact", head: true }).eq("family_id", familyId),
  ]);

  return standingFor({
    // A family we cannot read is treated as paying rather than as free. The
    // failure mode of guessing "free" is refusing somebody's photographs
    // because of our own outage — the same call storage/usage.ts makes, and
    // for the same reason.
    tier: family === null
      ? "paid"
      : tierOf({
          membershipState: (family as any).membership_state ?? null,
          paidUntil: (family as any).paid_until ?? null,
        }),
    kept: count ?? 0,
  });
}

/** Whether more may be kept, with the sentence to show if not. */
export async function mayKeepMore(
  db: SupabaseClient,
  familyId: string,
  incoming = 1
): Promise<Verdict> {
  return roomForMore(await standingForFamily(db, familyId), incoming);
}
