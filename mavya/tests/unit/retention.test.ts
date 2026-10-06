import { describe, expect, it } from "vitest";
import { reasonText } from "@/lib/domain/retention";

// M8e: docs/M8_NETWORK.md. Warning signs in plain words.
describe("why a family might leave", () => {
  it("says each sign plainly", () => {
    expect(reasonText({ kind: "absences", child: "Ava", count: 4 })).toBe(
      "Ava has missed 4 lessons in the last 6 weeks.",
    );
    expect(reasonText({ kind: "credits_expired", child: "Ava", count: 1 })).toBe(
      "Ava’s make-up credit ran out unused.",
    );
    expect(reasonText({ kind: "credits_expired", child: "Ava", count: 2 })).toBe(
      "Ava’s 2 make-up credits ran out unused.",
    );
    expect(reasonText({ kind: "leaving", child: "Leo", term: "Term 1 2027" })).toBe(
      "Leo isn’t coming back for Term 1 2027.",
    );
    expect(reasonText({ kind: "not_answered", child: "Leo", term: "Term 1 2027" })).toBe(
      "No answer yet about Term 1 2027 for Leo, and the reply-by date has passed.",
    );
    expect(reasonText({ kind: "paused", child: "Mei", class: "Level 2 Sat" })).toBe(
      "Mei’s place in Level 2 Sat is paused.",
    );
    expect(reasonText({ kind: "overdue", cents: 24000 })).toBe(
      "$240 overdue by more than 2 weeks.",
    );
  });
});
