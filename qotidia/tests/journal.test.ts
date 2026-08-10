// A journal that does not become a content mill.
//
// Every product like this grows a blog, and the blog is almost always where
// the care runs out: forty posts targeting keywords, written to a brief,
// published on a schedule, each one slightly false. This product cannot
// afford that — it is asking families to believe some unusual claims about
// privacy and about not inventing things, and thin SEO copy under the same
// wordmark undoes more trust than the traffic is worth.
//
// So the tests are mostly refusals: no generated prose, no invented
// statistics, no dates that move on their own, and nothing published in one
// place while absent from another.

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeOnly as bare } from "./helpers/source";
import {
  ENTRIES, NOT_ABOUT, entryBySlug, lastPublished, published,
} from "@/lib/journal/entries";
import { PUBLIC_PAGES } from "@/app/sitemap";
import sitemap from "@/app/sitemap";
import { OFF_LIMITS } from "@/app/robots";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const dir = new URL("../src/app/journal/entries/", import.meta.url).pathname;
const prose = readdirSync(dir).map((f) => ({ file: f, body: readFileSync(dir + f, "utf8") }));

describe("every entry answers a question somebody asked", () => {
  it("names the question, in a person's words", () => {
    // Not a subtitle. An entry that cannot name a real question is an entry
    // written for a keyword, and there is nowhere in the type to put one.
    for (const e of ENTRIES) {
      expect(e.question, e.slug).toMatch(/\?$/);
      expect(e.question.length, e.slug).toBeGreaterThan(15);
    }
  });

  it("puts the question above the title, where a reader looks", () => {
    const index = src("../src/app/journal/page.tsx");
    expect(index.indexOf("{e.question}")).toBeLessThan(index.indexOf("{e.title}"));
  });

  it("has no field for a keyword", () => {
    const module_ = src("../src/lib/journal/entries.ts");
    const iface = module_.slice(module_.indexOf("export interface Entry"), module_.indexOf("}\n\nexport const ENTRIES"));
    expect(iface).not.toMatch(/keyword|tags?\b|seo|target/i);
  });
});

describe("nothing here is generated", () => {
  it("has no path from a model to the page", () => {
    // The same discipline the product applies to a family's memories,
    // applied to our own words for the same reason.
    for (const { file, body } of prose) {
      expect(bare(body), file).not.toMatch(/getAIProvider|anthropic|generate|prompt/i);
    }
    expect(bare(src("../src/lib/journal/entries.ts"))).not.toMatch(/getAIProvider|anthropic/i);
    expect(bare(src("../src/app/journal/[slug]/page.tsx"))).not.toMatch(/getAIProvider|anthropic/i);
  });

  it("says so on the page, where a reader can hold us to it", () => {
    expect(src("../src/app/journal/page.tsx")).toMatch(/written by a person and nothing on this page is\s*\n?\s*generated/);
  });

  it("makes up no statistics", () => {
    // The same guard as /about. An argument that needs an invented finding
    // to work is an argument that does not work.
    for (const { file, body } of prose) {
      const words = bare(body);
      expect(words, file).not.toMatch(/\b(studies|research|science|experts?) (show|say|find|suggest)/i);
      expect(words, file).not.toMatch(/\b\d+ ?(%|per cent|percent)\b/i);
      expect(words, file).not.toMatch(/\b(most|nine in ten|two thirds) (parents|families|people) (do|say|report)/i);
    }
  });

  it("stays off the subjects a stationery company has no business on", () => {
    // Developmental or medical advice we are not qualified to give, and a
    // parent taking milestone guidance from us is a bad outcome we caused.
    expect(NOT_ABOUT.length).toBeGreaterThanOrEqual(4);
    for (const { file, body } of prose) {
      const words = bare(body);
      expect(words, file).not.toMatch(/milestone|should be (walking|talking|sleeping)|by (this|that) age|developmentally/i);
      expect(words, file).not.toMatch(/\b(diagnos|paediatric|sleep training|screen time guidelines)/i);
    }
    expect(src("../src/app/journal/page.tsx")).toContain("NOT_ABOUT");
  });

  it("invents no family, and names no real one", () => {
    // A family invented for a blog post is the exact thing the product
    // refuses to do inside the archive.
    for (const { file, body } of prose) {
      expect(bare(body), file).not.toMatch(/one (mother|father|parent) (we|I) (spoke|know|met)/i);
      expect(bare(body), file).not.toMatch(/a customer (told|wrote|said)/i);
    }
  });
});

