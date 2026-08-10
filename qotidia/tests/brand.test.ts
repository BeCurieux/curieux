// The name, and why it needs a test at all.
//
// The rename from "Ordinary Tuesday" to "Qotidia" was done as a sweep, and
// two places were missed: the cover imprint in these very test fixtures. The
// suite stayed green for months while asserting on a book branded with a
// name the product no longer had, because nothing ever looked at the
// imprint. A blanket find-and-replace had also, on an earlier pass, rewritten
// a parent's memory *about* an ordinary Tuesday — so the fix is not a better
// sweep. It is having one value that the printed cover reads from.
//
// The imprint is the one worth protecting. It goes on the foot of the cover
// of a physical object that sits on a shelf for twenty years, and it is the
// hardest thing in this product to correct after the fact.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND, IMPRINT, ONE_LINER, SENDER, TAGLINE, WORDMARK } from "@/lib/brand";
import { codeOnly } from "./helpers/source";

const root = join(__dirname, "..");
const src = join(root, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if ([".ts", ".tsx"].includes(extname(entry))) out.push(path);
  }
  return out;
}

describe("the name", () => {
  it("is one value the printed cover and the emails both read from", () => {
    expect(IMPRINT).toBe(BRAND);
    expect(SENDER).toBe(BRAND);
    expect(WORDMARK).toBe(BRAND.toLowerCase());
  });

  it("has no trace of the old one left in the source", () => {
    // Prose in a comment would fail this too, which is correct: a comment
    // saying "Ordinary Tuesday" is a comment that has stopped being true.
    const offenders = walk(src)
      .filter((f) => /Ordinary Tuesday|ordinary-tuesday/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(root + "/", ""));
    expect(offenders).toEqual([]);
  });

  it("still lets a memory be about an ordinary Tuesday", () => {
    // The opposite failure, and the one that actually happened: a blanket
    // rename turned a parent's note — "An ordinary Tuesday: boots, Bun Bun,
    // footpath" — into a sentence about the company. Lowercase prose in the
    // fixtures is content, not branding, and must survive any future sweep.
    const demo = readFileSync(join(src, "lib/supabase/demo.ts"), "utf8");
    expect(demo).toContain("An ordinary Tuesday");
  });

  it("is set lowercase in our own typography and nowhere else", () => {
    // House style applies to type we wrote. A quotation or a transcript is
    // left exactly as given — see houseCase() in lib/pdf/html.ts.
    const html = readFileSync(join(src, "lib/pdf/html.ts"), "utf8");
    expect(html).toMatch(/function houseCase/);
    expect(html).toMatch(/quotation|transcript/i);
  });
});

describe("the line", () => {
  it("is set lowercase, like the wordmark", () => {
    // House style applies to type we wrote. The tagline is ours.
    expect(TAGLINE).toBe(TAGLINE.toLowerCase());
  });

  it("has replaced the one that described a service everywhere", () => {
    // Case-insensitive. The first version of this test matched /You live it/
    // and passed while the landing page's closing line — set lowercase, like
    // everything else in our own typography — still read "you live it. we
    // help you keep it." in type the size of a headline. It was found by
    // looking at a screenshot, not by the suite.
    //
    // Narrowed from /you live it/ to the half that was actually wrong. The
    // retired line's fault was never the first clause; it was "we help you
    // keep it", which describes a service standing next to the customer
    // rather than a thing they own. "You live it. Qotidia keeps it." makes
    // the opposite claim with the same rhythm, and is on the homepage by
    // design. A guard that also forbade that would be enforcing a phrase
    // rather than the reason it was dropped.
    const offenders = walk(src)
      .filter((f) => /we help you keep it/i.test(codeOnly(readFileSync(f, "utf8"))))
      .map((f) => f.replace(root + "/", ""));
    expect(offenders).toEqual([]);
  });

  it("is set from TAGLINE wherever it is displayed, not typed out", () => {
    // The drift above was possible because the line existed as literal text
    // in one place and as a constant everywhere else.
    const landing = readFileSync(join(src, "app/page.tsx"), "utf8");
    expect(landing).toContain("{TAGLINE}");
  });

  it("names the engine in the order it runs", () => {
    // notice -> ask -> remember. If the sentence ever stops saying this, the
    // product has stopped being about the thing that makes it different.
    const notices = ONE_LINER.indexOf("notices");
    const remembers = ONE_LINER.indexOf("remembers");
    const book = ONE_LINER.indexOf("book");
    expect(notices).toBeGreaterThan(-1);
    expect(remembers).toBeGreaterThan(notices);
    // The book is last, because it is what a year of noticing produces
    // rather than the product itself.
    expect(book).toBeGreaterThan(remembers);
  });

  it("has one answer for where the app lives", () => {
    // The host was written out seven times with four different fallbacks:
    // https://qotidia.com, http://localhost:3000, "" and — in the export
    // download route — nothing at all, which made `new URL("/login",
    // undefined)` throw and turned a redirect into a 500.
    //
    // Same failure as the imprint, and worse in one place: lib/listen/qr.ts
    // puts this host into a QR code that gets printed into a hardcover. It
    // reads the variable directly on purpose, to refuse rather than fall
    // back, so it is the one file allowed past homeUrl().
    const allowed = ["lib/brand.ts", "lib/listen/qr.ts"];
    const offenders = walk(src)
      .filter((f) => [".ts", ".tsx"].includes(extname(f)))
      .filter((f) => !allowed.some((a) => f.endsWith(a)))
      .filter((f) => codeOnly(readFileSync(f, "utf8")).includes("NEXT_PUBLIC_APP_URL"))
      .map((f) => f.slice(f.indexOf("/src/") + 1));
    expect(offenders, "read the host through homeUrl() from lib/brand.ts").toEqual([]);
  });
});
