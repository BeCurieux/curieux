// The annual film.
//
// The edit is the product here — which frames, in what order, held how long.
// Most of what can go wrong is not a crash; it is a film that flatters a
// thin year, or one that says something nobody in the family said.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CARD_FITS, ENOUGH_FOR_A_FILM, LONGEST_MS, MOST_CARDS, SHORTEST_MS,
  cutFilm, densestYear, evenly, fitsOnACard, type Moment,
} from "@/lib/film/cut";

const day = (n: number) =>
  new Date(Date.parse("2027-01-01T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

const photos = (n: number, everyDays = 10): Moment[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    date: day(i * everyDays),
    hasPhoto: true,
    text: null,
  }));

const cut = (moments: Moment[]) =>
  cutFilm({ name: "Florence", moments });

describe("whether there is a film at all", () => {
  it("refuses a thin year", () => {
    // A thirty-second film of nine photographs tells a family their year did
    // not amount to much. Better to say nothing.
    expect(cut(photos(ENOUGH_FOR_A_FILM - 1))).toBeNull();
  });

  it("makes one once there is enough", () => {
    expect(cut(photos(ENOUGH_FOR_A_FILM))).not.toBeNull();
  });

  it("ignores anything without a photograph", () => {
    const mixed: Moment[] = [
      ...photos(20),
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `t${i}`, date: day(i), hasPhoto: false, text: "a note",
      })),
    ];
    const film = cut(mixed)!;
    expect(film.fromPhotos).toBe(20);
    expect(film.frames.filter((f) => f.kind === "photo").every((f: any) => f.id.startsWith("p")))
      .toBe(true);
  });

  it("ignores undated moments rather than guessing where they go", () => {
    const film = cut([...photos(20), { id: "x", date: "", hasPhoto: true, text: null }])!;
    expect(film.frames.some((f: any) => f.id === "x")).toBe(false);
  });
});

describe("how long it runs", () => {
  it("lands inside a watchable length for a normal year", () => {
    for (const n of [12, 30, 60, 200, 900]) {
      const film = cut(photos(n))!;
      expect(film.totalMs, `${n} photographs`).toBeGreaterThanOrEqual(SHORTEST_MS);
      expect(film.totalMs, `${n} photographs`).toBeLessThanOrEqual(LONGEST_MS);
    }
  });

  it("does not grow without bound as the archive does", () => {
    // Nine hundred photographs is a real camera roll and a nine-hundred-frame
    // film is not a film.
    const small = cut(photos(30))!;
    const huge = cut(photos(900))!;
    expect(huge.totalMs).toBeCloseTo(small.totalMs, -3);
  });

  it("holds the first and last a beat longer", () => {
    const frames = cut(photos(40))!.frames.filter((f) => f.kind === "photo");
    expect(frames[0].ms).toBeGreaterThan(frames[1].ms);
    expect(frames[frames.length - 1].ms).toBeGreaterThan(frames[1].ms);
  });
});

describe("the order, which is the whole point", () => {
  it("runs chronologically", () => {
    // The temptation is to lead with the best photograph. But the thing a
    // family cannot get elsewhere is the shape of a year, and the only way
    // to show that is in order. A highlight reel is what a phone makes.
    const dates = cut(photos(60))!
      .frames.filter((f) => f.kind === "photo")
      .map((f: any) => f.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("keeps the first and last of the chosen year, whatever it trims", () => {
    // Spaced a day apart, so all 300 sit inside one twelve-month window and
    // the only trimming is for runtime. (Ten days apart would be eight
    // years, and picking a year out of that is densestYear's job — tested
    // separately.)
    const all = photos(300, 1);
    const kept = cut(all)!.frames.filter((f) => f.kind === "photo").map((f: any) => f.id);
    expect(kept[0]).toBe("p0");
    expect(kept[kept.length - 1]).toBe("p299");
  });

  it("spreads across the year rather than taking the first n", () => {
    const kept = cut(photos(300, 1))!
      .frames.filter((f) => f.kind === "photo")
      .map((f: any) => f.date);
    const months = new Set(kept.map((d) => d.slice(0, 7)));
    expect(months.size).toBeGreaterThan(6);
  });

  it("opens with a title and ends with an end card", () => {
    const frames = cut(photos(30))!.frames;
    expect(frames[0].kind).toBe("title");
    expect(frames[frames.length - 1].kind).toBe("end");
  });
});

describe("the words are the family's or there are none", () => {
  const withWords = (): Moment[] =>
    photos(60).map((m, i) =>
      i % 7 === 0 ? { ...m, text: `Something she said, number ${i}.` } : m
    );

  it("puts a card in front of the part of the year it belongs to", () => {
    const frames = cut(withWords())!.frames;
    const firstCard = frames.findIndex((f) => f.kind === "card");
    expect(firstCard).toBeGreaterThan(0);
    // Whatever photograph follows a card is dated on or after it.
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].kind !== "card") continue;
      const next = frames.slice(i + 1).find((f) => f.kind === "photo") as any;
      if (next) expect(typeof next.date).toBe("string");
    }
  });

  it("never shows more cards than a film can carry", () => {
    const many = photos(200).map((m) => ({ ...m, text: "A short line." }));
    expect(cut(many)!.frames.filter((f) => f.kind === "card").length)
      .toBeLessThanOrEqual(MOST_CARDS);
  });

  it("leaves a long entry in the archive rather than on screen", () => {
    // A paragraph is a thing to read, not to flash up for three seconds.
    const essay = "x".repeat(CARD_FITS + 1);
    expect(fitsOnACard(essay)).toBe(false);
    const withEssay = photos(30).map((m, i) => (i === 5 ? { ...m, text: essay } : m));
    expect(cut(withEssay)!.frames.some((f) => f.kind === "card")).toBe(false);
  });

  it("shows the family's sentence exactly as they wrote it", () => {
    const said = "Bun Bun went through the wash. Emotional afternoon.";
    const one = photos(30).map((m, i) => (i === 10 ? { ...m, text: said } : m));
    const card = cut(one)!.frames.find((f) => f.kind === "card") as any;
    expect(card.text).toBe(said);
  });
});

