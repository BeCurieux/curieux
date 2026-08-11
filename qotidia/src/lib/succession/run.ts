// Running succession.
//
// Two passes, both idempotent, both driven by the daily sweep.
//
//   watch    — advance every open claim: remind, refuse, or hand over.
//   listen   — notice archives that have gone quiet for long enough that
//              their keeper should be offered them without anybody asking.
//
// Every decision about *whether* something should happen lives in policy.ts.
// This file is the plumbing, and it is deliberately dull: the interesting
// part of succession is the rules, and rules mixed into database calls are
// rules nobody can check.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOnce } from "@/lib/email/send";
import {
  successionClaimed, successionCompleted, successionRefused,
} from "@/lib/email/messages";
import { record } from "@/lib/privacy/activity";
import { friendlyDate } from "@/lib/words";
import {
  NOTICE_DAYS, SETTLING_DAYS, SILENT_FOR_DAYS,
  daysBetween, decidesAtFor, next, silenceOpens, type Claim,
} from "./policy";

interface ClaimRow {
  id: string;
  family_id: string;
  keeper_email: string;
  opening: "claimed" | "silence";
  status: string;
  opened_at: string;
  decides_at: string;
  reminded_on: number[];
}

/** Who to write to, and what to call them. */
async function ownerOf(db: SupabaseClient, familyId: string) {
  const { data } = await db
    .from("families")
    .select("owner_user_id, family_name, profiles:owner_user_id(email, last_seen_at)")
    .eq("id", familyId)
    .maybeSingle();
  if (!data) return null;
  const profile = (data as any).profiles;
  return {
    userId: (data as any).owner_user_id as string,
    familyName: ((data as any).family_name as string) ?? "The archive",
    email: (profile?.email as string) ?? null,
    lastSeenAt: (profile?.last_seen_at as string) ?? null,
  };
}

/**
 * Advance every claim currently in its notice period.
 *
 * Safe to run twice in a day, or not at all for three days. Reminders are
 * chosen by how far into the notice we are rather than counted, and the
 * refusal check is measured against when the claim opened rather than when
 * we last looked — so a sweep that misses a run cannot let a handover
 * through that a sign-in should have stopped.
 */
export async function watchClaims(db: SupabaseClient, now = new Date().toISOString()) {
  const { data: claims } = await db
    .from("succession_claims")
    .select("*")
    .eq("status", "notice");

  for (const row of (claims ?? []) as ClaimRow[]) {
    const owner = await ownerOf(db, row.family_id);
    if (!owner) continue;

    const claim: Claim = {
      status: "notice",
      opening: row.opening,
      openedAt: row.opened_at,
      decidesAt: row.decides_at,
      ownerSeenAt: owner.lastSeenAt,
      remindedOn: row.reminded_on ?? [],
    };

    const move = next(claim, now);

    if (move.do === "refuse") {
      await settle(db, row, "refused", "the owner signed in");
      if (row.keeper_email) {
        await sendOnce(db, {
          kind: "succession_refused",
          message: successionRefused({
            to: { email: row.keeper_email },
            ownerLabel: owner.familyName,
          }),
          dedupeKey: `succession-refused-${row.id}`,
        });
      }
      await record(db, {
        familyId: row.family_id,
        actorId: null,
        actorLabel: row.keeper_email,
        kind: "succession_refused",
        detail: `asked to take over the archive; stopped because the owner signed in`,
      });
      continue;
    }

    if (move.do === "remind") {
      // The owner is written to on a fixed schedule through the notice
      // period. The dedupe key carries the day, so each one goes exactly
      // once no matter how the sweep runs.
      if (owner.email) {
        await sendOnce(db, {
          kind: "succession_claimed",
          message: successionClaimed({
            to: { email: owner.email },
            keeperEmail: row.keeper_email,
            decidesOn: friendlyDate(row.decides_at),
            daysLeft: Math.max(0, daysBetween(now, row.decides_at)),
          }),
          dedupeKey: `succession-notice-${row.id}-day-${move.dayIntoNotice}`,
          userId: owner.userId,
        });
      }
      await db
        .from("succession_claims")
        .update({ reminded_on: [...(row.reminded_on ?? []), move.dayIntoNotice] })
        .eq("id", row.id);
      continue;
    }

    if (move.do === "hand over") {
      await completeHandover(db, row, owner.familyName);
    }
  }
}

