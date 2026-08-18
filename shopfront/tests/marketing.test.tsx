/**
 * The invariants that hold across every marketing page, not just the front door.
 *
 * `landing.test.tsx` guards `/` and was written when `/` was the only page
 * with claims on it. There are now seven, and the ways a marketing page starts
 * lying do not get gentler as you add pages — they get easier to miss, because
 * nobody re-reads `/terms` after writing it once.
 *
 * So the rules that are about *any* page popuup publishes live here and run
 * against all of them:
 *
 *   - every image resolves to a file in `public/`;
 *   - every internal link resolves to a route that exists;
 *   - no page borrows a class name `shop.css` already owns;
 *   - no page counts merchants we do not have, or claims a speed;
 *   - no page mentions sync or liveness except to deny it;
 *   - no page grows a form outside `/contact`.
 *
 * Per-page exemptions are stated as data below rather than as `if` branches,
 * so that adding one is a visible decision. There are two, and both are the
 * page doing its job: pricing quotes prices, and contact has the form.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Landing from "@/app/page";
import Pricing from "@/app/pricing/page";
import Contact from "@/app/contact/page";
import Examples from "@/app/examples/page";
import About from "@/app/about/page";
import Privacy from "@/app/privacy/page";
import Terms from "@/app/terms/page";

const PUBLIC = path.join(process.cwd(), "public");
const APP = path.join(process.cwd(), "src", "app");

interface Page {
  route: string;
  html: string;
  /** The form lives on exactly one page and nowhere else. */
  mayHaveForm?: boolean;
  /** Prices are quoted on exactly one page and nowhere else. */
  mayQuotePrices?: boolean;
}

const PAGES: Page[] = [
  { route: "/", html: renderToStaticMarkup(<Landing />) },
  { route: "/pricing", html: renderToStaticMarkup(<Pricing />), mayQuotePrices: true },
  { route: "/contact", html: renderToStaticMarkup(<Contact />), mayHaveForm: true },
  { route: "/examples", html: renderToStaticMarkup(<Examples />) },
  { route: "/about", html: renderToStaticMarkup(<About />) },
  { route: "/privacy", html: renderToStaticMarkup(<Privacy />) },
  { route: "/terms", html: renderToStaticMarkup(<Terms />) },
];

/** Every route the app actually serves, read off the filesystem. */
const ROUTES = new Set(["/"]);
for (const entry of ["pricing", "contact", "examples", "about", "privacy", "terms"]) {
  if (existsSync(path.join(APP, entry, "page.tsx"))) ROUTES.add(`/${entry}`);
}

/**
 * A page as somebody reads it, one sentence at a time.
 *
 * The unit has to be a sentence: matching words against a whole document fails
 * on "nothing here syncs with your store", which is the page keeping the rule
 * rather than breaking it.
 */
