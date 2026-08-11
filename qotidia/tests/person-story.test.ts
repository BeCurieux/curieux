// Nanna & Me.
//
// The first book that is not a year, and the payoff for the entity work: a
// question no photo library can answer, because it needs to know that
// Margaret and Maggie are one grandmother.
//
// Most of what is tested here is refusal. A query can always run; the
// judgement is whether offering it would sell somebody a disappointment.

import { describe, expect, it } from "vitest";
import {
  ENOUGH_FOR_A_PERSON,
  MUST_SPAN_DAYS,
  peopleWorthABook,
  personStory,
  titleFor,
} from "@/lib/book/person-story";
import type { Entity } from "@/lib/graph/presence";

/** A person with `n` memories spread evenly across `days`. */
function person(over: {
  id?: string;
  label: string;
  n: number;
  days: number;
  kind?: Entity["kind"];
}): Entity {
  const step = over.n > 1 ? over.days / (over.n - 1) : 0;
  return {
    id: over.id ?? "entity-nanna",
    kind: over.kind ?? "person",
    label: over.label,
    mentions: Array.from({ length: over.n }, (_, i) => ({
      memoryId: `m${i}`,
      date: new Date(Date.parse("2024-01-10T00:00:00Z") + i * step * 86_400_000)
        .toISOString()
        .slice(0, 10),
    })),
  };
}

/** Every memory has something written on it. */
const allWordy = (e: Entity) => new Set(e.mentions.map((m) => m.memoryId));

const confirmed = new Set(["entity-nanna"]);

describe("when it is a book", () => {
  const nanna = person({ label: "Nanna", n: 30, days: 1400 });

  it("is called what the child calls her", () => {
    // The books address the child — "This was you at two" — so the cover is
    // theirs too. "Florence and Margaret" is how a registry office would
    // put it.
    expect(titleFor("Nanna")).toBe("Nanna & Me");
    const story = personStory({ person: nanna, wordy: allWordy(nanna), confirmed: true })!;
    expect(story.title).toBe("Nanna & Me");
    expect(story.ready).toBe(true);
    expect(story.notYet).toBeNull();
  });

  it("says what it is in facts rather than adjectives", () => {
    const story = personStory({ person: nanna, wordy: allWordy(nanna), confirmed: true })!;
    expect(story.subtitle).toBe("30 moments together, 2024–2027");
    expect(story.subtitle).not.toMatch(/precious|beautiful|special|treasured/i);
  });

  it("counts a memory once, however many times it is mentioned", () => {
    const twice: Entity = {
      ...nanna,
      mentions: [...nanna.mentions, { memoryId: "m0", date: "2024-01-10" }],
    };
    const story = personStory({ person: twice, wordy: allWordy(twice), confirmed: true })!;
    expect(story.memoryIds).toHaveLength(30);
  });
});

describe("when it is not, and why", () => {
  it("will not build a book about somebody nobody has identified", () => {
    // The worst version of this feature is guessing a relationship into
    // existence and then printing it.
    const story = personStory({
      person: person({ label: "Margaret", n: 40, days: 1400 }),
      wordy: new Set(Array.from({ length: 40 }, (_, i) => `m${i}`)),
      confirmed: false,
    })!;
    expect(story.ready).toBe(false);
    expect(story.notYet).toMatch(/who this is/i);
  });

  it("says how many more moments it needs", () => {
    const thin = person({ label: "Nanna", n: ENOUGH_FOR_A_PERSON - 3, days: 1400 });
    const story = personStory({ person: thin, wordy: allWordy(thin), confirmed: true })!;
    expect(story.ready).toBe(false);
    expect(story.notYet).toContain("3 more moments");
  });

  it("does not sell a chapter of a book they already have", () => {
    // Everything inside one year is already in that year's volume. The whole
    // distinguishing claim of this book is that it is longitudinal.
    const oneYear = person({ label: "Nanna", n: 30, days: MUST_SPAN_DAYS - 100 });
    const story = personStory({ person: oneYear, wordy: allWordy(oneYear), confirmed: true })!;
    expect(story.ready).toBe(false);
    expect(story.notYet).toMatch(/within one year/i);
    expect(story.notYet).toMatch(/another year/i);
  });

  it("refuses a pile of photographs with nothing written on any of them", () => {
    // A relationship book has no chronology to carry it, so it leans harder
    // on the words than an annual one does.
    const silent = person({ label: "Nanna", n: 30, days: 1400 });
    const story = personStory({ person: silent, wordy: new Set(["m0", "m1"]), confirmed: true })!;
    expect(story.ready).toBe(false);
    expect(story.notYet).toMatch(/written down/i);
  });

  it("is not offered for a rabbit", () => {
    expect(
      personStory({
        person: person({ label: "Bun Bun", n: 40, days: 1400, kind: "thing" }),
        wordy: new Set(),
        confirmed: true,
      })
    ).toBeNull();
  });

  it("survives a person whose memories have no usable dates", () => {
    const undated: Entity = {
      id: "entity-nanna",
      kind: "person",
      label: "Nanna",
      mentions: [{ memoryId: "a", date: "sometime" }],
    };
    expect(personStory({ person: undated, wordy: new Set(), confirmed: true })).toBeNull();
  });
});

describe("the picker", () => {
  it("puts the ones that are ready first", () => {
    const nanna = person({ id: "e-nanna", label: "Nanna", n: 30, days: 1400 });
    const grandpa = person({ id: "e-grandpa", label: "Grandpa", n: 20, days: 200 });
    const wordy = new Set([...allWordy(nanna), ...allWordy(grandpa)]);
    const out = peopleWorthABook([grandpa, nanna], wordy, new Set(["e-nanna", "e-grandpa"]));
    expect(out[0].personLabel).toBe("Nanna");
    expect(out[0].ready).toBe(true);
    expect(out[1].ready).toBe(false);
  });

  it("still shows the ones that are close, with the reason", () => {
    // "One more year and this is a book" is a reason to keep going. Hiding
    // it is how a feature stays invisible until somebody stumbles on it.
    const nearly = person({ id: "e-x", label: "Grandpa", n: 30, days: 300 });
    const out = peopleWorthABook([nearly], allWordy(nearly), new Set(["e-x"]));
    expect(out).toHaveLength(1);
    expect(out[0].notYet).toBeTruthy();
  });
});
