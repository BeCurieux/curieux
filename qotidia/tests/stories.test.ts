// What story would you like to tell?
//
// The screen is a short list and one judgement: which of these this family
// currently has the material to make well. The judgement is the part worth
// testing, because getting it wrong means offering somebody a beautiful book
// they do not yet have the photographs for — which is how a product becomes
// the thing that sold you a disappointment.

import { describe, expect, it } from "vitest";
import { buildStories, nothingReadyYet, type StoryInput } from "@/lib/book/stories";
import { periodFor } from "@/lib/book/period";
import { MIN_MEMORIES_FOR_A_BOOK } from "@/lib/renewal/policy";

const TODAY = "2026-08-07";

const child = (over: Partial<StoryInput> = {}): StoryInput => ({
  subjectId: "flo",
  displayName: "Florence",
  subjectType: "child",
  dateOfBirth: "2023-02-06",
  material: 60,
  today: TODAY,
  ...over,
});

const household = (over: Partial<StoryInput> = {}): StoryInput => ({
  subjectId: "house",
  displayName: "The Wilsons",
  subjectType: "family",
  material: 40,
  today: TODAY,
  ...over,
});

describe("which twelve months a book covers", () => {
  it("runs a child's year from birthday to birthday", () => {
    // "The year you were two" is the twelve months between their second and
    // third birthdays, not a calendar year that straddles both.
    const p = periodFor(
      { display_name: "Florence", subject_type: "child", date_of_birth: "2023-02-06" },
      { today: TODAY }
    );
    expect(p.start).toBe("2025-02-06");
    expect(p.end).toBe("2026-02-05");
    expect(p.title).toBe("The Year You Were Three");
  });

  it("runs a household's from January to December", () => {
    const p = periodFor({ display_name: "The Wilsons", subject_type: "family" }, { today: TODAY });
    expect(p.start).toBe("2026-01-01");
    expect(p.end).toBe("2026-12-31");
    expect(p.title).toBe("Our Year, 2026");
  });

  it("knows a year still being lived through is not finished", () => {
    const p = periodFor({ display_name: "The Wilsons", subject_type: "family" }, { today: TODAY });
    expect(p.complete).toBe(false);
  });

  it("takes a household year it is given rather than assuming this one", () => {
    const p = periodFor(
      { display_name: "The Wilsons", subject_type: "family" },
      { today: TODAY, calendarYear: 2025 }
    );
    expect(p.title).toBe("Our Year, 2025");
    expect(p.complete).toBe(true);
  });
});

describe("the choices offered", () => {
  it("describes a book the way somebody would say it out loud", () => {
    // "The Year You Were Three" is what goes on the cover. Four options that
    // all start with those words is a chooser nobody can scan.
    const { options } = buildStories([child(), household()]);
    expect(options.map((o) => o.label)).toEqual(["Florence at 3", "The Wilsons in 2026"]);
  });

  it("keeps the printed title too, so the button can name the real thing", () => {
    const { options } = buildStories([child()]);
    expect(options[0].title).toBe("The Year You Were Three");
  });

  it("marks a story that does not have the material yet", () => {
    const { options } = buildStories([child({ material: MIN_MEMORIES_FOR_A_BOOK - 1 })]);
    expect(options[0].ready).toBe(false);
  });
});

describe("if you'd like us to choose", () => {
  it("suggests whichever has the most to work with", () => {
    // Not the oldest child, not the first one added. The question is which
    // book would be good today, and the honest answer is which has most in it.
    const { suggested } = buildStories([child({ material: 30 }), household({ material: 90 })]);
    expect(suggested?.label).toBe("The Wilsons in 2026");
  });

  it("says why, in arithmetic", () => {
    const { because } = buildStories([child({ material: 30 }), household({ material: 90 })]);
    expect(because).toContain("90 things");
  });

  it("never suggests one that is already started", () => {
    const { suggested } = buildStories([
      child({ material: 200, alreadyStarted: true, bookId: "b1" }),
      household({ material: 40 }),
    ]);
    expect(suggested?.label).toBe("The Wilsons in 2026");
  });

  it("suggests nothing rather than the least bad option", () => {
    // A recommendation the family will be disappointed by is worse than no
    // recommendation, and it is the product's own fault either way.
    const { suggested, because } = buildStories([child({ material: 4 }), household({ material: 6 })]);
    expect(suggested).toBeNull();
    expect(because).toBeNull();
  });
});

describe("when every book is already being made", () => {
  it("does not count down at a family who has done everything right", () => {
    // This produced "about -21 more and there's a book worth reading" on a
    // screen where two books were already under way, because "no suggestion"
    // and "nothing ready" had been collapsed into one state.
    const picker = buildStories([
      child({ material: 200, alreadyStarted: true, bookId: "b1" }),
      household({ material: 300, alreadyStarted: true, bookId: "b2" }),
    ]);
    expect(picker.suggested).toBeNull();
    expect(picker.allStarted).toBe(true);
  });

  it("never counts down past zero even if it is asked to", () => {
    const full = buildStories([child({ material: 900 })]).options[0];
    expect(nothingReadyYet(full)).not.toContain("-");
  });

  it("is not the same state as an archive with nothing in it", () => {
    expect(buildStories([child({ material: 3 })]).allStarted).toBe(false);
  });
});

describe("when nothing is ready", () => {
  it("counts down rather than quoting a threshold", () => {
    const { options } = buildStories([child({ material: 20 })]);
    const said = nothingReadyYet(options[0]);
    expect(said).toContain("20 things");
    expect(said).toContain(`${MIN_MEMORIES_FOR_A_BOOK - 20} more`);
  });

  it("says everything counts towards whichever they pick", () => {
    // True, and the thing that makes the wait tolerable: adding to the
    // archive is not adding to one book.
    expect(nothingReadyYet(buildStories([child({ material: 20 })]).options[0])).toContain(
      "whichever one you choose"
    );
  });

  it("says something honest about an empty archive", () => {
    expect(nothingReadyYet(undefined)).toContain("Nothing in here yet");
  });
});
