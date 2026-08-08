// The photography slots.
//
// Every slot falls back to something already in the repository, so the site
// is never broken while the real photographs do not exist. That only works
// if the fallbacks are real files — and a fallback that 404s is invisible to
// TypeScript, invisible to the build, and visible only to a person looking
// at the page.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AVOID, MARKETING, SHOT_LIST, type SlotName } from "@/lib/marketing/imagery";

const inPublic = (src: string) => fileURLToPath(new URL(`../public${src}`, import.meta.url));
const slots = Object.keys(MARKETING) as SlotName[];

describe("marketing photography", () => {
  it("has a file behind every slot, real or fallback", () => {
    for (const name of slots) {
      const image = MARKETING[name]();
      expect(existsSync(inPublic(image.src)), `${name} points at ${image.src}`).toBe(true);
      expect(existsSync(inPublic(image.fallback)), `${name} falls back to ${image.fallback}`).toBe(true);
    }
  });

  it("describes every slot for somebody who cannot see it", () => {
    for (const name of slots) {
      expect(MARKETING[name]().alt.length, `${name} alt text`).toBeGreaterThan(20);
    }
  });

  it("tells the truth about whether a photograph exists", () => {
    // isPhoto is what the page branches on — a hero photograph gets a plain
    // frame, a cover render gets the perspective-and-spine treatment, and
    // applying the second to the first puts a fake shadow under a real one.
    for (const name of slots) {
      const image = MARKETING[name]();
      expect(image.isPhoto).toBe(image.src !== image.fallback);
    }
  });

  it("briefs every slot it defines", () => {
    // The shot list is the deliverable that unblocks the site. Adding a slot
    // without briefing it is how it stays empty.
    for (const name of slots) {
      expect(
        SHOT_LIST.some((s) => s.slot === name),
        `${name} has no entry in SHOT_LIST`
      ).toBe(true);
    }
    for (const shot of SHOT_LIST) {
      expect(shot.brief.length, `${shot.file} brief`).toBeGreaterThan(60);
    }
  });

  it("keeps the list of what to avoid, which is half the brief", () => {
    expect(AVOID.length).toBeGreaterThan(4);
  });
});