function sentencesOf(html: string): string[] {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const DENIES = /\b(no|not|nothing|never|without|isn't|does not|do not)\b/i;

function shopSelectors(): Set<string> {
  const css = readFileSync(path.join(APP, "shop.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  const found = new Set<string>();
  for (const [, selector] of css.matchAll(/([^{}]+)\{/g)) {
    for (const [, name] of selector!.matchAll(/\.([A-Za-z_][\w-]*)/g)) found.add(name!);
  }
  return found;
}

describe("every marketing page", () => {
  it("is a page at all", () => {
    // A guard about an empty render passes every assertion below for the
    // wrong reason.
    for (const page of PAGES) {
      expect(page.html.length, `${page.route} rendered ${page.html.length} characters`).toBeGreaterThan(1500);
    }
  });

  it.each(PAGES)("$route only shows images that are in the repository", (page: Page) => {
    const sources = [...page.html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]!);
    expect(sources.length).toBeGreaterThan(0);

    for (const src of sources) {
      expect(src.startsWith("/"), `${src} is not a local asset`).toBe(true);
      expect(existsSync(path.join(PUBLIC, src)), `public${src} is missing`).toBe(true);
    }
  });

  it.each(PAGES)("$route links only to routes that exist", (page: Page) => {
    /*
     * Seven pages cross-linking through a shared footer is exactly the shape
     * where a rename leaves a 404 that nothing notices — the page still
     * renders, the build still passes, and the only symptom is a visitor
     * landing on nothing.
     *
     * Only internal paths are checked. `mailto:`, external URLs and fragments
     * are somebody else's to keep working. Published shops are excluded by
     * being checked against the app directory: `/edit-sale` is a shop, not a
     * route file, and `examples.test`-style coverage for those lives in the
     * examples check below.
     *
     * Assets are excluded by *being* assets, rather than by a list of the
     * directories they currently live in. React emits a `<link rel="preload"
     * as="image" href="…">` for every `<img>` it server-renders, so every
     * picture on the page arrives here as an href — and the old filter named
     * `/press/` and `/brand/`, which is fine right up until a photograph is
     * added under a third directory. Anything that resolves to a real file in
     * `public/` is a file; the check above already proves those exist, and a
     * route path never has one.
     */
    const hrefs = [...page.html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]!);
    const internal = hrefs.filter((href) => !existsSync(path.join(PUBLIC, href)));

    // Shops and previews are data, not routes. They are checked separately.
    const marketing = internal.filter(
      (href) => !href.startsWith("/preview/") && !href.startsWith("/edit-"),
    );

    for (const href of marketing) {
      expect(ROUTES.has(href), `${page.route} links to ${href}, which is not a route`).toBe(true);
    }
  });

  it.each(PAGES)("$route does not borrow a class name the shop template owns", (page: Page) => {
    // `shop.css` is imported by the root layout, so every rule in it applies
    // here too. This went unnoticed once for as long as both were white text
    // on a dark ground, and broke the moment the page moved onto cream.
    const shop = shopSelectors();
    expect(shop.size).toBeGreaterThan(20);

    const used = new Set(
      [...page.html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1]!.split(/\s+/)).filter(Boolean),
    );
    expect(used.size).toBeGreaterThan(5);
    expect([...used].filter((name) => shop.has(name))).toEqual([]);
  });

  it.each(PAGES)("$route counts nobody it has not got", (page: Page) => {
    expect(page.html).not.toMatch(/\btrusted by\b/i);
    expect(page.html).not.toMatch(/\b\d[\d,]*\+? (merchants|stores|shops|brands)\b/i);
    expect(page.html).not.toMatch(/\b(instantly|in seconds)\b/i);
    expect(page.html).not.toMatch(/\bthousands of\b/i);
  });

  it.each(PAGES)("$route mentions liveness only in order to deny it", (page: Page) => {
    const liveness = /\b(sync\w*|real[- ]?time|up to date|automatic\w*|always current)\b/i;
    for (const sentence of sentencesOf(page.html).filter((s) => liveness.test(s))) {
      expect(sentence, `${page.route} says something about liveness without denying it`).toMatch(DENIES);
    }
  });

  it.each(PAGES)("$route has a form only if it is the contact page", (page: Page) => {
    // The Sprint 3 capture gate was opened for one page. `stop-line.test.tsx`
    // holds the source-level boundary; this holds the rendered one, which is
    // what a visitor actually meets.
    const hasForm = /<form|<input|<textarea/.test(page.html);
    expect(hasForm, `${page.route} renders a form`).toBe(Boolean(page.mayHaveForm));
  });

  it.each(PAGES)("$route quotes a price only if it is the pricing page", (page: Page) => {
    // A number with a currency in front of it is a commitment. The pricing
    // page makes it under a caveat that says nothing is chargeable; no other
    // page gets to make it in passing.
    const priced = /[$£€]\s?\d/.test(page.html.replace(/<[^>]+>/g, " "));
    expect(priced, `${page.route} quotes a price`).toBe(Boolean(page.mayQuotePrices));
  });
});

describe("the examples page", () => {
  const examples = PAGES.find((p) => p.route === "/examples")!;

  it("links every shot to a shop a fresh checkout can render", async () => {
    /*
     * The page's whole claim is "every image links to the page it was taken
     * from", and it was false everywhere except the machine that generated
     * them: shops live in `.cache/`, `.cache/` is gitignored, and a deployment
     * is always a fresh checkout. Six pages of careful honesty undone by a
     * 404.
     *
     * So this asserts against `fixtures/shops/`, which is committed, rather
     * than against the cache — checking the cache would pass on a developer's
     * laptop for exactly the reason the bug existed.
     */
    const links = [...examples.html.matchAll(/href="\/preview\/([a-z0-9-]+)"/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThanOrEqual(10);

    for (const key of links) {
      const file = path.join(process.cwd(), "fixtures", "shops", `${key}.json`);
      expect(existsSync(file), `/preview/${key} is linked from /examples but fixtures/shops/${key}.json is missing`).toBe(
        true,
      );
    }
  });

  it("loads those shops through the renderer's own loader, with no cache", async () => {
    // Existing on disk is not the same as parsing. A fixture that fails the
    // schema renders a 404 and this file would still have passed.
    const { loadShop } = await import("@/lib/render/store");
    const links = [...examples.html.matchAll(/href="\/preview\/([a-z0-9-]+)"/g)].map((m) => m[1]!);

    for (const key of links) {
      const shop = await loadShop(key);
      expect(shop, `/preview/${key} does not load`).not.toBeNull();
      expect(shop!.config.blocks.length, `/preview/${key} has no blocks`).toBeGreaterThan(0);
    }
  });

  it("points only at demo stores", async () => {
    // "Nobody's products are borrowed to sell something" is a claim on the
    // page. Every store behind it must be a reserved example domain, checked
    // rather than trusted — this is the assertion that stops a real merchant's
    // catalogue being frozen into the repository by a future run of
    // `scripts/demo-fixtures.ts`.
    const { loadShop } = await import("@/lib/render/store");
    const links = [...examples.html.matchAll(/href="\/preview\/([a-z0-9-]+)"/g)].map((m) => m[1]!);

    for (const key of links) {
      const shop = await loadShop(key);
      const host = new URL(shop!.config.brand.storeUrl).hostname;
      expect(host, `/preview/${key} is ${host}, which is not a reserved example domain`).toMatch(
        /(^|\.)(example\.invalid|maisonverre\.example|casalino\.example)$/,
      );
    }
  });

  it("says every shop on it is a demo", () => {
    // Nobody's real products are borrowed to sell something, and the page has
    // to say so where somebody reads it rather than in a comment.
    expect(examples.html).toMatch(/demo/i);
  });
});

describe("the front page's five edits", () => {
  /**
   * Every product count beside a shop must be that shop's real count.
   *
   * `src/app/page.tsx` types `n` by hand next to each phone — "5 pieces",
   * "3 pieces" — and the whole section argues from those numbers: three for a
   * first flat against seven for a clearout is the difference it exists to
   * show. They were correct when written and nothing kept them correct.
   *
   * The merchandiser is not deterministic. Re-running `pnpm press:edits`
   * against the same catalogue and the same five sentences returned four
   * products for the negroni kit on one run and five on another — which is
   * fine, it is a model making a judgement, and it means a regeneration
   * silently turns a true label into a false one. Nothing else would notice:
   * the page still renders, the screenshot still looks right, and the only
   * symptom is a number that disagrees with the picture beside it.
   */
  const handlesIn = (config: unknown): Set<string> => {
    const found = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.handle === "string") found.add(record.handle);
        Object.values(record).forEach(walk);
      }
    };
    walk((config as { blocks: unknown }).blocks);
    return found;
  };

  it("labels each shop with the number of products actually in it", () => {
    const source = readFileSync(path.join(APP, "page.tsx"), "utf8");
    const labelled = [...source.matchAll(/slug: "(edit-[a-z]+)"[^}]*?n: (\d+)/g)].map((m) => ({
      slug: m[1]!,
      n: Number(m[2]),
    }));

    // A regex that quietly matched nothing would make this pass while
    // checking nothing at all.
    expect(labelled).toHaveLength(5);

    for (const { slug, n } of labelled) {
      const file = path.join(process.cwd(), "fixtures", "shops", `${slug}.json`);
      expect(existsSync(file), `${slug} is on the front page but has no fixture`).toBe(true);

      const shop = JSON.parse(readFileSync(file, "utf8")) as { config: unknown };
      const actual = handlesIn(shop.config).size;
      expect(actual, `/${slug} shows ${actual} products, the page says ${n}`).toBe(n);
    }
  });
});
