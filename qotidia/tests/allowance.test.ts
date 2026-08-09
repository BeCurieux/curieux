// How much room a family has.
//
// Most of these are about what being full must *not* do. This product tells
// families it never deletes their archive, and a storage limit is the most
// likely place for that promise to quietly stop being true — not by anybody
// deciding to break it, but by somebody implementing a quota the ordinary
// way.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_PRICES } from "@/lib/billing/plans";
import {
  ADD_ON,
  allowanceFor,
  asSize,
  GB,
  GRACE,
  INCLUDED,
  roomFor,
  WARN_AT,
} from "@/lib/storage/allowance";

const monthly = (usedGb: number, extraBlocks = 0) =>
  allowanceFor({ usedBytes: usedGb * GB, plan: "monthly", extraBlocks });

describe("what a plan includes", () => {
  it("is a number, not 'unlimited'", () => {
    // The offer was implicitly unlimited because nothing counted. One
    // household with 400GB of 4K video costs more per year than they pay.
    expect(INCLUDED.monthly).toBeGreaterThan(0);
    expect(INCLUDED.one_off).toBeGreaterThan(0);
    expect(INCLUDED.monthly).toBeGreaterThan(INCLUDED.one_off);
  });

  it("falls back to the smaller allowance for a plan it does not know", () => {
    // A family whose plan cannot be read gets the conservative number rather
    // than an accidental unlimited — the failure mode of guessing generously
    // is a bill nobody budgeted for.
    expect(allowanceFor({ usedBytes: 0, plan: "nonsense" }).includedBytes).toBe(INCLUDED.one_off);
  });

  it("adds bought blocks to what is included", () => {
    expect(monthly(0, 2).totalBytes).toBe(INCLUDED.monthly + 2 * ADD_ON);
  });
});

describe("what being full does not do", () => {
  it("does not stop a family reading anything", () => {
    // Nothing in this module can express "locked" or "deleted". It reports
    // whether a *new upload* fits, and that is the entire surface — which is
    // the structural reason the promise cannot rot.
    const full = monthly(200);
    expect(full.full).toBe(true);
    expect(Object.keys(full)).not.toContain("locked");
    expect(Object.keys(full)).not.toContain("deleteAfter");
  });

  it("says so in the refusal, rather than only saying no", () => {
    const refused = roomFor(monthly(120), 5 * GB);
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/stays exactly where it is/i);
    expect(refused.message).toMatch(/still works/i);
  });

  it("offers the way out and names the number", () => {
    const refused = roomFor(monthly(120), 5 * GB);
    expect(refused.message).toContain(asSize(INCLUDED.monthly));
    expect(refused.message).toContain(asSize(ADD_ON));
  });

  it("never threatens deletion, in any wording", () => {
    for (const used of [0, 50, 80, 99, 110, 400]) {
      const m = roomFor(monthly(used), 10 * GB).message ?? "";
      expect(m).not.toMatch(/delet|remove|lose|erase|purge|expire/i);
    }
  });
});

describe("not being cut off halfway through", () => {
  it("lets an upload cross the line rather than stopping mid-import", () => {
    // A parent emptying a camera roll should not be refused at photo 400 of
    // 600. The alternative turns the best moment in the product into an
    // error message.
    const almost = monthly(95);
    expect(roomFor(almost, 8 * GB).ok).toBe(true);
    expect(almost.fraction).toBeGreaterThan(WARN_AT);
  });

  it("stops once past the grace", () => {
    expect(roomFor(monthly(95), 30 * GB).ok).toBe(false);
    expect(GRACE).toBeGreaterThan(1);
  });

  it("warns once, at the point it becomes worth saying", () => {
    const before = monthly(50);
    const crossing = roomFor(before, 35 * GB);
    expect(crossing.ok).toBe(true);
    expect(crossing.nowWarning).toBe(true);
    expect(crossing.message).toMatch(/worth knowing/i);

    // And does not repeat it on the next upload, which is how a useful
    // warning becomes something people click past.
    const after = monthly(85);
    expect(roomFor(after, 1 * GB).nowWarning).toBe(false);
    expect(roomFor(after, 1 * GB).message).toBeNull();
  });

  it("says nothing at all to a family with plenty of room", () => {
    expect(roomFor(monthly(4), 1 * GB).message).toBeNull();
  });
});

describe("sizes a person can read", () => {
  it("uses the units a phone and a storage bill both use", () => {
    expect(asSize(100 * GB)).toBe("100 GB");
    expect(asSize(1.42 * GB)).toBe("1.4 GB");
    expect(asSize(4_200_000)).toBe("4.2 MB");
    expect(asSize(0)).toBe("0 bytes");
  });

  it("does not print a decimal nobody needs", () => {
    expect(asSize(42.4 * GB)).toBe("42 GB");
  });

  it("treats a negative total as empty rather than as a negative size", () => {
    expect(allowanceFor({ usedBytes: -5, plan: "monthly" }).usedBytes).toBe(0);
  });
});

describe("the price of more space", () => {
  it("is a real price, above what the space costs us", () => {
    // At current object-store rates a hundred gigabytes is roughly A$27 a
    // year before replicas and backups, and a family buying more space is
    // buying the second copy in another region too. A block priced at or
    // below cost is a block that loses money on every sale.
    const block = PLAN_PRICES.storageBlockAud();
    expect(block).toBeGreaterThan(3000);
    expect(ADD_ON).toBe(100 * GB);
  });

  it("is quoted from the module that owns prices, not typed into a page", () => {
    const billing = readFileSync(
      new URL("../src/app/settings/billing/page.tsx", import.meta.url),
      "utf8"
    );
    expect(billing).toContain("PLAN_PRICES.storageBlockAud()");
    // The literal that was there first. This project has had a price drift
    // between a page and the charge more than once.
    expect(billing).not.toMatch(/aud\(\d{3,}\)/);
  });
});
