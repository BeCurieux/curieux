// Where the wall stands, and what it may never stand in front of.
//
// The second half is the important one. A paywall in a product like this can
// be built two ways, and only one of them survives being read aloud to the
// person paying: you may charge for room to keep more, and you may never
// charge somebody to read, download or delete what they already kept.
//
// That is not a preference. plans.ts already promised it — "everything you've
// kept stays yours to read and to download, for as long as you want it; we
// never delete a family's archive for not paying" — and a free tier that
// contradicted it would make the older sentence a lie. So NEVER_PAYWALLED is
// checked against the code rather than admired in a comment.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLEARS_THE_WOW, FREE_BYTES, FREE_MEMORIES, NEVER_PAYWALLED, TELL_THEM_AT,
  WHAT_PAYING_ADDS, roomForMore, standingFor, tierOf,
} from "@/lib/billing/free";
import { ACCESS_AFTER_CANCELLING } from "@/lib/billing/plans";
import { ENOUGH_TO_NOTICE } from "@/lib/graph/first-look";
import { MIN_MEMORIES_FOR_A_BOOK } from "@/lib/renewal/policy";
import { ENOUGH_FOR_A_FILM } from "@/lib/film/cut";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const free = (kept: number) => standingFor({ tier: "free", kept });

describe("the free tier is the real product, not a locked one", () => {
  it("clears every threshold at which this product starts working", () => {
    // A cap near these would put the wall exactly where the product first
    // becomes interesting, which is both cynical and bad business: nobody
    // pays for a thing they were stopped from seeing work.
    expect(FREE_MEMORIES).toBeGreaterThan(ENOUGH_TO_NOTICE * 4);
    expect(FREE_MEMORIES).toBeGreaterThan(ENOUGH_FOR_A_FILM * 4);
    expect(CLEARS_THE_WOW).toBe(true);
  });

  it("is unmistakably short of a year, so the book is what you pay for", () => {
    expect(FREE_MEMORIES).toBeGreaterThan(MIN_MEMORIES_FOR_A_BOOK);
    expect(FREE_MEMORIES).toBeLessThan(500);
  });

  it("leaves room for a recording among the photographs", () => {
    // A hundred phone photographs is nearer 300MB. The rest is so that the
    // one clip of them singing is not the thing that hits the wall.
    expect(FREE_BYTES / FREE_MEMORIES).toBeGreaterThan(5_000_000);
  });

  it("describes what paying adds, not what free is missing", () => {
    // A page enumerating what has been taken away reads as a punishment for
    // not having paid yet.
    const said = WHAT_PAYING_ADDS.join(" ");
    expect(said).not.toMatch(/\b(unlock|locked|upgrade to|limited|restricted)\b/i);
    expect(WHAT_PAYING_ADDS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("what the wall may never stand in front of", () => {
  it("never charges anybody to read what they kept", () => {
    expect(ACCESS_AFTER_CANCELLING.read).toBe(true);
    expect(NEVER_PAYWALLED).toContain("reading everything you have kept");
  });

  it("never charges anybody to leave with it", () => {
    // Charging for an export is charging somebody to leave, which is the
    // one thing this product has repeatedly said it will not do.
    expect(ACCESS_AFTER_CANCELLING.export).toBe(true);
    expect(NEVER_PAYWALLED).toContain("downloading all of it, at original quality");
    expect(NEVER_PAYWALLED).toContain("deleting all of it, permanently");
  });

  it("never gates the pages that are about safety rather than product", () => {
    for (const item of ["the activity log", "privacy and security settings",
                        "naming somebody to inherit the archive"]) {
      expect(NEVER_PAYWALLED).toContain(item);
    }
  });

  it("and the code agrees: nothing on that list checks the tier", () => {
    // The list is only worth having if it is true of the code. These are the
    // routes and modules behind each entry.
    for (const file of [
      "../src/app/settings/privacy/page.tsx",   // log, export, delete
      "../src/app/settings/security/page.tsx",  // passkeys and 2FA
      "../src/app/settings/succession/page.tsx",// naming a keeper
      "../src/lib/privacy/build-export.ts",     // the export itself
      "../src/lib/privacy/erase.ts",            // the deletion itself
    ]) {
      const code = src(file);
      expect(code, file).not.toMatch(/tierOf|standingFor|mayKeepMore|FREE_MEMORIES/);
    }
  });

  it("agrees with the promise plans.ts already made", () => {
    // Two documents describing what happens to a lapsed family's archive
    // have to agree, or the more generous one is decoration.
    expect(ACCESS_AFTER_CANCELLING.deletedForNonPayment).toBe(false);
    expect(ACCESS_AFTER_CANCELLING.addMemories).toBe(false);
  });
});

describe("who is paying", () => {
  it("counts an active membership", () => {
    expect(tierOf({ membershipState: "active" })).toBe("paid");
  });

  it("counts a failed card as paying", () => {
    // A card that failed on Tuesday is a card problem. Locking a parent out
    // of their child's archive over one turns a billing retry into a
    // cancellation.
    expect(tierOf({ membershipState: "past_due" })).toBe("paid");
  });

  it("counts a one-off purchase for the year it bought", () => {
    const now = "2027-06-01T00:00:00.000Z";
    expect(tierOf({ membershipState: "none", paidUntil: "2027-12-01T00:00:00.000Z", now })).toBe("paid");
    expect(tierOf({ membershipState: "none", paidUntil: "2027-01-01T00:00:00.000Z", now })).toBe("free");
  });

  it("puts a lapsed family back on free rather than in a tier of their own", () => {
    // One rule instead of two, and it removes an absurdity: under a separate
    // lapsed tier somebody who had paid us would end up with less than
    // somebody who never had.
    expect(tierOf({ membershipState: "cancelled" })).toBe("free");
    expect(tierOf({ membershipState: null })).toBe("free");
    // In practice they are far past the cap, which is what plans.ts already
    // promised — reached by consistency rather than by a special case.
    expect(free(900).full).toBe(true);
    expect(free(900).room).toBe(0);
  });
});

describe("hitting the wall", () => {
  it("takes as many as fit rather than refusing the batch", () => {
    // A parent dropping two hundred with ninety left should end up with
    // ninety more kept and a clear sentence, not an error and an empty
    // archive. The best moment in the product must not become a failure.
    const verdict = roomForMore(free(FREE_MEMORIES - 90), 200);
    expect(verdict.ok).toBe(true);
    expect(verdict.accepted).toBe(90);
    expect(verdict.message).toMatch(/90 of those fit/);
    expect(verdict.message).toMatch(/Nothing is lost/);
  });

  it("says nothing when there is nothing to say", () => {
    expect(roomForMore(free(0), 5).message).toBeNull();
  });

  it("warns before it is a surprise", () => {
    expect(TELL_THEM_AT).toBeGreaterThanOrEqual(0.5);
    expect(TELL_THEM_AT).toBeLessThan(1);
    const verdict = roomForMore(free(FREE_MEMORIES - 25), 10);
    expect(verdict.ok).toBe(true);
    expect(verdict.message).toMatch(/before this year needs a membership/);
  });

  it("tells a full family their archive is intact in the same breath", () => {
    // The sentence somebody reads at the moment they are stopped is the one
    // that decides whether they believe the rest of the page.
    const verdict = roomForMore(free(FREE_MEMORIES), 1);
    expect(verdict.ok).toBe(false);
    expect(verdict.accepted).toBe(0);
    expect(verdict.message).toMatch(/still here, and always will be/);
  });

  it("never blames the family", () => {
    const all = [
      roomForMore(free(FREE_MEMORIES), 1).message,
      roomForMore(free(FREE_MEMORIES - 5), 50).message,
    ].join(" ");
    expect(all).not.toMatch(/you (have )?(exceeded|used up|reached your limit)|quota/i);
  });

  it("puts no wall in front of a paying family", () => {
    const paid = standingFor({ tier: "paid", kept: 5000 });
    expect(paid.full).toBe(false);
    expect(paid.cap).toBeNull();
    expect(roomForMore(paid, 10_000)).toEqual({ ok: true, accepted: 10_000, message: null });
  });
});

describe("where the cap is enforced", () => {
  it("is a trigger on the insert, not a check in the application", () => {
    // The first version checked it in keepMemory() — the right place, the
    // wrong layer. It added two queries to every insert, so a parent moving
    // three hundred photographs paid six hundred extra round trips for a
    // rule that is a single count. And an application check can be missed
    // by a new code path; a trigger cannot.
    const sql = src("../supabase/migrations/0028_free_cap.sql");
    expect(sql).toMatch(/before insert on memories/);
    expect(sql).toMatch(/refuse_past_free_cap/);
    const scope = src("../src/lib/memories/scope.ts");
    expect(scope).not.toContain("mayKeepMore");
  });

  it("says the same number in the database as in the code", () => {
    // A number in two places is a number that drifts, and the alternative
    // is the round trip the trigger exists to remove.
    const sql = src("../supabase/migrations/0028_free_cap.sql");
    expect(sql).toMatch(new RegExp(`select ${FREE_MEMORIES}\\b`));
  });

  it("agrees with tierOf about who is paying", () => {
    // Two definitions of "paying" — one in SQL, one in TypeScript — is the
    // same drift risk as the number.
    const sql = src("../supabase/migrations/0028_free_cap.sql");
    expect(sql).toMatch(/'active', 'past_due'/);
    expect(sql).toMatch(/paid_until > now\(\)/);
    expect(tierOf({ membershipState: "past_due" })).toBe("paid");
  });

  it("skips the count entirely for a paying family", () => {
    // The hot path is a three-hundred-photo upload by somebody who has
    // paid. It must not pay for a rule that does not apply to them.
    const sql = src("../supabase/migrations/0028_free_cap.sql");
    const fn = sql.slice(sql.indexOf("refuse_past_free_cap()\nreturns trigger"));
    expect(fn.indexOf("family_is_paying")).toBeLessThan(fn.indexOf("select count(*)"));
  });

  it("indexes the column it counts on", () => {
    // Without it, every insert by a free family scans every memory in the
    // database.
    expect(src("../supabase/migrations/0028_free_cap.sql"))
      .toMatch(/create index if not exists memories_family_idx on memories\(family_id\)/);
  });

  it("reads the plan from the database rather than from a session", () => {
    const standing = src("../src/lib/billing/standing.ts");
    expect(standing).toMatch(/membership_state, paid_until/);
    expect(standing).toMatch(/count: "exact", head: true/);
  });

  it("treats an unreadable family as paying, not as free", () => {
    // The failure mode of guessing "free" is refusing somebody's
    // photographs because of our own outage. The same call storage/usage.ts
    // makes, for the same reason.
    expect(src("../src/lib/billing/standing.ts")).toMatch(/family === null\s*\n?\s*\? "paid"/);
  });

  it("sends the two walls to different buttons", () => {
    // Running out of space is something you can buy more of; reaching the
    // free cap is a question about the plan. Telling a free family they are
    // out of space would send them to buy the wrong thing.
    const uploader = src("../src/app/subjects/[subjectId]/upload/uploader.tsx");
    expect(uploader).toMatch(/wall === "plan"/);
    expect(uploader).toMatch(/What a membership adds/);
    expect(src("../src/app/actions.ts")).toMatch(/why: "space" as const/);
  });
});
