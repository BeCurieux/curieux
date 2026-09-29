import { describe, expect, it } from "vitest";
import { IDLE_LIMIT_MS, isIdle, isInstructorPath } from "@/lib/auth/idle";
import { outboundMessage } from "@/lib/domain/notifications";
import { levelProgress } from "@/lib/domain/progress-score";
import { pastLessonRows, CLASSES, SKILLS } from "../../scripts/fixtures";
import demoJson from "../../seed/demo-data.json";

describe("level progress", () => {
  it("counts achieved as 1, developing as ½, not started as 0", () => {
    expect(levelProgress(["achieved", "achieved", "developing", "developing", "not_started"])).toBe(
      60,
    );
    expect(levelProgress(["achieved", "achieved", "achieved", "developing", "not_started"])).toBe(
      70,
    );
    expect(levelProgress([])).toBe(0);
  });

  it("seeds Dolphin 3 with the demo's five skills", () => {
    const dolphin3 = Object.values(SKILLS).filter(
      (s) => s.level_id === CLASSES.dolphin3Wed.level_id,
    );
    expect(dolphin3.map((s) => s.name)).toEqual(
      demoJson.family.children[0]!.skills!.map((s) => s.name),
    );
  });
});

describe("neutral notifications", () => {
  it("never names the child, the skill or a place", () => {
    const { subject, preview } = outboundMessage("Aqua House");
    expect(subject).toBe("New progress update from Aqua House");
    for (const text of [subject, preview]) {
      for (const detail of ["Ava", "Burrows", "Kick", "Mona Vale", "Dolphin"]) {
        expect(text).not.toContain(detail);
      }
    }
  });

  it("still reads well without a provider name", () => {
    expect(outboundMessage(" ").subject).toBe("New progress update from your activity provider");
  });
});

describe("idle sign-out", () => {
  const now = Date.parse("2026-09-30T06:00:00Z");

  it("signs out after 30 minutes without a request", () => {
    expect(IDLE_LIMIT_MS).toBe(30 * 60 * 1000);
    expect(isIdle(String(now - IDLE_LIMIT_MS - 1), now)).toBe(true);
    expect(isIdle(String(now - IDLE_LIMIT_MS + 1000), now)).toBe(false);
  });

  it("ignores a missing or garbled cookie", () => {
    expect(isIdle(undefined, now)).toBe(false);
    expect(isIdle("soon", now)).toBe(false);
  });

  it("applies to the instructor app only", () => {
    expect(isInstructorPath("/instructor")).toBe(true);
    expect(isInstructorPath("/instructor/class/dolphin-3")).toBe(true);
    expect(isInstructorPath("/instructors")).toBe(false);
    expect(isInstructorPath("/family")).toBe(false);
  });
});

describe("last week's lessons", () => {
  it("puts each class's lesson on its weekday and time in Sydney, before now", () => {
    // Tuesday 29 Sep 2026, 6pm in Sydney.
    const now = new Date("2026-09-29T08:00:00Z");
    const rows = pastLessonRows(now);
    const wed = rows.find((r) => r.class_id === CLASSES.dolphin3Wed.id)!;
    // Wednesday 23 Sep, 4:30pm AEST (UTC+10).
    expect(wed.starts_at).toBe("2026-09-23T06:30:00.000Z");
    const tue = rows.find((r) => r.class_id === CLASSES.dolphin3Tue.id)!;
    // Today at 5pm, already started.
    expect(tue.starts_at).toBe("2026-09-29T07:00:00.000Z");
    for (const r of rows) expect(new Date(r.starts_at) < now).toBe(true);
  });

  it("follows daylight saving", () => {
    // Sunday 11 Oct 2026, after clocks go forward (AEDT, UTC+11).
    const rows = pastLessonRows(new Date("2026-10-11T00:00:00Z"));
    const wed = rows.find((r) => r.class_id === CLASSES.dolphin3Wed.id)!;
    expect(wed.starts_at).toBe("2026-10-07T05:30:00.000Z");
  });
});
