import { describe, expect, it } from "vitest";
import * as messages from "@/lib/email/messages";
import { addDays, shortDate, suggestedDates, termStage, type Term } from "@/lib/domain/terms";

// Term dates and the re-enrolment emails (docs/M6_MIGRATION_PILOT.md, M6e).

const term = (name: string, startsOn: string, endsOn: string, extra: Partial<Term> = {}): Term => ({
  id: name,
  name,
  startsOn,
  endsOn,
  replyBy: null,
  askedAt: null,
  appliedAt: null,
  ...extra,
});

const t4 = term("Term 4", "2026-10-12", "2026-12-18");
const t1 = term("Term 1", "2027-02-01", "2027-04-09");

describe("term dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("shows a date in plain words", () => {
    expect(shortDate("2027-02-01")).toBe("Mon 1 Feb");
  });

  it("suggests asking 3 weeks before the term before ends, replies 1 week before", () => {
    expect(suggestedDates([t4, t1], t1, "2026-11-01")).toEqual({
      askOn: "2026-11-27",
      replyBy: "2026-12-11",
    });
  });

  it("without a term before, counts back from the term's start; never before today", () => {
    expect(suggestedDates([t4], t4, "2026-10-01")).toEqual({
      askOn: "2026-09-20",
      replyBy: "2026-10-04",
    });
    expect(suggestedDates([t4], t4, "2026-10-09").replyBy).toBe("2026-10-09");
    expect(suggestedDates([t4], t4, "2026-10-11").replyBy).toBe("2026-10-11");
  });

  it("knows where a term is up to", () => {
    expect(termStage(t1, "2026-11-01")).toBe("planned");
    expect(termStage({ ...t1, askedAt: "2026-11-27T00:00:00Z" }, "2026-12-01")).toBe("asking");
    expect(termStage(t1, "2027-02-01")).toBe("under_way");
    expect(termStage(t1, "2027-04-10")).toBe("finished");
  });
});

describe("re-enrolment emails", () => {
  it("name the school and the term, never a child or a class", () => {
    const ask = messages.reenrolmentAsk({
      school: "Aqua House",
      term: "Term 1 2027",
      replyBy: "Fri 11 Dec",
      url: "https://app.ovyko.com.au/family",
    });
    expect(ask.subject).toBe("Aqua House: are you staying for Term 1 2027?");
    expect(ask.text).toContain("Please answer by Fri 11 Dec.");
    expect(ask.text).toContain("your places are kept");
    expect(ask.html).toContain('href="https://app.ovyko.com.au/family"');
    const reminder = messages.reenrolmentReminder({
      school: "Aqua House",
      term: "Term 1 2027",
      replyBy: null,
      url: "u",
    });
    expect(`${reminder.subject} ${reminder.preview}`).toBe(
      "Reminder: Term 1 2027 at Aqua House Let them know if you're staying.",
    );
  });
});
