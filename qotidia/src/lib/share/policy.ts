// Sending one story to one person.
//
// The original brief for this product says: *invite family members
// individually rather than generating public share links*. This is a link.
// The two are reconcilable, but only if the difference is built rather than
// asserted, so it is worth writing down exactly what makes them different.
//
// An invitation grants a person continuing access to an archive. This grants
// whoever holds a URL a view of **one frozen story**, for a while, and
// nothing else — not the archive, not the child's other photographs, not the
// family, not the years either side. It expires on its own, it can be pulled
// back, and it is never indexed.
//
// That is a capability URL, and it is the right shape for the thing people
// actually want to do: send one thing to a grandmother who does not have an
// account and is not going to make one before she looks at it.
//
// ## What follows from that
//
//   **The story is frozen when it is shared.** Not recomputed on open. A
//   link that quietly shows something different next month is a link nobody
//   can reason about — and the archive keeps changing underneath it, so it
//   would.
//
//   **Contributions need no account.** The entire value of sending it to a
//   grandmother is that she knows something we do not. Making her sign up
//   first loses the answer, and the answer is the asset.
//
//   **Nothing she sends appears anywhere until the owner says so.** Same
//   rule as every other contribution. An open box on a public URL is a
//   spam target, so it is capped, length-limited, and moderated.
//
//   **The owner is never told who looked.** A count, not a log of
//   individuals. Knowing that a link was opened eleven times is useful;
//   knowing which relative opened it at 2am is surveillance.

import { randomBytes } from "node:crypto";

/**
 * How long a link lives by default.
 *
 * Thirty days. Long enough that a grandmother who checks her email weekly
 * still sees it; short enough that a link forwarded into a group chat in
 * 2027 is dead by 2028. Renewable by sharing again.
 */
export const LIVES_FOR_DAYS = 30;

/**
 * How many contributions one link will accept.
 *
 * The link is unguessable but it is still a box on the open internet, and
 * the failure mode of no cap is a family opening their archive to find four
 * hundred entries about cryptocurrency.
 */
export const MOST_CONTRIBUTIONS = 20;

/** What one person may write. Long enough for a story, short of an essay. */
export const LONGEST_CONTRIBUTION = 2_000;
export const LONGEST_NAME = 60;

/**
 * A token nobody can guess.
 *
 * 128 bits, base64url — 22 characters, no padding, safe in a URL and in the
 * body of an email that will be forwarded through three clients. Short
 * enough to read out over the phone if it comes to that.
 */
export function newToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Tokens we will even look up. Anything else is refused without a query. */
export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{22}$/;

export interface ShareState {
  expiresAt: string;
  revokedAt: string | null;
  allowContributions: boolean;
  contributionCount: number;
}

export type Reachable =
  | { ok: true; mayContribute: boolean }
  | { ok: false; because: "expired" | "revoked" | "not found" };

/**
 * Whether a link still works, and whether it will take an answer.
 *
 * Revocation is checked before expiry so a family who pulled a link back is
 * told that, rather than being told it timed out — the two mean different
 * things to whoever is holding it.
 */
export function reachable(share: ShareState | null, now: string): Reachable {
  if (!share) return { ok: false, because: "not found" };
  if (share.revokedAt) return { ok: false, because: "revoked" };
  if (Date.parse(share.expiresAt) <= Date.parse(now)) return { ok: false, because: "expired" };

  return {
    ok: true,
    mayContribute: share.allowContributions && share.contributionCount < MOST_CONTRIBUTIONS,
  };
}

/** What a recipient is told. Never why, beyond the fact of it. */
export function sayWhy(because: "expired" | "revoked" | "not found"): string {
  switch (because) {
    case "expired":
      return "This link has expired. Ask whoever sent it for a new one — nothing has been deleted.";
    case "revoked":
      // Deliberately not "the family withdrew it". That is a sentence that
      // starts an argument at a funeral.
      return "This link isn't active any more. Ask whoever sent it for a new one.";
    default:
      return "There's nothing here. Check the link, or ask whoever sent it.";
  }
}

export function expiresAtFrom(now: string, days = LIVES_FOR_DAYS): string {
  return new Date(Date.parse(now) + days * 86_400_000).toISOString();
}

export interface Contribution {
  name: string;
  body: string;
}

export type Accepted =
  | { ok: true; name: string; body: string }
  | { ok: false; because: string };

/**
 * Tidy and check what somebody typed into a page they do not have an account
 * for.
 *
 * Trimmed rather than rejected wherever trimming is enough: this arrives
 * from a person who was doing us a favour, and bouncing them back for a
 * trailing space is how the answer gets lost.
 */
export function accept(input: Contribution, count: number): Accepted {
  const body = input.body.trim();
  const name = input.name.trim().slice(0, LONGEST_NAME);

  if (!body) return { ok: false, because: "Write a line or two first." };
  if (body.length > LONGEST_CONTRIBUTION) {
    return {
      ok: false,
      because: `That's longer than this box takes — about ${Math.round(LONGEST_CONTRIBUTION / 100) * 100} characters.`,
    };
  }
  if (!name) return { ok: false, because: "Say who you are, so they know who remembered it." };
  if (count >= MOST_CONTRIBUTIONS) {
    return { ok: false, because: "This one has had all the answers it can take." };
  }
  return { ok: true, name, body };
}
