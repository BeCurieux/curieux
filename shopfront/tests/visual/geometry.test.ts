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
  urlFor,
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

/** Desktop columns per mood. Two is a gallery, four is a catalogue page. */
const GRID_COLUMNS: Record<Mood, number> = {
  utility: 4,
  clean: 3,
  playful: 3,
  editorial: 3,
  luxe: 2,
};

/** The moods that set their headline on the photograph rather than under it. */
const OVERLAY_MOODS: Mood[] = ["editorial", "playful", "luxe"];

/** WCAG AA for body-sized text. */
const MIN_CONTRAST = 4.5;

/**
 * The smallest a tappable thing may be on a phone.
 *
 * 44px rather than WCAG's 24px minimum: 44 is the figure both platform
 * guidelines settled on, and these pages are opened one-handed from a link in
 * a bio rather than studied at a desk.
 */
const MIN_TAP_TARGET = 44;

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

    it.each(OVERLAY_MOODS)("%s does not clip its hero copy", async (mood) => {
      // The plate is `overflow: hidden`, so a hero that stops governing its own
      // height silently eats the tagline rather than failing loudly.
      //
      // Overlay moods only, and the exclusion is the point rather than an
      // exemption: copy that sits under the plate is not inside the box doing
      // the clipping, so asserting it fits would be asserting nothing. The
      // test below checks those moods are actually outside it.
      const page = await open(harness, mood, viewport);
      try {
        const plate = await boxOf(page, ".hero-plate");
        const copy = await boxOf(page, ".hero-copy");
        expect(copy!.bottom).toBeLessThanOrEqual(plate!.bottom + 1);
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s puts the hero copy where the mood asked for it", async (mood) => {
      // Where the headline sits is the largest single difference between the
      // moods above the fold, and it is one a screenshot comparison would call
      // "looks different" without saying which way round.
      const page = await open(harness, mood, viewport);
      try {
        const plate = (await boxOf(page, ".hero-plate"))!;
        const copy = (await boxOf(page, ".hero-copy"))!;
        if (OVERLAY_MOODS.includes(mood)) {
          expect(copy.y, "copy should be on the photograph").toBeGreaterThanOrEqual(plate.y - 1);
          expect(copy.bottom).toBeLessThanOrEqual(plate.bottom + 1);
        } else {
          expect(copy.y, "copy should start below the plate").toBeGreaterThanOrEqual(plate.bottom - 1);
        }
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

    it.each(MOODS)("%s lays the grid out in the columns its mood asked for", async (mood) => {
      // This used to assert three for everybody, which is how five moods ended
      // up looking like one design with the type swapped. The count is the
      // loudest thing a mood says on a desktop, so it is worth pinning per
      // mood rather than asserting they all agree.
      const page = await open(harness, mood, viewport);
      try {
        expect(await columnCount(page)).toBe(GRID_COLUMNS[mood]);
      } finally {
        await page.close();
      }
    });

    it("does not lay every mood out the same way", async () => {
      // The regression this guards is not a broken page — it is five pages that
      // work and are indistinguishable. Measured rather than declared: the
      // numbers below come out of a laid-out browser, so a token that stops
      // reaching the CSS shows up here even though `render-theme.test.ts` would
      // still be green.
      const signatures = new Map<string, string>();
      for (const mood of MOODS) {
        const page = await open(harness, mood, viewport);
        try {
          signatures.set(mood, await layoutSignature(page));
        } finally {
          await page.close();
        }
      }

      const seen = new Set(signatures.values());
      expect(seen.size, [...signatures].map(([m, s]) => `${m}: ${s}`).join("\n")).toBe(MOODS.length);
    });

    it("gives exactly one mood level rows", async () => {
      // A stagger of zero is a deliberate setting, and the kind that a later
      // "tidy up the grid" edit removes without noticing. It is also the only
      // way to tell whether `--grid-stagger` is being read at all: every other
      // value looks like the default from ten feet away.
      const level: string[] = [];
      for (const mood of MOODS) {
        const page = await open(harness, mood, viewport);
        try {
          if ((await rowOffsets(page)).every((offset) => offset === 0)) level.push(mood);
        } finally {
          await page.close();
        }
      }
      expect(level).toEqual(["utility"]);
    });
  });

  describe("when the photographs do not arrive", () => {
    /**
     * Found by running against a real store, not by imagining one.
     *
     * The renderer had a considered answer for a product with no photograph and
     * no answer at all for a photograph whose URL is dead. Every plate rendered
     * the browser's broken-image glyph with the alt text spilling across it, and
     * the hero's white headline sat unreadable on the pale plate, because the
     * scrim that makes white legible assumes there is a photograph beneath it.
     *
     * Merchants delete photos and CDN paths change, so this is routine rather
     * than exotic. Every image request is failed here rather than pointed at a
     * bad URL, because that is what a dead CDN actually does.
     */
    const openBroken = async (mood: Mood, viewport: Viewport): Promise<Page> => {
      const page = await harness.browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      // Matched on the URL rather than by intercepting everything and checking
      // `resourceType`: routing every request also puts the framework's own
      // chunks through the handler, and the page never finished hydrating — so
      // the listener that does the recovery never ran and the test failed for a
      // reason that had nothing to do with images.
      await page.route(/\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/i, (route) => route.abort());
      await page.goto(urlFor(harness.base, mood), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      // Settle rather than wait for the recovery's own marker. Gating on
      // `[data-broken]` made both tests below fail at the gate when the fix was
      // removed, which looks like a pass but proves nothing: the contrast
      // assertion never ran. Waiting for the page to stop moving lets each test
      // fail on the thing it is actually about.
      await page.waitForTimeout(1_200);
      return page;
    };

    it.each(MOODS)("%s shows an initial instead of a broken glyph", async (mood) => {
      const page = await openBroken(mood, PHONE);
      try {
        const state = await page.evaluate(() => {
          const plates = [...document.querySelectorAll(".plate")];
          return {
            plates: plates.length,
            // The fixture includes a product with no photograph at all, whose
            // plate has no <img> to fail and needs no marking — it is already
            // showing its initial. Only the plates that asked for an image are
            // the ones this recovery is about.
            withImages: plates.filter((p) => p.querySelector("img") !== null).length,
            marked: plates.filter((p) => p.hasAttribute("data-broken")).length,
            // A visible <img> is the glyph, and the glyph is the failure.
            visibleImages: plates.filter((p) => {
              const image = p.querySelector("img");
              return image !== null && getComputedStyle(image).display !== "none";
            }).length,
            initialsShown: plates.filter((p) => {
              const initial = p.querySelector(".plate-initial");
              return initial !== null && Number(getComputedStyle(initial).opacity) > 0.9;
            }).length,
          };
        });

        expect(state.plates).toBeGreaterThan(0);
        expect(state.withImages).toBeGreaterThan(0);
        expect(state.marked).toBe(state.withImages);
        expect(state.visibleImages).toBe(0);
        // Every plate ends up showing an initial, whichever way it got there.
        expect(state.initialsShown).toBe(state.plates);
      } finally {
        await page.close();
      }
    });

    it.each(MOODS)("%s keeps the headline readable", async (mood) => {
      // The one that actually hurt: the largest words on the page turning white
      // on cream. Measured against the plate the type is sitting on, because
      // that is what a reader sees.
      const page = await openBroken(mood, PHONE);
      try {
        const sample = await page.evaluate(() => {
          const h1 = document.querySelector(".hero-copy h1");
          const plate = document.querySelector(".hero-plate");
          if (!h1 || !plate) return null;
          const behind = (el: Element): string => {
            let node: Element | null = el;
            while (node) {
              const background = getComputedStyle(node).backgroundColor;
              if (background && !/rgba?\([^)]*,\s*0\s*\)$/.test(background)) return background;
              node = node.parentElement;
            }
            return getComputedStyle(document.body).backgroundColor;
          };
          return { colour: getComputedStyle(h1).color, background: behind(plate) };
        });

        expect(sample).not.toBeNull();
        const colour = parseColour(sample!.colour);
        const background = parseColour(sample!.background);
        expect(colour).not.toBeNull();
        expect(background).not.toBeNull();
        expect(
          contrastRatio(colour!, background!),
          `${sample!.colour} on ${sample!.background}`,
        ).toBeGreaterThanOrEqual(MIN_CONTRAST);
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

    it.each(MOODS)("%s gives every link a thumb to land on", async (mood) => {
      // Found by measuring rather than by looking: the colophon's "Visit the
      // full store" link was 19px tall — under half a comfortable touch target,
      // on the link that sends a shopper to the merchant's actual storefront.
      // Everything else on the page already cleared it, which is exactly why
      // one that did not was easy to miss.
      //
      // Measured on the phone viewport only. A mouse can hit 19px; a thumb on a
      // moving train cannot, and the phone is where these shops are opened.
      const page = await open(harness, mood, PHONE);
      try {
        const small = await page.evaluate((minimum) => {
          return [...document.querySelectorAll("a")]
            .map((a) => ({ box: a.getBoundingClientRect(), text: (a.textContent ?? "").trim().slice(0, 30) }))
            // Zero-height anchors are not rendered; a hidden link is a
            // different problem from a small one and not this test's.
            .filter((entry) => entry.box.height > 0 && entry.box.height < minimum)
            .map((entry) => `"${entry.text}" is ${Math.round(entry.box.height)}px`);
        }, MIN_TAP_TARGET);

        expect(small, small.join("; ")).toEqual([]);
      } finally {
        await page.close();
      }
    });

    it("keeps the name and the price off each other in the list layout", async () => {
      // The inline card meta puts a title and a price on one line inside a
      // ~170px phone column, which is the narrowest place on the page where two
      // things compete for width. The failure mode is not a crash: the title
      // takes the space and the price is pushed out of, or on top of, it.
      //
      // Checked on every card rather than the first, because the widths that
      // break this come from the merchant's own product names.
      const page = await open(harness, "utility", PHONE);
      try {
        const collisions = await page.evaluate(() =>
          [...document.querySelectorAll('.card-meta[data-layout="inline"]')]
            .map((meta) => {
              const title = meta.querySelector(".card-title")?.getBoundingClientRect();
              const price = meta.querySelector(".card-price")?.getBoundingClientRect();
              if (!title || !price) return null;
              const overlaps = price.left < title.right - 1;
              return overlaps ? `${meta.querySelector(".card-title")?.textContent} overlaps its price` : null;
            })
            .filter(Boolean),
        );
        expect(collisions, collisions.join("; ")).toEqual([]);
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

/**
 * How far each column is dropped relative to the highest one, in the top row.
 *
 * One card per column, not the first N cards: with four columns the fifth card
 * is the second row, and a grid with no stagger at all still reports two
 * distinct tops. Comparing within the top row is the only way to ask "are the
 * columns level" and get an answer about the stagger rather than about the row
 * height.
 *
 * Rounded to whole pixels — the stagger is `calc()` over a spacing scale
 * already rounded to a tenth, and sub-pixel noise would make "level" a coin
 * toss.
 */
async function rowOffsets(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".grid > *")];
    if (cards.length === 0) return [];

    // First card at each distinct x, in column order.
    const topOfColumn = new Map<number, number>();
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      const x = Math.round(box.x);
      if (!topOfColumn.has(x)) topOfColumn.set(x, Math.round(box.top));
    }

    const columns = [...topOfColumn.entries()].sort((a, b) => a[0] - b[0]).map(([, top]) => top);
    const highest = Math.min(...columns);
    return columns.map((top) => top - highest);
  });
}

/**
 * What the page looks like, as a string, before anybody reads a word of it.
 *
 * Deliberately structural: column count, plate shape, row rhythm, where the
 * headline sits, how the price sits under the plate. Type weight and tracking
 * are left out precisely because they were the axes the moods already differed
 * on while still looking like one design.
 */
async function layoutSignature(page: Page): Promise<string> {
  const offsets = await rowOffsets(page);
  return page.evaluate(
    ({ offsets }) => {
      const plate = document.querySelector(".grid .plate");
      const ratio = plate
        ? (plate.getBoundingClientRect().width / plate.getBoundingClientRect().height).toFixed(2)
        : "none";
      const columns = new Set([...document.querySelectorAll(".grid > *")].map((c) => Math.round(c.getBoundingClientRect().x))).size;
      const heroPlate = document.querySelector(".hero-plate")?.getBoundingClientRect();
      const heroCopy = document.querySelector(".hero-copy")?.getBoundingClientRect();
      const copyPlacement = heroPlate && heroCopy ? (heroCopy.top >= heroPlate.bottom - 1 ? "under" : "overlay") : "none";
      const meta = document.querySelector(".card-meta")?.getAttribute("data-layout") ?? "none";
      return [`cols:${columns}`, `plate:${ratio}`, `rows:${offsets.join(",")}`, `copy:${copyPlacement}`, `meta:${meta}`].join(" ");
    },
    { offsets },
  );
}

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
