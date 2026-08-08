import { describe, expect, it } from "vitest";
import { getMarket } from "@/config/markets";
import {
  addDays,
  addMinutes,
  deliveryInstant,
  displayTime,
  feedbackInstant,
  generationInstant,
  instantFromLocal,
  isoWeekday,
  localDateString,
  localParts,
  sundayFor,
  toMinutes,
  upcomingWeekendDate,
} from "@/lib/util/time";

const SYDNEY = getMarket("sydney");
const LONDON = getMarket("london");

describe("local time resolution", () => {
  it("renders a UTC instant in the market's local time", () => {
    // 2026-03-14T00:00Z is 11:00 on the 14th in Sydney (AEDT, UTC+11).
    const parts = localParts(new Date("2026-03-14T00:00:00Z"), SYDNEY.timezone);
    expect(parts.day).toBe(14);
    expect(parts.hour).toBe(11);
    expect(parts.weekday).toBe(6); // Saturday
  });

  it("round-trips a local wall clock back to the same instant", () => {
    const instant = instantFromLocal("2026-03-14", "07:30", SYDNEY.timezone);
    const parts = localParts(instant, SYDNEY.timezone);
    expect(parts.hour).toBe(7);
    expect(parts.minute).toBe(30);
    expect(localDateString(instant, SYDNEY.timezone)).toBe("2026-03-14");
  });

  it("handles the end of Sydney daylight saving correctly", () => {
    // DST ends on 5 April 2026; 07:30 local is UTC+11 before and UTC+10 after.
    const before = instantFromLocal("2026-04-04", "07:30", SYDNEY.timezone);
    const after = instantFromLocal("2026-04-06", "07:30", SYDNEY.timezone);
    expect(before.toISOString()).toBe("2026-04-03T20:30:00.000Z");
    expect(after.toISOString()).toBe("2026-04-05T21:30:00.000Z");
  });

  it("handles a market on the other side of UTC", () => {
    const instant = instantFromLocal("2026-07-16", "07:30", LONDON.timezone);
    // British Summer Time: UTC+1.
    expect(instant.toISOString()).toBe("2026-07-16T06:30:00.000Z");
  });
});

describe("upcomingWeekendDate", () => {
  it("returns this week's Saturday from a Monday", () => {
    // Monday 9 March 2026, mid-morning Sydney time.
    const monday = instantFromLocal("2026-03-09", "10:00", SYDNEY.timezone);
    expect(upcomingWeekendDate(SYDNEY, monday)).toBe("2026-03-14");
  });

  it("returns this week's Saturday from a Wednesday evening", () => {
    const wednesday = instantFromLocal("2026-03-11", "19:00", SYDNEY.timezone);
    expect(upcomingWeekendDate(SYDNEY, wednesday)).toBe("2026-03-14");
  });

  it("still returns the weekend in progress on the Saturday itself", () => {
    const saturday = instantFromLocal("2026-03-14", "09:00", SYDNEY.timezone);
    expect(upcomingWeekendDate(SYDNEY, saturday)).toBe("2026-03-14");
  });

  it("keeps the weekend in progress on Sunday morning", () => {
    const sundayMorning = instantFromLocal("2026-03-15", "09:00", SYDNEY.timezone);
    expect(upcomingWeekendDate(SYDNEY, sundayMorning)).toBe("2026-03-14");
  });

  it("moves to next weekend after Sunday's feedback hour", () => {
    // Feedback fires at 18:30; by 19:00 this weekend is finished.
    const sundayEvening = instantFromLocal("2026-03-15", "19:00", SYDNEY.timezone);
    expect(upcomingWeekendDate(SYDNEY, sundayEvening)).toBe("2026-03-21");
  });

  it("differs between markets at the same instant", () => {
    // Late Sunday evening in Sydney is still Sunday morning in London, so the
    // two markets are legitimately planning different weekends.
    const instant = instantFromLocal("2026-03-15", "22:00", SYDNEY.timezone);
    expect(upcomingWeekendDate(SYDNEY, instant)).toBe("2026-03-21");
    expect(upcomingWeekendDate(LONDON, instant)).toBe("2026-03-14");
  });
});

describe("weekly schedule", () => {
  it("generates on Wednesday evening, local time", () => {
    const instant = generationInstant(SYDNEY, "2026-03-14");
    const parts = localParts(instant, SYDNEY.timezone);
    expect(parts.weekday).toBe(3); // Wednesday
    expect(parts.hour).toBe(19);
  });

  it("delivers on Thursday morning, local time", () => {
    const instant = deliveryInstant(SYDNEY, "2026-03-14");
    const parts = localParts(instant, SYDNEY.timezone);
    expect(parts.weekday).toBe(4); // Thursday
    expect(parts.hour).toBe(7);
    expect(parts.minute).toBe(30);
  });

  it("asks for feedback on Sunday evening, local time", () => {
    const instant = feedbackInstant(SYDNEY, "2026-03-14");
    const parts = localParts(instant, SYDNEY.timezone);
    expect(parts.weekday).toBe(7); // Sunday
    expect(parts.hour).toBe(18);
  });

  it("orders the week correctly: generate, then deliver, then ask", () => {
    const generate = generationInstant(SYDNEY, "2026-03-14").getTime();
    const deliver = deliveryInstant(SYDNEY, "2026-03-14").getTime();
    const feedback = feedbackInstant(SYDNEY, "2026-03-14").getTime();
    expect(generate).toBeLessThan(deliver);
    expect(deliver).toBeLessThan(feedback);
  });
});

describe("date and clock helpers", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
  });

  it("adds days across a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("subtracts days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("reports ISO weekdays with Sunday as 7", () => {
    expect(isoWeekday("2026-03-14")).toBe(6);
    expect(isoWeekday("2026-03-15")).toBe(7);
    expect(isoWeekday("2026-03-16")).toBe(1);
  });

  it("pairs a Saturday with its Sunday", () => {
    expect(sundayFor("2026-03-14")).toBe("2026-03-15");
  });

  it("converts clock times both ways", () => {
    expect(toMinutes("09:20")).toBe(560);
    expect(addMinutes("09:20", 45)).toBe("10:05");
    expect(addMinutes("23:50", 30)).toBe("23:59"); // clamped, never wraps
  });

  it("formats times the way a plan reads", () => {
    expect(displayTime("09:20")).toBe("9:20");
    expect(displayTime("13:00")).toBe("1:00");
    expect(displayTime("00:30")).toBe("12:30");
  });
});
