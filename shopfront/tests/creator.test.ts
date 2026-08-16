/**
 * Attribution.
 *
 * This is the one field in the system that carries a real person's name onto a
 * public URL, so the tests are about the two ways that goes wrong: a handle
 * read wrongly from what somebody pasted, and a handle that should have been
 * refused being quietly turned into something publishable.
 */

import { describe, expect, it } from "vitest";
import { creatorSlugSeed, creditLine, normaliseHandle, readCreator } from "@/lib/creator";
import { slugify } from "@/lib/publish/slug";

describe("normaliseHandle", () => {
  it("reads the handle off whatever was pasted", () => {
    // All five of these are what actually arrives when somebody is asked for
    // "the creator's handle" over a message.
    for (const input of [
      "ana.ruiz",
      "@ana.ruiz",
      "@Ana.Ruiz",
      "https://instagram.com/ana.ruiz",
      "https://www.tiktok.com/@ana.ruiz?lang=en",
    ]) {
      expect(normaliseHandle(input), input).toBe("ana.ruiz");
    }
  });

  it("takes the profile, not the post", () => {
    // A reel URL names a post; its author is not in the path. Taking the first
    // segment is right, and taking more would invent a handle out of an id.
    expect(normaliseHandle("https://instagram.com/ana.ruiz/reel/C8xYz")).toBe("ana.ruiz");
  });

  it("leaves a bare handle from an unknown platform alone", () => {
    // Not every creator is on a host in the list, and stripping something out
    // of a URL we do not recognise would be guessing.
    expect(normaliseHandle("  @Some_One  ")).toBe("some_one");
  });
});

describe("readCreator", () => {
  it("falls back to the handle when no name was given", () => {
    // A handle is a name somebody chose. It is what a credit reads as anyway
    // when nothing better was supplied, and it is not an invention.
    expect(readCreator({ handle: "@ana.ruiz" })).toEqual({ name: "ana.ruiz", handle: "ana.ruiz" });
  });

  it("keeps the name and the profile when they were given", () => {
    expect(readCreator({ handle: "ana.ruiz", name: "Ana Ruiz", url: "https://instagram.com/ana.ruiz" })).toEqual({
      handle: "ana.ruiz",
      name: "Ana Ruiz",
      url: "https://instagram.com/ana.ruiz",
    });
  });

  it("refuses a handle it cannot read rather than mangling one", () => {
    // The failure this exists to prevent: publishing a public page crediting
    // somebody under a handle nobody typed. Throwing is loud; a fallback would
    // look exactly like success.
    for (const bad of ["", "@", "spaces here", "trailing.", ".leading", "ünïcode", "a".repeat(40)]) {
      expect(() => readCreator({ handle: bad }), JSON.stringify(bad)).toThrow();
    }
  });

  it("accepts a one-character handle, because those are real people", () => {
    // The obvious "tidy" rule here is a minimum length of two or three. Both
    // platforms issue single-letter handles, so that rule would refuse a
    // creator by name in order to look neat.
    expect(readCreator({ handle: "@m" }).handle).toBe("m");
  });

  it("refuses a profile link that is not a URL", () => {
    expect(() => readCreator({ handle: "ana.ruiz", url: "instagram.com/ana.ruiz" })).toThrow();
  });
});

describe("the credit and the URL", () => {
  it("claims only that a person picked these", () => {
    const line = creditLine(readCreator({ handle: "ana.ruiz", name: "Ana Ruiz" }));
    expect(line).toBe("Chosen by Ana Ruiz");

    // Nothing about a partnership, an endorsement or a commission. The system
    // knows a name was passed at publish time and knows nothing else.
    expect(line).not.toMatch(/partner|exclusive|official|sponsor|ambassador|collab/i);
  });

  it("seeds a slug that survives slugify with both names intact", () => {
    // The seed is only useful if the dots and the space come out as one
    // readable URL — `kelpandcotton-ana-ruiz`, not `kelpandcottonanaruiz`.
    const seed = creatorSlugSeed("Kelp & Cotton", readCreator({ handle: "ana.ruiz" }));
    expect(slugify(seed)).toBe("kelp-and-cotton-ana-ruiz");
  });
});
