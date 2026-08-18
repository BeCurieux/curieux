/**
 * The fetcher, with no network anywhere in here.
 *
 * Every test injects its own transport, which is the same bargain the rest of
 * the engine makes: a suite that depends on somebody's storefront being up is
 * a suite that goes red for reasons unrelated to the commit, and this one
 * would be depending on thirty of them.
 *
 * The robots tests are the ones to be strict about. This tool reads a
 * stranger's page and then writes to that stranger about it, and the first
 * question a sceptical founder asks is how we got their copy.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { isAllowed, parseRobots } from "@/fetch/robots.js";
import { decodeEntities, fragmentToText, htmlToText, jsonLdBlocks, findProduct, titleOf } from "@/fetch/html.js";
import { fromJsonLd, fromShopifyProduct, shopifyEndpoints } from "@/fetch/extract.js";
import { AGENT, clearRobotsCache, fetchCopy, RobotsDisallowed, type Transport } from "@/fetch/fetch.js";
import { coverageGap, coverageNote } from "@/fetch/coverage.js";
import type { Jurisdiction } from "@/engine/types.js";
import { scan } from "@/engine/evaluate.js";

// ------------------------------------------------------------------- helpers

type Route = { status?: number; body: string; contentType?: string };

function transportOf(routes: Record<string, Route>, seen: string[] = []): Transport {
  return async (url) => {
    seen.push(url);
    const route = routes[url];
    if (!route) return { status: 404, headers: { get: () => null }, text: async () => "" };
    return {
      status: route.status ?? 200,
      headers: { get: (name: string) => (name === "content-type" ? (route.contentType ?? "text/html") : null) },
      text: async () => route.body,
    };
  };
}

const noSleep = async () => {};
const run = (url: string, routes: Record<string, Route>, extra = {}, seen: string[] = []) =>
  fetchCopy(url, { transport: transportOf(routes, seen), sleep: noSleep, delayMs: 0, ...extra });

beforeEach(() => clearRobotsCache());

// -------------------------------------------------------------------- robots

describe("robots.txt", () => {
  it("allows everything when the file says nothing", () => {
    expect(isAllowed(parseRobots("", AGENT), "/products/x")).toBe(true);
  });

  it("obeys a wildcard disallow", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /products/", AGENT);
    expect(isAllowed(robots, "/products/serum")).toBe(false);
    expect(isAllowed(robots, "/pages/about")).toBe(true);
  });

  it("lets the longest matching rule win, and Allow win a tie", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /a/\nAllow: /a/b/", AGENT);
    expect(isAllowed(robots, "/a/x")).toBe(false);
    expect(isAllowed(robots, "/a/b/x")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /x\nAllow: /x", AGENT), "/x")).toBe(true);
  });

  it("reads an empty Disallow as permission, not as a block", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:", AGENT), "/anything")).toBe(true);
  });

  it("prefers a group naming us over the wildcard group", () => {
    const robots = parseRobots(
      `User-agent: *\nDisallow: /\n\nUser-agent: ClaimScanBot\nDisallow: /admin/`,
      AGENT,
    );
    expect(isAllowed(robots, "/products/serum")).toBe(true);
    expect(isAllowed(robots, "/admin/orders")).toBe(false);
  });

  it("handles wildcards and end-anchors, which real files use", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /*?variant=\nDisallow: /cart$", AGENT);
    expect(isAllowed(robots, "/products/x?variant=1")).toBe(false);
    expect(isAllowed(robots, "/cart")).toBe(false);
    expect(isAllowed(robots, "/cart/add")).toBe(true);
  });

  it("keeps consecutive user-agent lines in one group", () => {
    const robots = parseRobots("User-agent: a\nUser-agent: ClaimScanBot\nDisallow: /no/", AGENT);
    expect(isAllowed(robots, "/no/x")).toBe(false);
  });

  it("ignores comments", () => {
    expect(isAllowed(parseRobots("# Disallow: /\nUser-agent: *\nAllow: /", AGENT), "/x")).toBe(true);
  });

  it("reads a crawl-delay when one is set", () => {
    expect(parseRobots("User-agent: *\nCrawl-delay: 10", AGENT).crawlDelaySeconds).toBe(10);
  });
});

describe("robots, over the wire", () => {
  const page = "https://brand.example/products/serum";
  const body = `<html><body><main>${"Clinically proven to work. ".repeat(20)}</main></body></html>`;

  it("refuses a page robots.txt disallows", async () => {
    await expect(
      run(page, {
        "https://brand.example/robots.txt": { body: "User-agent: *\nDisallow: /products/" },
      }),
    ).rejects.toBeInstanceOf(RobotsDisallowed);
  });

  it("treats a missing robots.txt as permission", async () => {
    const result = await run(page, {
      "https://brand.example/robots.txt": { status: 404, body: "" },
      [page]: { body },
    });
    expect(result.text).toContain("Clinically proven");
  });

  it("fails closed when robots.txt is a server error", async () => {
    // We are about to write to this store's owner. Reading the page anyway
    // because their server had a bad minute is the wrong order of operations.
    await expect(
      run(page, { "https://brand.example/robots.txt": { status: 503, body: "" }, [page]: { body } }),
    ).rejects.toBeInstanceOf(RobotsDisallowed);
  });

  it("skips the check for a site the user says is theirs, and records that it did", async () => {
    const result = await run(
      page,
      { "https://brand.example/robots.txt": { body: "User-agent: *\nDisallow: /" }, [page]: { body } },
      { own: true },
    );
    expect(result.text).toContain("Clinically proven");
    expect(result.trace[0]?.outcome).toContain("--own");
  });

  it("asks each host for robots.txt once, however many targets it has", async () => {
    const seen: string[] = [];
    const routes = {
      "https://brand.example/robots.txt": { body: "" },
      "https://brand.example/products/a": { body },
      "https://brand.example/products/b": { body },
    };
    await run("https://brand.example/products/a", routes, {}, seen);
    await fetchCopy("https://brand.example/products/b", {
      transport: transportOf(routes, seen),
      sleep: noSleep,
      delayMs: 0,
    });
    expect(seen.filter((u) => u.endsWith("robots.txt"))).toHaveLength(1);
  });

  it("says who it is, and carries a contact when given one", async () => {
    let agent = "";
    const transport: Transport = async (_url, init) => {
      agent = init.headers["user-agent"] ?? "";
      return { status: 404, headers: { get: () => null }, text: async () => "" };
    };
    await fetchCopy("https://brand.example/products/x", {
      transport,
      sleep: noSleep,
      contact: "hi@example.com",
    }).catch(() => {});
    expect(agent).toContain("ClaimScanBot");
    expect(agent).toContain("hi@example.com");
  });
});

// ---------------------------------------------------------------------- html

describe("html to text", () => {
  it("decodes the entity that would otherwise split a phrase in half", () => {
    // "carbon&nbsp;neutral" is the exact failure: an invisible character in
    // the middle of the phrase the ECGT rule is looking for.
    expect(decodeEntities("carbon&nbsp;neutral")).toBe("carbon neutral");
    expect(decodeEntities("&amp;&lt;&gt;&#8212;&#x2019;")).toBe("&<>—’");
    expect(decodeEntities("&notareal;")).toBe("&notareal;");
  });

  it("drops scripts and styles with their contents", () => {
    const text = htmlToText(`<p>Real</p><script>var x = "eco-friendly";</script><style>p{}</style>`);
    expect(text).toBe("Real");
  });

  it("drops nav and footer, which carry other pages' claims", () => {
    const text = htmlToText(`<nav><a>Clinically proven range</a></nav><main><p>The serum.</p></main>`);
    expect(text).not.toContain("Clinically proven");
    expect(text).toContain("The serum.");
  });

  it("puts a newline where a block element was, so sentences do not fuse", () => {
    // "Firms skinBrightens" is a sentence neither rule can read, and a list
    // with no breaks is the most common way a fetched page produces one.
    expect(htmlToText("<li>Firms skin</li><li>Brightens</li>")).toBe("Firms skin\nBrightens");
    expect(htmlToText("<div>Firms skin</div>Brightens")).toContain("Firms skin\n");
  });

  it("keeps a list tight and paragraphs apart, the way the page looked", () => {
    // Not cosmetic: this text is reproduced verbatim on the card, and a
    // bulleted list rendered double-spaced does not look like the brand's page.
    expect(htmlToText("<ul><li>One</li><li>Two</li><li>Three</li></ul>")).toBe("One\nTwo\nThree");
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\n\nTwo");
  });

  it("collapses runs of blank lines rather than emitting a page of them", () => {
    expect(htmlToText("<div></div><div></div><p>Only this</p>")).toBe("Only this");
    expect(htmlToText("<div><div><div><p>Nested</p></div></div></div>")).toBe("Nested");
  });

  it("keeps a fragment's own footer, since a fragment has no chrome", () => {
    expect(fragmentToText("<footer>Made in Adelaide</footer>")).toBe("Made in Adelaide");
  });

  it("reads the title", () => {
    expect(titleOf("<html><head><title>Serum &amp; Co</title></head></html>")).toBe("Serum & Co");
  });
});

describe("structured sources", () => {
  it("derives the Shopify endpoints from a product URL", () => {
    expect(shopifyEndpoints("https://b.example/products/serum")).toEqual([
      "https://b.example/products/serum.js",
      "https://b.example/products/serum.json",
    ]);
    expect(shopifyEndpoints("https://b.example/products/serum?variant=1")[0]).toBe(
      "https://b.example/products/serum.js",
    );
    expect(shopifyEndpoints("https://b.example/pages/about")).toEqual([]);
  });

  it("reads a `.js` product and a `.json` product alike", () => {
    const fromJs = fromShopifyProduct({ title: "Serum", description: "<p>Clinically proven.</p>" });
    const fromJson = fromShopifyProduct({ product: { title: "Serum", body_html: "<p>Clinically proven.</p>" } });
    expect(fromJs?.text).toBe("Serum\n\nClinically proven.");
    expect(fromJson?.text).toBe(fromJs?.text);
  });

  it("returns nothing for JSON that is not a product", () => {
    expect(fromShopifyProduct({ errors: "Not Found" })).toBeNull();
    expect(fromShopifyProduct("nope")).toBeNull();
  });

  it("finds a Product inside an @graph, which is how most themes ship it", () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"Brand"},
        {"@type":"Product","name":"Serum","description":"Clinically proven to firm."}]}
    </script>`;
    expect(findProduct(jsonLdBlocks(html))?.["name"]).toBe("Serum");
    expect(fromJsonLd(html)?.text).toContain("Clinically proven to firm.");
  });

  it("steps over a malformed JSON-LD block rather than failing the scan", () => {
    expect(jsonLdBlocks(`<script type="application/ld+json">{oh no</script>`)).toEqual([]);
  });
});

// -------------------------------------------------------------------- ladder

describe("the ladder", () => {
  const url = "https://brand.example/products/serum";
  const robots = { "https://brand.example/robots.txt": { body: "" } };
  const longDescription = `<p>${"Clinically proven to reduce fine lines. ".repeat(8)}</p>`;

  it("prefers the Shopify product over the page, so a carousel cannot leak in", async () => {
    const result = await run(url, {
      ...robots,
      "https://brand.example/products/serum.js": {
        contentType: "application/json",
        body: JSON.stringify({ title: "Serum", description: longDescription }),
      },
      [url]: {
        body: `<html><body><main>${longDescription}</main>
          <section class="related"><p>Our eco-friendly cleanser</p></section></body></html>`,
      },
    });
    expect(result.via).toBe("shopify-product-json");
    expect(result.text).not.toContain("eco-friendly");
  });

  it("keeps the whole page alongside, so the caller can see what was left out", async () => {
    const result = await run(url, {
      ...robots,
      "https://brand.example/products/serum.js": {
        contentType: "application/json",
        body: JSON.stringify({ title: "Serum", description: "<p>A serum in an amber bottle, quietly made.</p>" }),
      },
      [url]: {
        body: `<html><body><main><p>A serum in an amber bottle, quietly made.</p>
          <section><p>We are a carbon neutral, eco-friendly brand.</p></section></main></body></html>`,
      },
    });
    expect(result.via).toBe("shopify-product-json");
    expect(result.text).not.toContain("carbon neutral");
    expect(result.pageText).toContain("carbon neutral");
    expect(result.unseenPageChars).toBeGreaterThan(0);
    expect(result.trace.some((a) => a.rung === "coverage")).toBe(true);
  });

  it("falls to JSON-LD when the store is not Shopify", async () => {
    const result = await run("https://brand.example/shop/serum", {
      ...robots,
      "https://brand.example/shop/serum": {
        body: `<html><body><script type="application/ld+json">
          {"@type":"Product","name":"Serum","description":"${"Clinically proven to firm. ".repeat(10)}"}
        </script></body></html>`,
      },
    });
    expect(result.via).toBe("json-ld-product");
  });

  it("falls to the main region, then to the whole page", async () => {
    const main = await run(url, {
      ...robots,
      [url]: { body: `<html><body><main>${longDescription}</main></body></html>` },
    });
    expect(main.via).toBe("main-region");

    const whole = await run(url, { ...robots, [url]: { body: `<html><body>${longDescription}</body></html>` } });
    expect(whole.via).toBe("whole-page");
  });

  it("records every rung it tried, including the ones that gave nothing", async () => {
    const result = await run(url, { ...robots, [url]: { body: `<html><body>${longDescription}</body></html>` } });
    const rungs = result.trace.map((a) => a.rung);
    expect(rungs).toContain("robots.txt");
    expect(rungs).toContain("shopify product json");
    expect(rungs).toContain("json-ld product");
    expect(result.trace.every((a) => a.outcome.length > 0)).toBe(true);
  });

  it("reports a JavaScript shell as thin rather than scanning the nav", async () => {
    const result = await run(url, {
      ...robots,
      [url]: { body: `<html><body><div id="root"></div><script>boot()</script></body></html>` },
    });
    expect(result.thin).toBe(true);
    expect(result.text.length).toBeLessThan(200);
  });

  it("comes back empty and traced rather than throwing when the page is gone", async () => {
    const result = await run(url, { ...robots, [url]: { status: 404, body: "" } });
    expect(result.text).toBe("");
    expect(result.thin).toBe(true);
    expect(result.trace.some((a) => a.outcome.includes("404"))).toBe(true);
  });

  it("refuses a scheme that is not http", async () => {
    await expect(run("file:///etc/passwd", {})).rejects.toThrow(/http/);
  });
});

describe("the pause between requests", () => {
  it("waits, and waits longer when robots.txt asks it to", async () => {
    const waits: number[] = [];
    await fetchCopy("https://brand.example/products/serum", {
      transport: transportOf({
        "https://brand.example/robots.txt": { body: "User-agent: *\nCrawl-delay: 5" },
        "https://brand.example/products/serum": { body: "<html><body><p>A serum, quietly made here.</p></body></html>" },
      }),
      sleep: async (ms) => {
        waits.push(ms);
      },
      delayMs: 100,
    });
    expect(waits.length).toBeGreaterThan(0);
    expect(Math.max(...waits)).toBe(5000);
  });
});

// ------------------------------------------------------------------ coverage

describe("what a structured fetch left behind", () => {
  const markets: Jurisdiction[] = ["EU", "AU"];

  it("finds a claim the product description does not carry", () => {
    // The case this exists for. A character count called it 118 characters and
    // said nothing; the 118 characters were "we are a carbon neutral brand".
    const description = "Renewal Serum\n\nA nightly serum of encapsulated retinal, quietly made.";
    const page = `${description}\n\nWe are a carbon neutral, eco-friendly brand.`;
    const gap = coverageGap(description, page, markets);
    expect(gap.phrases).toContain("carbon neutral");
    expect(gap.phrases).toContain("eco-friendly");
    expect(coverageNote(gap)).toContain("rescan with --whole");
  });

  it("says nothing when the page holds nothing extra", () => {
    const text = "A serum. It smells of neroli and moss.";
    expect(coverageGap(text, text, markets).phrases).toEqual([]);
    expect(coverageNote(coverageGap(text, `${text}\n\nShipping is free over forty pounds.`, markets))).toBeNull();
  });

  it("does not count the same phrase twice for two markets", () => {
    const gap = coverageGap("A serum.", "A serum.\n\nAn eco-friendly serum.", markets);
    expect(gap.phrases).toEqual(["eco-friendly"]);
    expect(gap.missed.length).toBeGreaterThan(1);
  });

  it("does not report a rule the copy already trips on its own words", () => {
    const gap = coverageGap(
      "An eco-friendly serum.",
      "An eco-friendly serum.\n\nOur eco-friendly promise.",
      markets,
    );
    expect(gap.phrases).toEqual([]);
  });

  it("reports the same rule again when it is a different phrase", () => {
    const gap = coverageGap("Carbon neutral shipping.", "Carbon neutral shipping.\n\nNet zero by design.", markets);
    expect(gap.phrases).toContain("Net zero");
  });

  it("caps the list rather than printing forty phrases into a terminal", () => {
    const page =
      "A serum.\n\nEco-friendly, carbon neutral, net zero, biodegradable, 100% natural, no nasties, cruelty free.";
    const note = coverageNote(coverageGap("A serum.", page, markets));
    expect(note).toContain("and");
    expect(note?.match(/"/g)?.length).toBe(8);
  });
});

// ------------------------------------------------ what a real page throws at it

describe("the traps a real product page sets", () => {
  it("survives a `</script>` inside a string inside a script", () => {
    // A minified analytics bundle ends a naive regex block early, and whatever
    // follows — usually a shop config object full of marketing strings —
    // lands in the scanned copy.
    const html = `<script>var t="<\\/script>",e="eco-friendly";boot()</script><p>The serum.</p>`;
    expect(htmlToText(html)).toBe("The serum.");
  });

  it("drops the inline JSON blob a theme uses for variant data", () => {
    // Dawn ships the description again as application/json. Scanned, every
    // claim on the page is counted twice.
    const html = `<p>Clinically proven.</p>
      <script type="application/json" id="ProductJson">{"description":"Clinically proven."}</script>`;
    expect(htmlToText(html)).toBe("Clinically proven.");
  });

  it("drops the noscript fallback, which repeats the copy", () => {
    expect(htmlToText(`<p>Real.</p><noscript><p>Clinically proven fallback.</p></noscript>`)).toBe("Real.");
  });

  it("drops a consent banner, which nearly every EU-facing store has", () => {
    const html = `<div id="cookie-banner" role="dialog"><p>You agree to our cruelty free cookie policy.</p></div>
      <main><p>The serum.</p></main>`;
    expect(htmlToText(html)).not.toContain("cruelty free");
    expect(htmlToText(html)).toContain("The serum.");
  });

  it("drops the named consent vendors too", () => {
    for (const token of ["onetrust-banner-sdk", "CybotCookiebotDialog", "usercentrics-root", "gdpr-notice"]) {
      const html = `<div class="${token}"><p>Cookie notice text.</p></div><main><p>The serum.</p></main>`;
      expect(htmlToText(html), token).not.toContain("Cookie notice text.");
    }
  });

  it("leaves a food brand's own cookies alone", () => {
    // The buyer profile includes clean-label food. Deleting a biscuit brand's
    // products because their CSS says "cookie" is a far worse failure than
    // leaving a consent notice in.
    const html = `<main><div class="cookie-card"><h2>Oat Cookie</h2><p>All natural, no nasties.</p></div></main>`;
    const text = htmlToText(html);
    expect(text).toContain("Oat Cookie");
    expect(text).toContain("All natural");
  });

  it("handles a nested consent stack without eating the page", () => {
    const html = `<div class="cookie-consent"><div class="inner"><div>Deep</div></div></div>
      <main><p>The serum.</p></main>`;
    const text = htmlToText(html);
    expect(text).not.toContain("Deep");
    expect(text).toContain("The serum.");
  });

  it("leaves unbalanced markup alone rather than deleting to the end", () => {
    // Bailing out beats guessing: the alternative is a card for a brand whose
    // theme has one stray tag showing none of their copy.
    const html = `<div id="cookie-banner"><p>Notice</p><main><p>The serum, quietly made.</p></main>`;
    expect(htmlToText(html)).toContain("The serum, quietly made.");
  });

  it("keeps a phrase matchable across a non-breaking hyphen", () => {
    // A theme writes eco&#8209;friendly to stop the word breaking over a line.
    // Decoded it is U+2011, not the hyphen anybody types.
    const text = htmlToText("<p>An eco&#8209;friendly serum.</p>");
    expect(text).toContain("eco‑friendly");
    const found = scan({ text, source: { kind: "paste" }, jurisdictions: ["EU"] }).findings;
    expect(found.map((f) => f.ruleId)).toContain("eu-ecgt-generic-environmental");
  });

  it("keeps a phrase matchable across a non-breaking space", () => {
    const text = htmlToText("<p>We ship carbon&nbsp;neutral.</p>");
    const found = scan({ text, source: { kind: "paste" }, jurisdictions: ["EU"] }).findings;
    expect(found.map((f) => f.ruleId)).toContain("eu-ecgt-offset-neutrality");
  });

  it("reduces a script-heavy page to its words", () => {
    const bulk = Array.from({ length: 200 }, (_, i) => `<script src="/b-${i}.js"></script>`).join("");
    const styles = Array.from({ length: 50 }, (_, i) => `<style>.s${i}{color:red}</style>`).join("");
    const html = `<html><head>${bulk}${styles}</head><body><main><p>The serum.</p></main></body></html>`;
    expect(html.length).toBeGreaterThan(6000);
    expect(htmlToText(html)).toBe("The serum.");
  });
});