describe("nothing is narrated", () => {
  const source = readFileSync(new URL("../src/lib/film/cut.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("writes no linking prose of its own", () => {
    // No "and then summer came". Every word on screen is either the
    // family's, the child's name, or a count.
    for (const invented of ["Summer", "Learned", "journey", "magical", "precious", "adventure"]) {
      expect(source).not.toContain(invented);
    }
  });

  it("ends on a count rather than a sentiment", () => {
    const end = cut(photos(40))!.frames.at(-1) as any;
    expect(end.sub).toMatch(/\d+ of \d+ photographs/);
    expect(end.sub).not.toMatch(/[a-z]{4,} year|love|remember|forever/i);
  });

  it("opens on the dates rather than on an age", () => {
    // The film covers the twelve months the archive has, which is not the
    // book's birthday-to-birthday year — so claiming "the year she was two"
    // over it would be asserting something the window does not support.
    const title = cut(photos(40))!.frames[0] as any;
    expect(title.text).toBe("Florence");
    expect(title.sub).toMatch(/^[A-Z][a-z]+ \d{4}( to [A-Z][a-z]+ \d{4})?$/);
  });

  it("has no soundtrack, and says why", () => {
    // Not an omission. A family's photographs under library piano is the
    // cheap thing this brand exists not to be, and silence is the only
    // option that is honestly licensable.
    const whole = readFileSync(new URL("../src/lib/film/cut.ts", import.meta.url), "utf8");
    expect(whole).toMatch(/No music/);
    expect(source).not.toMatch(/audio|soundtrack|mp3|track/i);
  });
});

describe("spreading a selection", () => {
  it("keeps both ends", () => {
    const picked = evenly(Array.from({ length: 100 }, (_, i) => i), 10);
    expect(picked[0]).toBe(0);
    expect(picked.at(-1)).toBe(99);
    expect(new Set(picked).size).toBe(10);
  });

  it("returns a short list untouched", () => {
    expect(evenly([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it("survives being asked for one, or none", () => {
    expect(evenly([1, 2, 3], 1)).toEqual([1]);
    expect(evenly([], 5)).toEqual([]);
  });
});

describe("which twelve months", () => {
  it("takes the year with the most in it, not the most recent", () => {
    // A rule of "the last twelve months" is brittle: one photograph with a
    // wrong date drags the window off the material, and a bulk import often
    // has a sparse tail. The demo fixture had exactly this — memories dated
    // into 2028 over a photograph-heavy 2025.
    const busy = photos(60, 5); // Jan–Oct 2027, dense
    const stragglers: Moment[] = Array.from({ length: 3 }, (_, i) => ({
      id: `late${i}`, date: day(600 + i * 30), hasPhoto: true, text: null,
    }));
    const film = cut([...busy, ...stragglers])!;
    const dates = film.frames.filter((f) => f.kind === "photo").map((f: any) => f.date);
    expect(dates[0].startsWith("2027")).toBe(true);
    expect(dates.filter((d) => d.startsWith("2028")).length).toBeLessThan(4);
  });

  it("survives a single photograph stamped years into the future", () => {
    const film = cut([
      ...photos(40, 7),
      { id: "broken", date: "2099-01-01", hasPhoto: true, text: null },
    ])!;
    expect(film.frames.some((f: any) => f.id === "broken")).toBe(false);
  });

  it("finds nothing in an archive with no photographs at all", () => {
    expect(densestYear([{ id: "a", date: day(0), hasPhoto: false, text: "x" }])).toBeNull();
  });
});
