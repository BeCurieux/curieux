// Finding an account, without opening an archive.
//
// A support email says "I'm Sarah, my book is stuck". Until now there was no
// way to get from an email address to anything at all — which meant every
// question, however mundane, either went unanswered or went through the
// service credential and a SQL editor, which is the worst of both worlds:
// unlogged, unbounded, and available for a question about a payment.
//
// So there is a lookup, and the whole design is the line it draws.
//
//   **Without a grant you see the account. With one you see the archive.**
//
// The account is the things a company legitimately knows about a customer
// because they are a customer: their email, when they joined, what they pay,
// whether the card is failing, how much space they use, whether they have
// asked us to look. None of it is a memory and none of it is a child.
//
// The archive — the children's names, what is in it, how much of it there is
// — is behind a grant, in lib/family/support-view.ts, where it was already.
// This page links to that and cannot substitute for it.
//
// The distinction that took some thought is the free cap. "Why can't I add
// anything?" is a real support question and it is answerable only by knowing
// how a family stands against the cap — so this returns *whether they are at
// it*, and not the count. The state answers the question; the number is the
// size of their archive, which is theirs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_MEMORIES, tierOf, type Tier } from "@/lib/billing/free";
import { asSize } from "@/lib/storage/allowance";

export interface Account {
  familyId: string;
  email: string | null;
  joined: string;
  tier: Tier;
  plan: string;
  membershipState: string;
  paidUntil: string | null;
  storage: string;
  /** How many people are in the family. Not who. */
  people: number;
  /** At the free cap, so nothing more can be added. Never the count itself. */
  atFreeCap: boolean;
  /** Open support grant, if there is one. */
  grantOpenUntil: string | null;
}

/**
 * Look somebody up by email.
 *
 * Exact match, lowercased. Deliberately not a prefix or fuzzy search: this
 * is for answering an email from a named person, not for browsing the
 * customer list, and a search box that returns everybody matching "sa" is a
 * browsing tool wearing a lookup's clothes.
 */
export async function findByEmail(
  admin: SupabaseClient,
  email: string
): Promise<Account[]> {
  const wanted = email.trim().toLowerCase();
  if (!wanted.includes("@")) return [];

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, created_at")
    .eq("email", wanted)
    .maybeSingle();
  if (!profile) return [];

  const { data: memberships } = await admin
    .from("family_memberships")
    .select("family_id")
    .eq("user_id", (profile as any).id);

  const ids = ((memberships ?? []) as any[]).map((m) => m.family_id);
  if (ids.length === 0) return [];

  const [{ data: families }, { data: grants }, { data: people }] = await Promise.all([
    admin
      .from("families")
      .select("id, created_at, plan, membership_state, paid_until, storage_bytes")
      .in("id", ids),
    admin
      .from("support_grants")
      .select("family_id, expires_at")
      .in("family_id", ids)
      .is("revoked_at", null),
    admin.from("family_memberships").select("family_id").in("family_id", ids),
  ]);

  // The cap, as a state rather than a number. See the note at the top.
  const counts = await Promise.all(
    ids.map(async (id) => {
      const { count } = await admin
        .from("memories")
        .select("id", { count: "exact", head: true })
        .eq("family_id", id);
      return [id, count ?? 0] as const;
    })
  );
  const keptBy = new Map(counts);

  const now = new Date().toISOString();
  const headcount = new Map<string, number>();
  for (const row of (people ?? []) as any[]) {
    headcount.set(row.family_id, (headcount.get(row.family_id) ?? 0) + 1);
  }

  return ((families ?? []) as any[]).map((f) => {
    const tier = tierOf({ membershipState: f.membership_state, paidUntil: f.paid_until, now });
    const grant = ((grants ?? []) as any[])
      .filter((g) => g.family_id === f.id && g.expires_at > now)
      .sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];

    return {
      familyId: f.id,
      email: (profile as any).email ?? null,
      joined: f.created_at,
      tier,
      plan: f.plan,
      membershipState: f.membership_state,
      paidUntil: f.paid_until ?? null,
      storage: asSize(Number(f.storage_bytes ?? 0)),
      people: headcount.get(f.id) ?? 0,
      atFreeCap: tier === "free" && (keptBy.get(f.id) ?? 0) >= FREE_MEMORIES,
      grantOpenUntil: grant?.expires_at ?? null,
    };
  });
}

/**
 * What this lookup will never show, however convenient it would be.
 *
 * Each of these is archive rather than account, and each is behind the grant
 * a family gives. Listed so the boundary is a thing somebody has to argue
 * with rather than a thing they can drift past, and checked by
 * tests/admin.test.ts.
 */
export const NOT_HERE = [
  "a child's name, or their birthday",
  "how many memories are in the archive",
  "anything anybody wrote",
  "photographs, or a link to one",
  "book titles",
] as const;
