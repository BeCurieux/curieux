// Nine promises that cannot be quietly edited.
//
// The interesting test in this file is the fingerprint one. Everything else
// checks that the page is well formed; that one checks that the page is
// *honest over time*, which is the only property that distinguishes a promise
// from a paragraph of reassurance.
//
// It works by carrying a hash of every published wording. Editing promise 3
// fails the build, and the only way to make it pass is to change the expected
// hash — which is a visible line in a diff, next to a test that says why you
// should not be doing it, in the same commit that has to add a history entry.
//
// That is a tripwire, not a cryptographic guarantee: anybody with commit
// access can change both. The point is that they cannot do it *by accident*
// or *quietly*, which covers the realistic failure — a founder tidying the
// copy in eighteen months without registering that they are amending a
// document families were told was fixed.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AS_AT, HISTORY, KEPT, STATUTORY, TELL_YOU_WITHIN_DAYS, UNDERTAKINGS,
} from "@/lib/trust/promise";
import { BACKUP_EXPIRY_DAYS } from "@/lib/privacy/erase";
import { LIVES_FOR_DAYS } from "@/lib/share/policy";
import { SUPPORT_ACCESS_HOURS } from "@/lib/family/support";

const fingerprint = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const page = readFileSync(new URL("../src/app/promise/page.tsx", import.meta.url), "utf8");

describe("the promises cannot be edited quietly", () => {
  /**
   * Every wording ever published, by number.
   *
   * DO NOT change a value here to make a failing test pass. A published
   * promise is not edited — it is withdrawn (which keeps the old text and
   * adds a date and a reason) and a new, higher-numbered one takes its place.
   * Amending one of these is amending a document families were told was
   * fixed, and it needs a HISTORY entry saying so.
   */
  const PUBLISHED: Record<number, string> = {
    1: "7465e2e0f24016bc",
    2: "1de49e7c197a43d1",
    3: "b7fa29862207b663",
    4: "ece275434be4373f",
    5: "5baea4875a45539c",
    6: "76213d6a7ac9f744",
    7: "42f9e1d5de11deaa",
    8: "a2213f2088d58019",
    9: "becf81a2a5d1a6bc",
  };

  it("matches the wording that was published", () => {
    const now = Object.fromEntries(UNDERTAKINGS.map((u) => [u.n, fingerprint(u.text)]));
    expect(now).toEqual(PUBLISHED);
  });

  it("never reuses or renumbers", () => {
    const ns = UNDERTAKINGS.map((u) => u.n);
    expect(new Set(ns).size).toBe(ns.length);
    expect([...ns].sort((a, b) => a - b)).toEqual(ns);
  });

  it("keeps a withdrawn promise on the page rather than removing it", () => {
    // Nothing is withdrawn today. This asserts the shape that makes the
    // claim keepable when one is: a withdrawal is an addition, not a
    // deletion, and the page renders the old text struck through.
    for (const u of UNDERTAKINGS) {
      if (!u.withdrawn) continue;
      expect(u.text.length).toBeGreaterThan(0);
      expect(u.withdrawn.why.length).toBeGreaterThan(10);
    }
    expect(page).toContain("line-through");
    expect(page).toMatch(/u\.withdrawn/);
  });

  it("renders every promise, including any that were withdrawn", () => {
    // The page maps UNDERTAKINGS, not KEPT. Rendering only the live ones
    // would make the whole append-only design invisible — which is the same
    // thing as not having it.
    expect(page).toMatch(/UNDERTAKINGS\.map/);
    expect(page).not.toMatch(/KEPT\.map/);
  });
});

