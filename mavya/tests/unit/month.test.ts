import { describe, expect, it } from "vitest";
import {
  jobsWithoutStaff,
  minutesSaved,
  monthName,
  monthOf,
  shiftMonth,
  type OvykoMonth,
} from "@/lib/domain/month";

// M8a: the month arithmetic and the time-saved estimate (docs/M8_NETWORK.md).

const empty: OvykoMonth = {
  makeupsDelivered: 0,
  makeupsValueCents: 0,
  offersClaimed: 0,
  offersAutomatic: 0,
  absencesByParents: 0,
  makeupsBookedByParents: 0,
  paidOnlineCount: 0,
  paidOnlineCents: 0,
  instalmentsTaken: 0,
  instalmentsCents: 0,
  remindersSent: 0,
  chasedPaidFamilies: 0,
  chasedPaidCents: 0,
  reenrolAnswers: 0,
  staying: 0,
};

describe("months", () => {
  it("finds the month of a day and steps across years", () => {
    expect(monthOf("2026-10-04")).toBe("2026-10-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(monthName("2026-10-01")).toBe("October 2026");
  });
});

describe("jobs done without the front desk", () => {
  it("counts each kind of job once, and estimates the minutes", () => {
    const m = {
      ...empty,
      absencesByParents: 10,
      makeupsBookedByParents: 4,
      offersClaimed: 2,
      paidOnlineCount: 5,
      remindersSent: 3,
      reenrolAnswers: 6,
    };
    expect(jobsWithoutStaff(m)).toBe(30);
    expect(minutesSaved(m)).toBe(10 * 3 + 4 * 5 + 2 * 10 + 5 * 4 + 3 * 3 + 6 * 4);
    expect(jobsWithoutStaff(empty)).toBe(0);
  });
});
