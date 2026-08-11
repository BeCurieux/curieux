// Succession, and the ways it must not work.
//
// The mechanism that rescues an archive from a death is the mechanism that
// steals one from a living person. Almost every test here is about the
// second case.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOTICE_DAYS, REMIND_ON, SETTLING_DAYS, SILENT_FOR_DAYS,
  decidesAtFor, mayClaim, next, silenceOpens, type Claim,
} from "@/lib/succession/policy";

const DAY = 86_400_000;
const OPENED = "2026-03-01T09:00:00.000Z";
const on = (dayOffset: number, from = OPENED) =>
  new Date(new Date(from).getTime() + dayOffset * DAY).toISOString();

const claim = (patch: Partial<Claim> = {}): Claim => ({
  status: "notice",
  opening: "claimed",
  openedAt: OPENED,
  decidesAt: decidesAtFor(OPENED),
  ownerSeenAt: null,
  remindedOn: [],
  ...patch,
});

describe("any sign of life stops it", () => {
  it("a sign-in during the notice refuses the claim", () => {
    const move = next(claim({ ownerSeenAt: on(5) }), on(6));
    expect(move).toEqual({ do: "refuse", because: "the owner signed in" });
  });

  it("a sign-in on the last morning still counts", () => {
    // The ordering in next() is the whole safety property: the sign-of-life
    // check runs before the deadline check, so somebody who opens the app on
    // day thirty keeps their archive.
    const nearly = claim({ ownerSeenAt: on(NOTICE_DAYS) });
    expect(next(nearly, on(NOTICE_DAYS)).do).toBe("refuse");
  });

  it("a sign-in the day before the claim was opened does not count", () => {
    // Otherwise every claim refuses itself immediately: the owner was
    // obviously around at some point before somebody said they had died.
    expect(next(claim({ ownerSeenAt: on(-1) }), on(2)).do).not.toBe("refuse");
  });

  it("survives a sweep that did not run for a week", () => {
    // Measured against when the claim opened rather than when we last
    // looked. A missed sweep must not let a handover through that a sign-in
    // should have stopped.
    const missed = claim({ ownerSeenAt: on(3), remindedOn: [0] });
    expect(next(missed, on(NOTICE_DAYS + 7)).do).toBe("refuse");
  });
});

describe("the notice period", () => {
  it("does nothing on the day it opens except say so", () => {
    expect(next(claim(), OPENED)).toEqual({ do: "remind", dayIntoNotice: 0 });
  });

  it("hands over only once the month is up", () => {
    expect(next(claim({ remindedOn: REMIND_ON }), on(NOTICE_DAYS - 1)).do).toBe("nothing");
    expect(next(claim({ remindedOn: REMIND_ON }), on(NOTICE_DAYS)).do).toBe("hand over");
  });

  it("is a month, and that is a deliberate number", () => {
    // Long enough that a living owner opens their email or simply signs in;
    // short enough that a grieving family is not locked out during the worst
    // of it.
    expect(NOTICE_DAYS).toBeGreaterThanOrEqual(21);
    expect(NOTICE_DAYS).toBeLessThanOrEqual(45);
  });

  it("writes to the owner several times, not once", () => {
    expect(REMIND_ON.length).toBeGreaterThanOrEqual(4);
    expect(REMIND_ON[0]).toBe(0);
    expect(Math.max(...REMIND_ON)).toBeLessThan(NOTICE_DAYS);
  });

  it("sends each reminder exactly once however the sweep runs", () => {
    // Twice in a day, then not for three days. Each reminder still goes once.
    let sent: number[] = [];
    for (const day of [0, 0, 1, 3, 3, 7, 10, 14]) {
      const move = next(claim({ remindedOn: sent }), on(day));
      if (move.do === "remind") sent = [...sent, move.dayIntoNotice];
    }
    expect(sent).toEqual([...new Set(sent)]);
    expect(sent).toEqual([0, 3, 7, 14]);
  });

  it("catches up rather than skipping when the sweep was down", () => {
    // Silence for a fortnight must not mean the owner was never written to.
    const move = next(claim(), on(14));
    expect(move.do).toBe("remind");
  });

  it("stops touching a claim that is already settled", () => {
    for (const status of ["completed", "refused", "withdrawn"] as const) {
      expect(next(claim({ status }), on(99))).toEqual({ do: "nothing" });
    }
  });
});

