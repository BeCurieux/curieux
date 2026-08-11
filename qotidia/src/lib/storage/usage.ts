// What a family has used, from the database.
//
// Two reads and no judgement — the policy is in allowance.ts, which is pure
// and tested without a database.
//
// The total is the maintained one on the family rather than a sum over
// assets, because this runs on the hot path: it is checked while somebody is
// in the middle of moving a camera roll across. See migration 0021 for the
// trigger that keeps it true and the recount that proves it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { allowanceFor, roomFor, type Allowance, type Room } from "./allowance";

export async function allowanceForFamily(
  db: SupabaseClient,
  familyId: string
): Promise<Allowance> {
  const { data } = await db
    .from("families")
    .select("plan, storage_bytes, storage_blocks")
    .eq("id", familyId)
    .maybeSingle();

  return allowanceFor({
    // A family we cannot read is treated as empty rather than as full. The
    // failure mode of guessing "full" is refusing somebody's photographs
    // because of our own outage, which is the worse of the two.
    usedBytes: Number(data?.storage_bytes ?? 0),
    plan: String(data?.plan ?? "one_off"),
    extraBlocks: Number(data?.storage_blocks ?? 0),
  });
}

/** Whether one more file fits, with the sentence to show if it does not. */
export async function roomToAdd(
  db: SupabaseClient,
  familyId: string,
  incomingBytes: number
): Promise<Room> {
  return roomFor(await allowanceForFamily(db, familyId), incomingBytes);
}
