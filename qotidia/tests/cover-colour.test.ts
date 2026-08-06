// Choosing a cover colour.
//
// The precedence between the three sources is the whole design, and the
// failure it exists to prevent is silent: a parent sets one volume by hand,
// later changes the standing preference for the child, and the volume they
// chose quietly becomes something else. Nothing errors. They find out when
// the book arrives.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGE_COLOURS,
  COLOUR_CHOICES,
  colourById,
  colourForAge,
  colourForBook,
  coverContrastOk,
  isFollowingDefault,
} from "@/lib/book/colours";

const root = join(__dirname, "..");

describe("which colour a book is printed in", () => {
  it("follows the age spectrum when nothing has been chosen", () => {
    expect(colourForBook({ age: 2 }).id).toBe(colourForAge(2).id);
    expect(colourForBook({ bookColour: null, subjectColour: null, age: 7 }).id).toBe(
      colourForAge(7).id
    );
  });

  it("uses the child's standing preference over the spectrum", () => {
    // "Make them all walnut."
    expect(colourForBook({ subjectColour: "walnut", age: 2 }).id).toBe("walnut");
  });

  it("lets one volume differ, and keeps it that way", () => {
    // The failure this guards: a book set by hand being reset by a later
    // change to the child's default. The book's own choice wins, always.
    expect(colourForBook({ bookColour: "brick", subjectColour: "walnut", age: 2 }).id).toBe("brick");
  });

  it("falls back rather than failing on a colour that no longer exists", () => {
    // Colours may be retired from the palette. A book printed in one four
    // years ago must still render — a shelf reading slightly differently is
    // a far better outcome than a render job that throws at print time.
    expect(colourForBook({ bookColour: "burnt_sienna_1998", age: 3 }).id).toBe(colourForAge(3).id);
    expect(colourForBook({ subjectColour: "not_a_colour", age: 3 }).id).toBe(colourForAge(3).id);
    expect(colourById("nope")).toBeNull();
  });

  it("knows the difference between choosing the default and choosing nothing", () => {
    // The picker shows "following the spectrum" as a state. Without this a
    // parent who changed nothing looks like they made a choice, and cannot
    // find the way back.
    expect(isFollowingDefault(null)).toBe(true);
    expect(isFollowingDefault("")).toBe(true);
    expect(isFollowingDefault("walnut")).toBe(false);
  });
});

describe("the colours on offer", () => {
  it("gives every colour a stable id, because the id goes in the database", () => {
    const ids = AGE_COLOURS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z_]+$/);
  });

  it("offers only colours that are legible as a cover", () => {
    // The picker is a way to choose, not a way to make an unreadable book.
    // Every option a parent can pick has to clear the same contrast bar the
    // age spectrum was validated against.
    for (const c of COLOUR_CHOICES) {
      expect(coverContrastOk(c), `${c.name} is not legible as a cover`).toBe(true);
    }
  });

  it("does not let a form post write a colour that isn't in the palette", () => {
    // There is no foreign key behind the column — deliberately, so a retired
    // colour cannot break an old book. That makes this validation in the
    // action the only thing between a typo and a cover in the fallback.
    const actions = readFileSync(join(root, "src/app/actions.ts"), "utf8");
    expect(actions).toMatch(/colourById\(raw\)\?\.id \?\? null/);
  });
});

describe("when the choice closes", () => {
  it("stops accepting changes once the book is with a printer", () => {
    // Showing a parent a colour their book will never be is worse than
    // telling them the moment has passed.
    const actions = readFileSync(join(root, "src/app/actions.ts"), "utf8");
    const page = readFileSync(join(root, "src/app/books/[bookId]/page.tsx"), "utf8");
    for (const status of ["ordered", "in_production", "shipped", "delivered"]) {
      expect(actions, `${status} not locked in the action`).toContain(`"${status}"`);
      expect(page, `${status} not hidden in the UI`).toContain(`"${status}"`);
    }
  });

  it("applies the standing preference without overwriting choices already made", () => {
    const actions = readFileSync(join(root, "src/app/actions.ts"), "utf8");
    const fn = actions.slice(actions.indexOf("export async function setCoverColourForAll"));
    // It must touch subjects, and must not bulk-update books.cover_colour.
    expect(fn).toContain('.from("subjects").update({ cover_colour');
    expect(fn).not.toMatch(/from\("books"\)\s*\.update\(\{\s*cover_colour/);
  });
});
