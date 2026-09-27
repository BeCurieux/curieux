import { describe, expect, it } from "vitest";
import { dropOff, summarise } from "@/lib/analytics/events";

/**
 * The drop-off table shipped once reading the *draft* document while the page
 * above it promised "everything since you published it". Renaming a question
 * relabelled history, and a draft-only question appeared as a cliff nobody
 * had got past — for a question no visitor had ever seen.
 *
 * The document is the caller's choice, so what these tests pin is the shape
 * of the answer: that it follows the steps it is handed, in order, and that
 * the numbers add up.
 */

/** step_complete events for `count` distinct sessions, numbered from 0. */
function passed(stepId: string, count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    type: "step_complete",
    sessionId: `s${index + offset}`,
    stepId,
  }));
}

const STEPS = [
  { id: "one", title: "What are we cleaning?" },
  { id: "two", title: "How many bedrooms?" },
  { id: "three", title: "How often?" },
];

describe("question-by-question drop-off", () => {
  const events = [...passed("one", 90), ...passed("two", 70), ...passed("three", 55)];

  it("follows the steps it is given, in their order", () => {
    const rows = dropOff(events, STEPS, 100);
    expect(rows.map((row) => row.id)).toEqual(["one", "two", "three"]);
    expect(rows.map((row) => row.label)).toEqual(STEPS.map((step) => step.title));
  });

  it("reports a step that has no events at all, rather than skipping it", () => {
    // A question every visitor abandoned is the single most useful row on the
    // page. Dropping it because it has no events would hide the cliff.
    const withDeadEnd = [...STEPS, { id: "four", title: "Never answered" }];
    const rows = dropOff(events, withDeadEnd, 100);
    expect(rows).toHaveLength(4);
    expect(rows[3]).toMatchObject({ reached: 0, share: 0, lost: 55 });
  });

  it("counts each visitor once however many events they sent", () => {
    const noisy = [...events, ...passed("one", 90), ...passed("one", 90)];
    expect(dropOff(noisy, STEPS, 100)[0].reached).toBe(90);
  });

  it("adds up: every start either reaches the last question or is lost on the way", () => {
    const rows = dropOff(events, STEPS, 100);
    const lost = rows.reduce((total, row) => total + row.lost, 0);
    expect(lost + rows[rows.length - 1].reached).toBe(100);
  });

  it("shares are measured against starts, not views", () => {
    expect(dropOff(events, STEPS, 100).map((row) => row.share)).toEqual([90, 70, 55]);
    expect(dropOff(events, STEPS, 90).map((row) => row.share)).toEqual([100, 78, 61]);
  });

  it("treats a branch that rejoins as a detour, not as negative loss", () => {
    // A rule hides question two for most people, so three is reached by more
    // than two. That's people taking a shortcut, not people coming back from
    // the dead — the row reads zero lost rather than -35.
    const branched = [...passed("one", 90), ...passed("two", 20), ...passed("three", 55)];
    const rows = dropOff(branched, STEPS, 100);
    expect(rows.map((row) => row.lost)).toEqual([10, 70, 0]);
    expect(rows.every((row) => row.lost >= 0)).toBe(true);
  });

  it("survives a widget nobody has started", () => {
    expect(dropOff([], STEPS, 0)).toEqual([
      { id: "one", label: STEPS[0].title, reached: 0, share: 0, lost: 0 },
      { id: "two", label: STEPS[1].title, reached: 0, share: 0, lost: 0 },
      { id: "three", label: STEPS[2].title, reached: 0, share: 0, lost: 0 },
    ]);
    expect(dropOff([], [], 0)).toEqual([]);
  });

  it("ignores events of other types that happen to carry a step id", () => {
    const polluted = [
      ...passed("one", 90),
      { type: "widget_view", sessionId: "x1", stepId: "one" },
      { type: "cta_click", sessionId: "x2", stepId: "one" },
    ];
    expect(dropOff(polluted, STEPS, 100)[0].reached).toBe(90);
  });
});

describe("the headline numbers", () => {
  it("rates completion against starts, so a scroll-past isn't a failure", () => {
    const events = [
      ...Array.from({ length: 200 }, (_, i) => ({ type: "widget_view", sessionId: `v${i}` })),
      ...Array.from({ length: 50 }, (_, i) => ({ type: "widget_start", sessionId: `v${i}` })),
      ...Array.from({ length: 25 }, (_, i) => ({ type: "widget_complete", sessionId: `v${i}` })),
    ];
    const stats = summarise(events, 4);
    expect(stats).toMatchObject({ views: 200, starts: 50, completions: 25, completionRate: 50, leads: 4 });
  });
});
