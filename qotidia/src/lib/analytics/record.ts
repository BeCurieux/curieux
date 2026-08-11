// Writing an event, and the pseudonym that makes a funnel possible.
//
// Two properties matter more than anything else here.
//
//   **It never fails the thing it is measuring.** Every call is wrapped and
//   swallowed. An archive that refuses a parent's photographs because an
//   analytics insert timed out has got its priorities exactly backwards, and
//   the activity log module already made this decision for the same reason.
//
//   **It cannot be reversed.** The pseudonym is a keyed hash of the user id
//   and the current window. Without ANALYTICS_SALT it is not invertible; with
//   it, all you can do is confirm a guess about a user you had already named,
//   within one sixty-day window. Nobody can be followed from one window to
//   the next, including us.
//
// The salt is required in production and absent in development, where events
// go nowhere. That is deliberate: an analytics pipeline that silently works
// in a developer's browser is one that has been tested against nothing and
// is collecting from somebody's laptop.

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Event, type EventName, windowOf } from "./events";

/** Bounds a count so precision cannot turn it into an identifier. */
const MOST = 10_000;

/**
 * The pseudonym for this person, in this window.
 *
 * Returns null when there is no salt, which is how development and tests
 * end up recording nothing at all rather than recording something weakly
 * pseudonymised.
 */
export function pseudonym(userId: string, nowIso = new Date().toISOString()): string | null {
  const salt = process.env.ANALYTICS_SALT;
  if (!salt) return null;
  return createHmac("sha256", salt)
    .update(`${userId}:${windowOf(nowIso)}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Record that something happened.
 *
 * Takes a user id and immediately throws it away — the id is the input to
 * the pseudonym and is never a column. Nothing else about the person, the
 * family or the content crosses this boundary, because there is no parameter
 * for it.
 */
export async function note(
  db: SupabaseClient,
  userId: string,
  event: Event,
  nowIso = new Date().toISOString()
): Promise<void> {
  try {
    const who = pseudonym(userId, nowIso);
    // No salt configured: nothing is recorded. Preferable to recording
    // something that only looks anonymous.
    if (!who) return;

    await db.from("analytics_events").insert({
      name: event.name,
      who,
      count: event.count === undefined ? null : Math.min(Math.max(0, Math.round(event.count)), MOST),
    });
  } catch {
    // Deliberately silent. See the note at the top of this file: an upload
    // must never fail because of a measurement.
  }
}

/** Count of each event in a period. The only read this module offers. */
export async function tally(
  db: SupabaseClient,
  since: string
): Promise<Record<string, number>> {
  const { data } = await db
    .from("analytics_events")
    .select("name, who")
    .gte("created_at", since)
    .limit(200_000);

  // Distinct people per step, not raw event counts — a funnel drawn from
  // event counts says a family who uploaded four times is four families, and
  // every step below the first looks better than it is.
  const seen = new Map<string, Set<string>>();
  for (const row of (data ?? []) as { name: EventName; who: string }[]) {
    if (!seen.has(row.name)) seen.set(row.name, new Set());
    seen.get(row.name)!.add(row.who);
  }

  const out: Record<string, number> = {};
  for (const [name, people] of seen) out[name] = people.size;
  return out;
}
