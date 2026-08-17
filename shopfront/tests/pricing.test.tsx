/**
 * The pricing page.
 *
 * This page is the most dangerous surface in the product, and not because of
 * anything it says. Every convention of the form — three cards, a per-month
 * figure, ticks down a feature list — is the visual language of something you
 * can buy right now, and popuup has no billing at all. A page can lie fluently
 * in that language without containing one false sentence.
 *
 * So the invariants are about the shape as much as the words: no way to pay, no
 * tick against something that does not exist, and the fact that nothing is
 * chargeable said before any number rather than in a footnote under them.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Pricing from "@/app/pricing/page";

const html = renderToStaticMarkup(<Pricing />);
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&[a-z]+;/g, " ")
  .replace(/\s+/g, " ");

describe("the pricing page", () => {
  it("offers no way to pay", () => {
    // Not "we did not build the form" — the page must not have anywhere a card
    // number could go, and must not look like it does.
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
    // Payment affordances specifically. "Checkout" is deliberately not in here:
    // it is the merchant's Shopify checkout, named all over this product, and
    // a word list that cannot tell those apart would fail on the sentence that
    // makes the honest point.
    expect(html).not.toMatch(
      /\b(subscribe|start (free )?trial|buy now|pay now|add payment|card details|billing details|enter your card)\b/i,
    );
  });

  it("says nothing is chargeable before it says a price", () => {
    // Order is the whole argument. A reader who leaves with the numbers should
    // have had to scroll past this to get them.
    const disclosure = text.search(/nothing is chargeable|no billing in popuup/i);
    const firstPrice = text.search(/\$\d/);
    expect(disclosure).toBeGreaterThan(-1);
    expect(firstPrice).toBeGreaterThan(-1);
    expect(disclosure).toBeLessThan(firstPrice);
  });

  it("marks every feature that does not exist yet", () => {
    /*
     * The failure this exists for: a tick against a feature nobody built. The
     * reader assumes a list is a list of things that work, and on this page
     * four of the lines are not.
     *
     * Counted rather than spot-checked, so adding an unbuilt line without
     * labelling it fails here rather than shipping.
     */
    // Every list item inside a tier, as it renders.
    const lines = [...html.matchAll(/<ul class="tier-lines">(.*?)<\/ul>/g)].flatMap((block) => [
      ...block[1]!.matchAll(/<li([^>]*)>(.*?)<\/li>/g),
    ]);
    expect(lines.length).toBeGreaterThan(8);

    // A line is either marked built, or it carries the label. Neither is a
    // tick over nothing.
    const unmarked = lines.filter(([, attrs, body]) => !attrs!.includes("data-built") && !body!.includes("not built yet"));
    expect(unmarked.map(([, , body]) => body)).toEqual([]);

    // And the label is actually used, so this cannot pass by everything being
    // claimed as built.
    expect(lines.filter(([, , body]) => body!.includes("not built yet")).length).toBeGreaterThan(0);
  });

  it("names the specific things that do not exist", () => {
    /*
     * The check above is weaker than it looks and this one covers the gap.
     *
     * "Every line is marked" passes just as happily when a line is marked
     * *built* — nothing in the page knows what is really shipped, so a wrong
     * tick reads as a right one. Flipping "More shops" from false to true kept
     * the suite green, which is exactly the mistake somebody makes while
     * tidying a list before a launch.
     *
     * So the four that do not exist are named here. Anybody moving one to
     * built has to come and delete it from this list, which is the moment they
     * have to ask themselves whether it is true. Plan limits are the case:
     * `plan` exists on a shop and controls the badge, and nothing anywhere
     * counts or caps how many shops a merchant may publish.
     */
    const notBuilt = [
      "One published shop",
      "More shops",
      "Shops without a practical limit",
      "Per-creator numbers",
    ];

    for (const feature of notBuilt) {
      const line = new RegExp(`<li[^>]*>${feature}<em>not built yet</em></li>`);
      expect(html, `"${feature}" is claimed as built`).toMatch(line);
    }
  });

  it("does not dress the offer as urgency it cannot honour", () => {
    // "First ten" is a real term the kill-test ledger can settle. A countdown,
    // a deadline or a live tally would be theatre — the page cannot read that
    // ledger, so it must not imply it is watching one.
    expect(text).toMatch(/first ten/i);
    expect(text).not.toMatch(/\b(\d+ (spots?|places?|slots?) (left|remaining)|only \d+ left|ends (today|soon)|hurry)\b/i);
    expect(html).not.toMatch(/\b\d+ of \d+ (taken|gone|claimed)\b/i);
  });

  it("does not claim a cut of anybody's sales", () => {
    // The one commercial promise worth pinning: the money never passes through
    // us, which is also why we could not take a percentage if we wanted to.
    expect(text).toMatch(/no commission|never touch payments|do not take a cut|take a cut of sales/i);
    expect(text).not.toMatch(/\b\d+% of (sales|revenue|orders)\b/i);
  });

  it("keeps the one action the same as everywhere else", () => {
    // The page's only call to action is the same mailto the front door uses.
    // A second, different ask here would be a sign-up in disguise.
    expect(html).toMatch(/href="mailto:[^"]+"/);
  });

  it("borrows no class name the shop template owns", async () => {
    // Same rule as the landing page: shop.css is global, and a collision only
    // shows up as a colour that is wrong on one specific combination.
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const css = (await readFile(path.join(process.cwd(), "src/app/shop.css"), "utf8")).replace(/\/\*[\s\S]*?\*\//g, " ");
    const owned = new Set<string>();
    for (const [, selector] of css.matchAll(/([^{}]+)\{/g)) {
      for (const [, name] of selector!.matchAll(/\.([A-Za-z_][\w-]*)/g)) owned.add(name!);
    }

    const used = new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1]!.split(/\s+/)).filter(Boolean));
    expect([...used].filter((name) => owned.has(name))).toEqual([]);
  });
});
