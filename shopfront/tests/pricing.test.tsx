/**
 * The caveat is the whole guard now.
 *
 * The pricing page used to mark every unbuilt line with a "not built yet"
 * badge. That was removed on the owner's call — five of the six were marking
 * *metering* rather than a missing feature ("One published shop — not built
 * yet" is nonsense; publishing a shop is built, the limit of one is what needs
 * an account) and the noise made the page read as an unfinished product rather
 * than a considered offer.
 *
 * What that costs is real, and this file is the thing that pays for it. Without
 * the per-line badges the plans read as ordinary claims about an ordinary
 * product, and the only thing separating them from a page selling something is
 * one paragraph near the top saying nothing here can be bought. Delete that
 * paragraph — or leave it in place while quietly wiring Stripe — and this page
 * starts taking money for features that do not exist, which is a refund and a
 * bad first impression with exactly the merchant you most wanted.
 *
 * So: the caveat is asserted, and the day billing becomes real, the check
 * below fails and forces the decision to be made deliberately rather than
 * discovered by a customer.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Pricing from "@/app/pricing/page";

const html = renderToStaticMarkup(<Pricing />);
const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

describe("the pricing page", () => {
  it("says plainly that nothing can be bought, before any number", () => {
    // Before, not merely present: a reader who takes the numbers instead of
    // the caveat should have had to scroll past it to do so.
    const caveat = text.search(/no sign-up, no card field and no billing/i);
    const firstPrice = text.search(/\$\d/);

    expect(caveat, "the pricing page has lost its caveat").toBeGreaterThan(-1);
    expect(firstPrice).toBeGreaterThan(-1);
    expect(caveat, "a price appears before the caveat that qualifies it").toBeLessThan(firstPrice);
  });

  it("says the prices are intended rather than charged", () => {
    expect(text).toMatch(/what we intend to charge/i);
  });

  it("offers no way to pay, and nothing that behaves like one", () => {
    /*
     * The button says "Ask for a shop" on every tier, because asking is the
     * only thing anybody can do. A "Start free trial", a "Subscribe", or a
     * link to a checkout would be the page quietly becoming what it is dressed
     * as, and the caveat above would not save it.
     */
    // Not a bare "checkout": the comparison table has a "Shopify checkout" row,
    // which is the merchant's own and is exactly the thing this product is
    // careful never to replace. What is banned is a way to pay *us*.
    expect(html).not.toMatch(/\b(subscribe|start (your )?(free )?trial|buy now|upgrade now|enter (your )?card)\b/i);
    expect(html).not.toMatch(/stripe|paypal|checkout\.stripe\.com/i);
    expect(html).not.toMatch(/<form|<input/);
  });

  it("keeps the first-ten offer a countable term rather than urgency dressing", () => {
    // "First ten" is a number somebody can be inside or outside of, and the
    // kill-test ledger already tracks who was asked and who said yes. What it
    // must never grow is a live counter this page cannot actually read.
    expect(text).toMatch(/first ten/i);
    expect(text).not.toMatch(/\d+\s*(of|\/)\s*10\s*(gone|left|remaining|claimed)/i);
    expect(text).not.toMatch(/only \d+ (spots?|places?|left)/i);
  });

  it("quotes every price in one currency", () => {
    // Two currencies on one page is a merchant working out which one applies
    // to them, and getting it wrong.
    const symbols = new Set([...text.matchAll(/([$£€])\s?\d/g)].map((m) => m[1]));
    expect([...symbols]).toHaveLength(1);
  });

  it("names a tier in the comparison table for every tier on a card", () => {
    // The table and the cards drifted apart once already, when a tier was
    // renamed in one and not the other.
    const source = readFileSync(path.join(process.cwd(), "src", "app", "pricing", "page.tsx"), "utf8");
    const names = [...source.matchAll(/name: "([A-Za-z ]+)",\n\s+price:/g)].map((m) => m[1]!);
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const name of names) expect(text).toContain(name);
  });

  it("is reachable from the site's own navigation", () => {
    // A pricing page nothing links to is a page that answers nobody.
    expect(existsSync(path.join(process.cwd(), "src", "app", "pricing", "page.tsx"))).toBe(true);
    const chrome = readFileSync(path.join(process.cwd(), "src", "app", "chrome.tsx"), "utf8");
    expect(chrome).toContain('href="/pricing"');
  });
});
