/**
 * What the page must be true of, measured in a browser that laid it out.
 *
 * Every assertion below corresponds to a regression that has either happened or
 * would have been invisible to the jsdom suite:
 *
 *   - a 4/5 hero plate computing to 1340px on a 900px desktop viewport, so the
 *     fold was one photograph and the grid was pushed out of view;
 *   - the same ratio flattening five moods onto one height, so a mood's
 *     requested hero height had no effect on desktop at all;
 *   - `.shop a { color: inherit }` outranking `.cta`, rendering the only
 *     button's label white on a pale ground;
 *   - the text column drifting between masthead, section head, cards and
 *     colophon, which is the kind of thing that reads as "generated".
 *
 * These are cheap to check and expensive to notice by eye, which is the whole
 * argument for the file.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { contrastRatio, parseColour } from "@/lib/ingest/colour";
import { SOLD_OUT_HANDLES } from "./fixture-store";
import {
  boxOf,
  browserAvailable,
  browserRequired,
  startHarness,
  open,
  DESKTOPS,
  MOODS,
  PHONE,
  PLATED_MOODS,
  type Harness,
  type Mood,
  type Viewport,
} from "./harness";

/**
 * The hero may be the largest thing on the page and still must not *be* the
 * page. Above this share of the viewport there is nothing under it to scroll
 * to, which is the failure this suite was written for — the bug measured 1.49.
 */
const MAX_HERO_SHARE = 0.85;

/** Mood hero heights, shortest first. Ordering is the point, not the numbers. */
const HERO_ORDER: Mood[] = ["utility", "clean", "playful", "editorial", "luxe"];

/** WCAG AA for body-sized text. */
const MIN_CONTRAST = 4.5;

let harness: Harness;

const describeVisual = browserAvailable() ? describe : describe.skip;

/**
 * In CI a missing browser is a failure, not a skip.
 *
 * "94 skipped" and "94 passed" look the same from ten feet away on a summary
 * page, so if the install step ever silently stops producing a Chromium this
 * has to say so rather than let a green tick certify nothing.
 */
if (browserRequired() && !browserAvailable()) {
  describe("geometry", () => {
    it("has a browser to measure with", () => {
      throw new Error(
        "CI is set but no Chromium was found. Expected `playwright install chromium` to have run, or CHROMIUM_PATH to point at one.",
      );
    });
  });
}