/** Give the archive to the keeper. */
async function completeHandover(db: SupabaseClient, row: ClaimRow, familyName: string) {
  // The keeper needs an account before they can be given anything. If they
  // have not made one, the claim stays open rather than completing into
  // nowhere — and they keep being told.
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .ilike("email", row.keeper_email)
    .maybeSingle();

  if (!profile) {
    console.warn(
      `[succession] ${row.id} is ready but ${row.keeper_email} has no account yet; waiting`
    );
    return;
  }

  await db.rpc("hand_over_family", { fid: row.family_id, to_user: (profile as any).id });
  await settle(db, row, "completed", "the notice period ended");

  await sendOnce(db, {
    kind: "succession_completed",
    message: successionCompleted({
      to: { email: row.keeper_email },
      familyLabel: familyName,
    }),
    dedupeKey: `succession-done-${row.id}`,
    userId: (profile as any).id,
  });

  await record(db, {
    familyId: row.family_id,
    actorId: null,
    actorLabel: row.keeper_email,
    kind: "succession_completed",
    detail: `took over the archive as its keeper`,
  });
}

async function settle(db: SupabaseClient, row: ClaimRow, status: string, because: string) {
  await db
    .from("succession_claims")
    .update({ status, settled_at: new Date().toISOString(), settled_because: because })
    .eq("id", row.id)
    // Only if it is still open. Two sweeps overlapping must not settle the
    // same claim twice and send two emails about it.
    .eq("status", "notice");
}

/**
 * Open claims for archives nobody has touched in a very long time.
 *
 * This is the path that works when there is nobody left who knows to ask.
 * It requires a named keeper — an archive with nobody named simply waits,
 * because finding somebody to hand a family's private life to is not a
 * problem we should be solving on their behalf.
 */
export async function listenForSilence(db: SupabaseClient, now = new Date().toISOString()) {
  // Only families whose owner has been quiet long enough to be worth
  // looking at, rather than every family in the database.
  const cutoff = new Date(new Date(now).getTime() - SILENT_FOR_DAYS * 86_400_000).toISOString();

  // Asked of profiles directly rather than as a filter on an embedded
  // resource. Filtering a join through PostgREST works until it quietly
  // does not, and the failure mode of this particular query going wrong is
  // handing somebody's archive to somebody else.
  const { data: sleepers } = await db
    .from("profiles")
    .select("id, last_seen_at")
    .or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`);

  if (!sleepers?.length) return;
  const seenBy = new Map<string, string | null>(
    (sleepers as any[]).map((p) => [p.id as string, (p.last_seen_at as string) ?? null])
  );

  const { data: quiet } = await db
    .from("families")
    .select("id, created_at, owner_user_id")
    .in("owner_user_id", [...seenBy.keys()]);

  for (const family of (quiet ?? []) as any[]) {
    const { data: keepers } = await db
      .from("family_keepers")
      .select("id, email, named_at, declined_at")
      .eq("family_id", family.id)
      .is("declined_at", null)
      .order("named_at", { ascending: true })
      .limit(1);

    const keeper = keepers?.[0] as any;
    if (!keeper) continue;

    const { count } = await db
      .from("succession_claims")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("status", "notice");

    const opens = silenceOpens({
      hasKeeper: true,
      ownerSeenAt: seenBy.get(family.owner_user_id) ?? null,
      createdAt: family.created_at,
      openClaims: count ?? 0,
      now,
    });
    if (!opens) continue;

    await openClaim(db, {
      familyId: family.id,
      keeperId: keeper.id,
      keeperEmail: keeper.email,
      opening: "silence",
      now,
    });
  }
}

/**
 * Start the notice period.
 *
 * Shared by both openings so there is one place that decides what a claim
 * looks like on day zero — and so the unique index on open claims is hit by
 * both paths rather than only the one somebody remembered.
 */
export async function openClaim(
  db: SupabaseClient,
  input: {
    familyId: string;
    keeperId: string | null;
    keeperEmail: string;
    opening: "claimed" | "silence";
    now?: string;
  }
) {
  const now = input.now ?? new Date().toISOString();
  const { data, error } = await db
    .from("succession_claims")
    .insert({
      family_id: input.familyId,
      keeper_id: input.keeperId,
      keeper_email: input.keeperEmail,
      opening: input.opening,
      opened_at: now,
      decides_at: decidesAtFor(now),
    })
    .select("id")
    .single();

  // A duplicate is the unique index doing its job: somebody else opened one
  // between our check and our insert. Not a fault.
  if (error) {
    if ((error as any).code === "23505") return null;
    throw new Error(error.message);
  }

  await record(db, {
    familyId: input.familyId,
    actorId: null,
    actorLabel: input.keeperEmail,
    kind: "succession_claimed",
    detail:
      input.opening === "silence"
        ? `no one has signed in for ${SILENT_FOR_DAYS} days, so the archive's keeper has been offered it`
        : `asked to take over the archive; the owner has ${NOTICE_DAYS} days to stop it`,
  });

  // The first notice goes out on the next sweep, through the same reminder
  // path as the rest — rather than being sent here and then again by the
  // day-zero reminder.
  return (data as any)?.id as string;
}

export const SUCCESSION_TIMINGS = { SETTLING_DAYS, NOTICE_DAYS, SILENT_FOR_DAYS };
