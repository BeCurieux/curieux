import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/admin/csv";
import { computeNumbers, startOfDay } from "@/lib/admin/numbers";
import { tierFromEntitlements } from "@/lib/admin/tier";

describe("startOfDay (Sydney)", () => {
  it("is local midnight, in summer and winter time", () => {
    // 3 Nov 2026, 10:00 in Sydney (AEDT, UTC+11) → midnight was 2 Nov 13:00 UTC.
    expect(startOfDay(new Date("2026-11-02T23:00:00Z")).toISOString()).toBe(
      "2026-11-02T13:00:00.000Z",
    );
    // 1 Jul 2026, 09:00 in Sydney (AEST, UTC+10) → midnight was 30 Jun 14:00 UTC.
    expect(startOfDay(new Date("2026-06-30T23:00:00Z")).toISOString()).toBe(
      "2026-06-30T14:00:00.000Z",
    );
  });
});

describe("computeNumbers", () => {
  // Now: 3 Nov 2026, 10:00 Sydney. Today began 2 Nov 13:00 UTC.
  const now = new Date("2026-11-02T23:00:00Z");
  const today = "2026-11-02T20:00:00Z";
  const yesterday = "2026-11-02T10:00:00Z";
  const sixDaysAgo = "2026-10-28T14:00:00Z";
  const eightDaysAgo = "2026-10-25T14:00:00Z";

  const leads = [
    { firstSeen: today, convertedUserId: "buyer" },
    { firstSeen: today, convertedUserId: "free-user" },
    { firstSeen: today, convertedUserId: null },
    { firstSeen: yesterday, convertedUserId: null },
    { firstSeen: sixDaysAgo, convertedUserId: "pack-only" },
    { firstSeen: eightDaysAgo, convertedUserId: "buyer" },
  ];
  const orders = [
    { userId: "buyer", tier: "module0" as const, createdAt: today, refundedAt: null },
    { userId: "x", tier: "course" as const, createdAt: yesterday, refundedAt: today },
    { userId: "y", tier: "founding" as const, createdAt: sixDaysAgo, refundedAt: null },
    {
      userId: "pack-only",
      tier: "benchmark_pack" as const,
      createdAt: sixDaysAgo,
      refundedAt: null,
    },
    { userId: "z", tier: "module0" as const, createdAt: eightDaysAgo, refundedAt: null },
  ];

  it("counts today", () => {
    expect(computeNumbers(leads, orders, now).today).toEqual({
      leads: 3,
      module0Sales: 1,
      courseSales: 0,
      foundingSales: 0,
      refunds: 1,
      converted: 1,
      conversionPct: 33,
    });
  });

  it("counts the 7 days, today included, and nothing older", () => {
    expect(computeNumbers(leads, orders, now).week).toEqual({
      leads: 5,
      module0Sales: 1,
      courseSales: 1,
      foundingSales: 1,
      refunds: 1,
      // The benchmark pack alone isn't "a buyer" of the course.
      converted: 1,
      conversionPct: 20,
    });
  });

  it("has no conversion rate without leads", () => {
    expect(computeNumbers([], [], now).today.conversionPct).toBeNull();
  });
});

describe("tierFromEntitlements", () => {
  it("is the highest live tier; course includes the pack", () => {
    expect(tierFromEntitlements([])).toEqual({ tier: "free", benchmarkPack: false });
    expect(
      tierFromEntitlements([
        { tier: "module0", revoked_at: null },
        { tier: "benchmark_pack", revoked_at: null },
      ]),
    ).toEqual({ tier: "module0", benchmarkPack: true });
    expect(
      tierFromEntitlements([
        { tier: "module0", revoked_at: null },
        { tier: "course", revoked_at: "2026-11-01T00:00:00Z" },
      ]),
    ).toEqual({ tier: "module0", benchmarkPack: false });
    expect(tierFromEntitlements([{ tier: "course", revoked_at: null }])).toEqual({
      tier: "course",
      benchmarkPack: true,
    });
  });
});

describe("CSV", () => {
  it("quotes every field and doubles quotes", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x", 'say "hi"'],
          [null, 3],
        ],
      ),
    ).toBe('"a","b"\r\n"x","say ""hi"""\r\n"","3"\r\n');
  });
  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+61 4")).toBe(`"'+61 4"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell("ava@example.test")).toBe('"ava@example.test"');
  });
});