describe("the change history", () => {
  it("has an entry, and the page is dated from it", () => {
    expect(HISTORY.length).toBeGreaterThan(0);
    expect(AS_AT).toBe(HISTORY[0].on);
  });

  it("runs newest first", () => {
    const dates = HISTORY.map((c) => c.on);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("says why, not only what", () => {
    // "Updated for clarity" is how a promise gets weakened.
    for (const c of HISTORY) expect(c.why.length, c.on).toBeGreaterThan(20);
  });

  it("is shown on the page", () => {
    expect(page).toMatch(/HISTORY\.map/);
  });

  it("prints years, on a document meant to be read back later", () => {
    // It first rendered "Promised 10 August" — friendlyDate drops the year
    // for the current one, which is right for a child's year and wrong for
    // a commitment. A promise that cannot be shown to have been made on a
    // particular day is not one.
    expect(page).not.toMatch(/friendlyDate/);
    expect(page).toMatch(/fullDate\(/);
  });
});

describe("what the promises say", () => {
  it("is nine, all currently kept", () => {
    expect(UNDERTAKINGS).toHaveLength(9);
    expect(KEPT).toHaveLength(9);
  });

  it("quotes the numbers the code actually enforces", () => {
    // Every figure in a promise is a place the document can drift away from
    // the implementation. These are the three that appear in both.
    const said = (n: number) => UNDERTAKINGS.find((u) => u.n === n)!.text;
    expect(said(3)).toContain(String(LIVES_FOR_DAYS));
    expect(said(4)).toContain(String(SUPPORT_ACCESS_HOURS));
    expect(said(7)).toContain(String(BACKUP_EXPIRY_DAYS));
  });

  it("promises to tell a family soon enough to be worth promising", () => {
    // The statutory scheme allows thirty days to assess. A voluntary
    // promise that lands on thirty is not a promise, it is the law with a
    // ribbon on it.
    expect(TELL_YOU_WITHIN_DAYS).toBeLessThanOrEqual(14);
    expect(said(8)).toMatch(/whether or not the law requires it/i);
    function said(n: number) {
      return UNDERTAKINGS.find((u) => u.n === n)!.text;
    }
  });

  it("includes the one nobody else makes", () => {
    // AI may curate and edit; AI must never invent a family memory. It is
    // the central rule of the product and belongs somewhere a customer can
    // read it, not only in the code.
    const invent = UNDERTAKINGS.find((u) => /invent/i.test(u.heading))!;
    expect(invent).toBeTruthy();
    expect(invent.text).toMatch(/does not write your family’s memories/i);
  });

  it("names where each one is actually kept", () => {
    for (const u of UNDERTAKINGS) expect(u.kept.length, `promise ${u.n}`).toBeGreaterThan(20);
  });

  it("dates every one", () => {
    for (const u of UNDERTAKINGS) expect(u.since, `promise ${u.n}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("writes them in the second person, to a parent", () => {
    // Not "users". Not "data subjects".
    for (const u of UNDERTAKINGS) {
      expect(u.text, `promise ${u.n}`).not.toMatch(/\busers?\b|\bdata subject/i);
    }
  });
});

describe("what the page must not do", () => {
  it("states the limit rather than implying there isn't one", () => {
    // Nine undertakings with no stated limit read as a tenth, unstated,
    // much larger one.
    expect(page).toMatch(/What this doesn&rsquo;t promise/);
    expect(page).toMatch(/nothing will ever go wrong/i);
  });

  it("does not claim to replace the law", () => {
    expect(STATUTORY).toMatch(/in addition to/i);
    expect(STATUTORY).toMatch(/Australian Consumer Law/);
    expect(STATUTORY).toMatch(/the law wins/i);
    expect(page).toContain("STATUTORY");
  });

  it("promises nothing about never being breached", () => {
    const all = UNDERTAKINGS.map((u) => `${u.heading} ${u.text}`).join(" ");
    expect(all).not.toMatch(/never be (breached|hacked|leaked|stolen)/i);
    expect(all).not.toMatch(/100%|completely safe|guaranteed safe/i);
  });

  it("sells nothing in the middle of it", () => {
    // A signup button between promise 5 and promise 6 turns a document into
    // a landing page, and a reader can feel the difference.
    expect(page).not.toMatch(/\/signup|\/pricing|className="btn/);
  });

  it("signs off with the address we actually send from", () => {
    // Not a second mailbox invented for this page.
    expect(page).toContain("FROM.address");
  });
});