describe("the dates are true", () => {
  it("records when it went out and only that", () => {
    for (const e of ENTRIES) {
      expect(e.published, e.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.updated) expect(e.updated >= e.published, e.slug).toBe(true);
    }
  });

  it("never derives a date from the build", () => {
    // The oldest lie in search-engine optimisation, and a product with an
    // append-only promise page has no business telling it.
    for (const file of ["../src/app/sitemap.ts", "../src/app/journal/[slug]/page.tsx",
                        "../src/app/journal/feed.xml/route.ts"]) {
      const code = bare(src(file));
      expect(code, file).not.toMatch(/new Date\(\)|Date\.now\(\)/);
    }
  });

  it("tells a search engine the same date it tells a reader", () => {
    // JSON-LD that disagrees with the page is the machine-readable version
    // of a lie, and it is the one that gets a site penalised.
    const page = src("../src/app/journal/[slug]/page.tsx");
    expect(page).toMatch(/datePublished: entry\.published/);
    expect(page).toMatch(/dateModified: entry\.updated \?\? entry\.published/);
    expect(page).toMatch(/fullDate\(entry\.published\)/);
  });

  it("gives every entry one address", () => {
    // So a query string or a trailing slash does not become a second page
    // competing with the first.
    expect(src("../src/app/journal/[slug]/page.tsx")).toMatch(/alternates: \{ canonical:/);
  });
});

describe("published means published everywhere", () => {
  it("hides a draft from the index, the sitemap and the feed alike", () => {
    const draft = { slug: "not-yet", title: "x", question: "q?", description: "d",
                    published: "2027-01-01", draft: true, body: () => null } as any;
    const all = [...ENTRIES, draft];
    expect(all.filter((e) => !e.draft).map((e) => e.slug)).not.toContain("not-yet");
    // And all three read the same function rather than filtering separately.
    for (const file of ["../src/app/journal/page.tsx", "../src/app/sitemap.ts",
                        "../src/app/journal/feed.xml/route.ts"]) {
      expect(src(file), file).toMatch(/published\(\)/);
    }
  });

  it("puts every entry in the sitemap, with its real date", () => {
    const urls = sitemap().map((e) => e.url);
    for (const e of published()) {
      expect(urls.some((u) => u.endsWith(`/journal/${e.slug}`)), e.slug).toBe(true);
    }
    const row = sitemap().find((r) => r.url.endsWith(`/journal/${published()[0].slug}`))!;
    expect((row.lastModified as Date).toISOString().slice(0, 10))
      .toBe(published()[0].updated ?? published()[0].published);
  });

  it("keeps the sitemap free of anything robots forbids", () => {
    for (const url of sitemap().map((e) => e.url)) {
      for (const blocked of OFF_LIMITS) {
        expect(url.includes(blocked), `${url} vs ${blocked}`).toBe(false);
      }
    }
    expect(PUBLIC_PAGES).toContain("/journal");
  });

  it("serves only what exists", () => {
    expect(entryBySlug("a-slug-nobody-wrote")).toBeNull();
    expect(src("../src/app/journal/[slug]/page.tsx")).toContain("dynamicParams = false");
  });

  it("dates the feed from the newest thing in it", () => {
    expect(lastPublished()).toBe(
      published().reduce((a, e) => (a > (e.updated ?? e.published) ? a : e.updated ?? e.published), "")
    );
  });
});

describe("the feed", () => {
  const feed = src("../src/app/journal/feed.xml/route.ts");

  it("escapes the five characters prose is full of", () => {
    expect(feed).toMatch(/replace\(\/&\/g, "&amp;"\)/);
    for (const ch of ["&lt;", "&gt;", "&quot;", "&apos;"]) expect(feed).toContain(ch);
  });

  it("escapes before it interpolates, everywhere it interpolates", () => {
    // Only the feed template itself, not the helpers above it — atomTime
    // interpolates a value it has just proved is a date.
    const template = feed.slice(feed.indexOf("const body = `"));
    const raw = template.match(/\$\{(?!BASE|escape|e\.slug|atomTime|entries)[^}]+\}/g) ?? [];
    expect(raw, `unescaped: ${raw.join(", ")}`).toEqual([]);
  });

  it("refuses a date that is not one, rather than interpolating it", () => {
    // "Safe because of where it came from" stops being true the day
    // somebody adds a field.
    const helper = feed.slice(feed.indexOf("function atomTime"));
    expect(helper.slice(0, 300)).toMatch(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
    expect(helper.slice(0, 300)).toMatch(/throw new Error/);
  });

  it("is announced from the index, so it can be found", () => {
    expect(src("../src/app/journal/page.tsx")).toContain("application/atom+xml");
  });
});

describe("it is reachable and readable", () => {
  it("is linked from somewhere a person will be", () => {
    expect(src("../src/app/page.tsx")).toContain('href="/journal"');
  });

  it("sets the reading column once, not on every paragraph", () => {
    // An author who has to remember a class on every <p> will eventually
    // forget one, and the page looks broken in a way nobody can name.
    expect(src("../src/app/globals.css")).toMatch(/\.journal p \{/);
    for (const { file, body } of prose) {
      expect(body, file).not.toMatch(/<p className=/);
    }
  });

  it("mentions the product once, at the end, or not at all", () => {
    // A piece that sells in its third paragraph is an advertisement with a
    // question mark on top.
    for (const { file, body } of prose) {
      const mentions = (bare(body).match(/Qotidia/g) ?? []).length;
      expect(mentions, file).toBeLessThanOrEqual(2);
      if (mentions > 0) {
        expect(bare(body).indexOf("Qotidia"), file).toBeGreaterThan(bare(body).length * 0.6);
      }
    }
  });
});