describeVisual("geometry", () => {
  beforeAll(async () => {
    harness = await startHarness();
  }, 180_000);

  afterAll(async () => {
    await harness?.close();
  });

  describe.each(DESKTOPS)("on desktop at $label", (viewport: Viewport) => {
    it.each(MOODS)("%s keeps the hero inside the screen", async (mood) => {
      const page = await open(harness, mood, viewport);
      try {
        const hero = await boxOf(page, ".hero-plate");
        expect(hero).not.toBeNull();
        expect(hero!.height / viewport.height).toBeLessThanOrEqual(MAX_HERO_SHARE);
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s does not clip its hero copy", async (mood) => {
      // The plate is `overflow: hidden`, so a hero that stops governing its own
      // height silently eats the tagline rather than failing loudly.
      const page = await open(harness, mood, viewport);
      try {
        const plate = await boxOf(page, ".hero-plate");
        const copy = await boxOf(page, ".hero-copy");
        expect(copy!.bottom).toBeLessThanOrEqual(plate!.bottom + 1);
      } finally {
        await page.close();
      }
    });

    it("keeps the moods on distinct, ordered hero heights", async () => {
      // The desktop bug was not only "too tall": the ratio overrode
      // `--hero-height` entirely, so every mood landed on the same number. A
      // cap alone would have fixed the height and left the moods identical.
      const heights: number[] = [];
      for (const mood of HERO_ORDER) {
        const page = await open(harness, mood, viewport);
        try {
          heights.push((await boxOf(page, ".hero-plate"))!.height);
        } finally {
          await page.close();
        }
      }

      expect(heights).toEqual([...heights].sort((a, b) => a - b));
      expect(new Set(heights).size).toBe(HERO_ORDER.length);
    });

    it.each(MOODS)("%s holds one text column", async (mood) => {
      const page = await open(harness, mood, viewport);
      try {
        const xs = await Promise.all(
          [".masthead .name", ".section-head h2", ".card-title", ".colophon"].map(async (selector) => ({
            selector,
            x: (await boxOf(page, selector))?.x ?? null,
          })),
        );

        const found = xs.filter((entry) => entry.x !== null);
        expect(found.length).toBeGreaterThanOrEqual(3);
        const spread = Math.max(...found.map((e) => e.x!)) - Math.min(...found.map((e) => e.x!));
        expect(spread, JSON.stringify(found)).toBeLessThanOrEqual(1);
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s lays the grid out in three columns", async (mood) => {
      const page = await open(harness, mood, viewport);
      try {
        expect(await columnCount(page)).toBe(3);
      } finally {
        await page.close();
      }
    });
  });

  describe("on a phone", () => {
    it.each(PLATED_MOODS)("%s keeps the portrait plate the ratio is there for", async (mood) => {
      // The desktop fix lives inside a min-width block precisely so this stays
      // true. A future fix that edits the base rule instead lands here.
      //
      // "Portrait, filling the column" rather than "exactly 4/5", because 4/5
      // and `--hero-height` cannot both be satisfied and only one of them can
      // be allowed to win. A 350px column crops to 437px at 4/5, which is
      // 52svh — under utility's 46svh floor and over clean's 58svh one. Letting
      // the ratio win outright would flatten every mood on a phone onto that
      // same 437px, which is the desktop bug wearing a different hat; letting
      // the floor win keeps clean taller than utility, which is the whole
      // reason moods carry a hero height. So the ratio is the shape a mood gets
      // when it does not ask for more, and a floor above it makes the plate
      // more portrait, never less, and never wider than the column.
      const page = await open(harness, mood, PHONE);
      try {
        const hero = await heroBounds(page);
        const box = (await boxOf(page, ".hero-plate"))!;

        expect(box.width).toBe(hero.columnRight - hero.columnLeft);
        expect(box.width / box.height).toBeLessThanOrEqual(0.8 + 0.005);
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s keeps the grid two-up", async (mood) => {
      // Two, not one. A phone grid of single full-width cards turns eight
      // products into eight screens of scrolling, and the plate is cropped to
      // one ratio precisely so a pair of them can sit side by side.
      const page = await open(harness, mood, PHONE);
      try {
        expect(await columnCount(page)).toBe(2);
      } finally {
        await page.close();
      }
    });
  });

  describe.each([PHONE, ...DESKTOPS])("at $label", (viewport: Viewport) => {
    it.each(MOODS)("%s keeps the hero inside the edges it is laid out against", async (mood) => {
      // The test below this one cannot see the failure this one catches, and
      // the reason is worth writing down: `.shop` is `overflow-x: hidden`, so
      // `scrollWidth` is clamped to the viewport whatever the layout does. A
      // box hanging off the right edge reports zero overflow and gets silently
      // cropped. Only the box itself tells the truth.
      //
      // The failure that prompted this: a 4/5 plate computing 392px wide inside
      // a 350px column on a 390px phone, right edge at 412. `aspect-ratio`
      // resolves in whichever direction is left free, and clean's
      // `min-height: 58svh` (489px) beat the ratio's height (437px), so the
      // ratio turned around and derived the *width* from the height instead —
      // 489 ÷ 1.25 = 392. Utility escaped only by being short enough that the
      // ratio still won.
      const page = await open(harness, mood, viewport);
      try {
        const hero = await heroBounds(page);

        // True of every mood: bleed heroes are meant to reach the glass, not
        // pass through it.
        expect(hero.left, JSON.stringify(hero)).toBeGreaterThanOrEqual(-1);
        expect(hero.right, JSON.stringify(hero)).toBeLessThanOrEqual(viewport.width + 1);

        // A plated hero owes more: it belongs to the text column, so sitting
        // inside the screen is not enough — it has to sit inside the column.
        if (PLATED_MOODS.includes(mood)) {
          expect(hero.left, JSON.stringify(hero)).toBeGreaterThanOrEqual(hero.columnLeft - 1);
          expect(hero.right, JSON.stringify(hero)).toBeLessThanOrEqual(hero.columnRight + 1);
        }
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s never scrolls sideways", async (mood) => {
      // A full-bleed hero is built out of `100vw` and a negative margin, which
      // is one scrollbar away from overflowing the document.
      const page = await open(harness, mood, viewport);
      try {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s shows every sold-out product, marked", async (mood) => {
      // A product rule, not a taste one: "sold-out products are shown (marked),
      // never hidden". Hiding them would make the page quietly lie about the
      // catalogue, and it is the kind of change a selection tweak makes by
      // accident.
      const page = await open(harness, mood, viewport);
      try {
        const rendered = await page.evaluate(() =>
          [...document.querySelectorAll(".card")].map((card) => ({
            handle: card.getAttribute("data-fnl-handle"),
            marked: card.classList.contains("card--soldout"),
            chip: card.querySelector(".stock")?.textContent?.trim() ?? null,
          })),
        );

        for (const handle of SOLD_OUT_HANDLES) {
          const card = rendered.find((entry) => entry.handle === handle);
          expect(card, `${handle} is missing from the page`).toBeDefined();
          expect(card!.marked).toBe(true);
          expect(card!.chip).toBe("Sold out");
        }

        // And nothing in stock is wearing the mark.
        const falselyMarked = rendered.filter(
          (entry) => entry.marked && !SOLD_OUT_HANDLES.includes(entry.handle ?? ""),
        );
        expect(falselyMarked).toEqual([]);
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s renders every label legibly", async (mood) => {
      const page = await open(harness, mood, viewport);
      try {
        for (const check of await readableText(page)) {
          expect(
            check.ratio,
            `${check.selector}: ${check.colour} on ${check.background} is ${check.ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      } finally {
        await page.close();
      }
    });
  });
});

/** How many cards share the first row's top edge. */
async function columnCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".grid > *")];
    if (cards.length === 0) return 0;
    // The desktop grid staggers alternate columns, so rows are compared by
    // horizontal position rather than by a shared top edge.
    const xs = cards.map((card) => Math.round(card.getBoundingClientRect().x));
    return new Set(xs).size;
  });
}

interface HeroBounds {
  left: number;
  right: number;
  /** The content box of the plate's containing block — the column it was laid out in. */
  columnLeft: number;
  columnRight: number;
}

/**
 * Where the hero actually is, against where it was given room to be.
 *
 * Measured off the plate rather than off a scroll offset on purpose: a
 * `getBoundingClientRect` is unaffected by `overflow: hidden`, so it reports an
 * escaped box that the document has already finished cropping.
 */
async function heroBounds(page: Page): Promise<HeroBounds> {
  return page.evaluate(() => {
    const plate = document.querySelector(".hero-plate");
    if (!plate) throw new Error("no .hero-plate on the page");
    const parent = plate.parentElement;
    if (!parent) throw new Error(".hero-plate has no containing block");

    const rect = plate.getBoundingClientRect();
    const around = parent.getBoundingClientRect();
    const style = getComputedStyle(parent);
    const inset = (value: string) => parseFloat(value) || 0;

    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      columnLeft: Math.round(around.left + inset(style.paddingLeft) + inset(style.borderLeftWidth)),
      columnRight: Math.round(around.right - inset(style.paddingRight) - inset(style.borderRightWidth)),
    };
  });
}

interface ContrastCheck {
  selector: string;
  colour: string;
  background: string;
  ratio: number;
}

/**
 * Text whose colour is computed rather than written down.
 *
 * The `.cta` case is the one with history: `.shop a { color: inherit }` scored
 * higher than `.cta`, so the only button on the page rendered its label in the
 * page's own ink on the accent fill. It looked fine in the schema and was
 * invisible to every test we had.
 */
async function readableText(page: Page): Promise<ContrastCheck[]> {
  const samples = await page.evaluate(() => {
    const selectors = [".cta", ".card-title", ".card-price", ".section-head h2", ".colophon", ".stock"];
    const opaque = (el: Element): string => {
      let node: Element | null = el;
      while (node) {
        const background = getComputedStyle(node).backgroundColor;
        if (background && !/rgba?\([^)]*,\s*0\s*\)$/.test(background) && background !== "transparent") return background;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };

    return selectors.flatMap((selector) => {
      const el = document.querySelector(selector);
      if (!el) return [];
      return [{ selector, colour: getComputedStyle(el).color, background: opaque(el) }];
    });
  });

  return samples.flatMap((sample) => {
    const colour = parseColour(sample.colour);
    const background = parseColour(sample.background);
    if (!colour || !background) return [];
    return [{ ...sample, ratio: contrastRatio(colour, background) }];
  });
}
