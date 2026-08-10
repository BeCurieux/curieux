// Two typefaces, and which is which.
//
// The rule is not decorative. The serif is the family — a memory, a quote, a
// question about their child, the name of a story. The sans is us — nav,
// buttons, counts, dates, statuses, the arithmetic under an observation.
//
// Charter used to set both, which sounds like restraint and read as a
// document: a settings page and a child's first sentence in the same voice,
// so neither was distinguished. The risk now is the opposite one — the sans
// is the default, so anything new that renders a family's own words gets the
// interface face unless somebody remembers. This is the somebody.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../src", import.meta.url).pathname;

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f: string) => f.slice(f.indexOf("src/"));

describe("the family's own words are set in the family's face", () => {
  /**
   * Every line that renders a memory's text, with the markup around it.
   *
   * A blunt instrument on purpose: it looks at the element the text sits in
   * and asks whether that element, or the one wrapping it on the line
   * before, buys back the serif.
   */
  function rendersMemoryText(): { where: string; line: string; prev: string }[] {
    const found: { where: string; line: string; prev: string }[] = [];
    for (const file of files(SRC)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/\{(m|memory|entry)\.raw_text\}/.test(line)) return;
        found.push({ where: `${rel(file)}:${i + 1}`, line, prev: lines[i - 1] ?? "" });
      });
    }
    return found;
  }

  it("is rendered somewhere, or this test is checking nothing", () => {
    expect(rendersMemoryText().length).toBeGreaterThan(0);
  });

  it("never lands in the interface face", () => {
    const wrong = rendersMemoryText()
      .filter(({ line, prev }) => {
        const markup = `${prev} ${line}`;
        return !/font-display|"reading"|blockquote/.test(markup);
      })
      .map((m) => m.where);
    expect(wrong).toEqual([]);
  });
});

describe("the division itself", () => {
  const tailwind = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  it("has a serif and a sans that are actually different", () => {
    const display = tailwind.match(/display: \[(.*?)\]/s)?.[1] ?? "";
    const body = tailwind.match(/\n\s+body: \[(.*?)\]/s)?.[1] ?? "";
    expect(display).toContain("charter");
    expect(body).not.toContain("charter");
    expect(body).toContain("apple-system");
  });

  it("keeps the books' face for headings", () => {
    // Charter is what the printed books are set in. Headings on screen use
    // it so the object and the site are recognisably the same product.
    expect(css).toMatch(/h1, h2, h3 \{[\s\S]*?font-display/);
  });

  it("sets quotes in the serif wherever they appear", () => {
    expect(css).toMatch(/blockquote \{[\s\S]*?font-display/);
  });

  it("offers one way to buy the serif back", () => {
    // A single class, so the decision is visible in the markup and greppable
    // rather than being made again with a utility at every call site.
    expect(css).toMatch(/\.reading \{[\s\S]*?font-display/);
  });
});
