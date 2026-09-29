import { describe, expect, it } from "vitest";
import { ageOn, dayName, formatLessonDate, formatTime, shortDay } from "@/lib/format";

describe("formatting", () => {
  it("names ISO weekdays", () => {
    expect(dayName(1)).toBe("Monday");
    expect(dayName(7)).toBe("Sunday");
    expect(shortDay(3)).toBe("Wed");
  });

  it("writes times the way the demo does", () => {
    expect(formatTime("16:30:00")).toBe("4:30pm");
    expect(formatTime("09:00")).toBe("9:00am");
    expect(formatTime("00:15")).toBe("12:15am");
    expect(formatTime("12:00")).toBe("12:00pm");
  });

  it("shows a lesson's date in the location's timezone, not the server's", () => {
    // 06:30 UTC on Tuesday is Tuesday evening in Sydney but still Monday night in Los Angeles.
    expect(formatLessonDate("2026-09-29T06:30:00Z", "Australia/Sydney")).toBe("Tue 29 Sep");
    expect(formatLessonDate("2026-09-29T06:30:00Z", "America/Los_Angeles")).toBe("Mon 28 Sep");
  });

  it("counts age in whole years", () => {
    expect(ageOn("2019-03-14", new Date("2026-03-13T12:00:00"))).toBe(6);
    expect(ageOn("2019-03-14", new Date("2026-03-14T12:00:00"))).toBe(7);
  });
});