describe("who may ask, and when", () => {
  const named = (daysAgo: number) => ({
    namedAt: on(-daysAgo, "2026-06-01T00:00:00.000Z"),
    declinedAt: null,
  });
  const NOW = "2026-06-01T00:00:00.000Z";

  it("refuses somebody named yesterday", () => {
    // The attack this stops: get into an account, name yourself, claim.
    // Now that takes a month of undetected access before it can even start.
    const answer = mayClaim(named(1), 0, NOW);
    expect(answer.ok).toBe(false);
    expect(SETTLING_DAYS).toBeGreaterThanOrEqual(14);
  });

  it("gives a date rather than saying 'not yet'", () => {
    // Somebody in the middle of a bereavement deserves to know when, not to
    // be told to come back later.
    const answer = mayClaim(named(1), 0, NOW);
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.because).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("allows somebody named long ago", () => {
    expect(mayClaim(named(SETTLING_DAYS + 1), 0, NOW).ok).toBe(true);
  });

  it("refuses a keeper who said in advance they would rather not", () => {
    const declined = { namedAt: on(-400, NOW), declinedAt: on(-10, NOW) };
    expect(mayClaim(declined, 0, NOW).ok).toBe(false);
  });

  it("refuses a second claim while one is open", () => {
    // Two people claiming one archive is a dispute, not a race. The second
    // is refused at the door rather than arbitrated later.
    expect(mayClaim(named(400), 1, NOW).ok).toBe(false);
  });
});

describe("an archive nobody has opened in a very long time", () => {
  const NOW = "2027-01-01T00:00:00.000Z";
  const quiet = (patch = {}) => ({
    hasKeeper: true,
    ownerSeenAt: on(-SILENT_FOR_DAYS - 1, NOW),
    createdAt: on(-2000, NOW),
    openClaims: 0,
    now: NOW,
    ...patch,
  });

  it("is offered to its keeper without anybody asking", () => {
    expect(silenceOpens(quiet())).toBe(true);
  });

  it("does nothing at all if nobody was named", () => {
    // We do not go looking for somebody to hand a family's private life to.
    // An unclaimed archive waits, at our expense, indefinitely.
    expect(silenceOpens(quiet({ hasKeeper: false }))).toBe(false);
  });

  it("leaves a family who signed in last year alone", () => {
    expect(silenceOpens(quiet({ ownerSeenAt: on(-370, NOW) }))).toBe(false);
  });

  it("waits longer than a yearly ritual", () => {
    // A family whose whole habit is one book a year signs in around the
    // anniversary and not much else. A year of quiet is a normal year.
    expect(SILENT_FOR_DAYS).toBeGreaterThan(365);
  });

  it("measures a never-used account from when it was made", () => {
    expect(silenceOpens(quiet({ ownerSeenAt: null, createdAt: on(-30, NOW) }))).toBe(false);
    expect(silenceOpens(quiet({ ownerSeenAt: null, createdAt: on(-2000, NOW) }))).toBe(true);
  });

  it("does not stack a second claim on top of an open one", () => {
    expect(silenceOpens(quiet({ openClaims: 1 }))).toBe(false);
  });
});

describe("what the emails may and may not say", () => {
  const messages = readFileSync(new URL("../src/lib/email/messages.ts", import.meta.url), "utf8");
  const succession = messages.slice(messages.indexOf("// ------------------------------------------------------------- succession"));

  it("tells a living owner that signing in is enough", () => {
    // The person being declared dead should not have to find a form to
    // disagree with it.
    expect(succession).toMatch(/sign in/i);
    expect(succession).toMatch(/no form to fill in/i);
  });

  it("says plainly that nothing is deleted", () => {
    expect(succession).toMatch(/Nothing is deleted/i);
  });

  it("tells the owner what to do if they did not name anybody", () => {
    // This one email is the security control on naming a keeper.
    expect(succession).toMatch(/someone else has access to your account/i);
  });

  it("never speculates about whether the owner has died", () => {
    // We know somebody said so. Every sentence has to be true either way.
    expect(succession).not.toMatch(/sorry for your loss|passed away|we were sorry/i);
    expect(succession).toMatch(/has told us/i);
  });
});

describe("none of it can be switched off", () => {
  const send = readFileSync(new URL("../src/lib/email/send.ts", import.meta.url), "utf8");

  it("treats every succession message as transactional", () => {
    // An unsubscribe must not be able to silence the message telling a
    // living person that somebody is about to be given their archive.
    for (const kind of [
      "keeper_named", "succession_claimed", "succession_refused", "succession_completed",
    ]) {
      expect(send).toMatch(new RegExp(`${kind}:\\s*null`));
    }
  });
});

describe("the handover", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/0023_succession.sql", import.meta.url), "utf8");

  it("demotes rather than deletes", () => {
    // The person who died keeps their membership and their name stays on
    // everything they wrote. It is also what makes a mistaken handover
    // reversible.
    expect(migration).toContain("update family_memberships set role = 'editor'");
    expect(migration).not.toMatch(/delete from family_memberships/i);
  });

  it("demotes before promoting, because one owner is a unique index", () => {
    const demote = migration.indexOf("set role = 'editor'");
    const promote = migration.indexOf("insert into family_memberships");
    expect(demote).toBeGreaterThan(0);
    expect(demote).toBeLessThan(promote);
  });

  it("is a no-op the second time, so a retried job does not fail", () => {
    expect(migration).toContain("if previous = to_user then");
  });
});
