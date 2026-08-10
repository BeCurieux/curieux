// Naming a human, without inventing one.
//
// The temptation on an About page is not lying outright. It is the set of
// small inflations that every About page has — "our team", a founding year
// that sounds established, an advisory board of people who replied to one
// email, a portrait bought for eleven dollars. Each is individually harmless
// and together they are the reason nobody believes an About page.
//
// Two rules are enforced here.
//
//   A person is only named if they can be found somewhere that is not this
//   website. A name we alone vouch for is a name we typed, which is the same
//   category of evidence as a security badge.
//
//   Nothing is invented. The list ships with an empty seat, and the page
//   works anyway — an About page that could not ship without a name would
//   have put the whole thing behind one missing string.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeOnly as bare } from "./helpers/source";
import { HOW_MANY, PEOPLE, WHERE, named } from "@/lib/trust/people";
import { FOUNDER } from "@/lib/trust/founder";
import { NOTICE_DAYS, SILENT_FOR_DAYS } from "@/lib/succession/policy";
import { PUBLIC_PAGES } from "@/app/sitemap";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = src("../src/app/about/page.tsx");

describe("a name has to be checkable", () => {
  it("names nobody who cannot be found off this website", () => {
    for (const p of named()) {
      expect(p.elsewhere.length, p.name).toBeGreaterThan(0);
      for (const e of p.elsewhere) {
        expect(e.url, `${p.name} → ${e.what}`).toMatch(/^https:\/\//);
        expect(e.url, `${p.name} → ${e.what}`).not.toMatch(/qotidia\.com/);
      }
    }
  });

  it("drops a name with nowhere to check it", () => {
    // Both halves are required. This is the rule doing work rather than
    // describing itself: the seat below has a name in some deployments and
    // no links, and must not be printed.
    const half = [{ name: "Someone", does: "x", elsewhere: [] }];
    expect(half.filter((p) => p.name.trim() !== "" && p.elsewhere.length > 0)).toEqual([]);
  });

  it("reads through named(), not the raw list", () => {
    // Rendering PEOPLE directly would print the unchecked seat and quietly
    // undo the whole rule.
    expect(page).toMatch(/named\(\)/);
    expect(bare(page)).not.toMatch(/PEOPLE\.map/);
  });
});

describe("nobody is invented", () => {
  it("ships an empty seat rather than a plausible person", () => {
    expect(PEOPLE).toHaveLength(1);
    expect(PEOPLE[0].name).toBe(FOUNDER.name);
    expect(named()).toEqual([]);
  });

  it("refuses a placeholder that looks like a person", () => {
    for (const p of PEOPLE) {
      expect(p.name).not.toMatch(/john|jane|sarah|alex|sam\b|founder|admin|team|example|lorem/i);
    }
  });

  it("has no portraits at all", () => {
    // A stock photograph under a name is the cheapest lie on the internet,
    // and this page's entire job is being the opposite of that.
    expect(page).not.toMatch(/<img|<Image|avatar|headshot|portrait/i);
  });

  it("invents no company furniture", () => {
    const words = bare(page);
    expect(words).not.toMatch(/\bour team\b|\badvisory board\b|\binvestors? include\b/i);
    expect(words).not.toMatch(/founded in \d{4}|since \d{4}|trusted by [\d,]+/i);
  });

  it("says how many people there are rather than leaving it to be guessed", () => {
    // A product with a privacy page, a printing pipeline and a succession
    // policy reads like a company. A family should know it is one person
    // before deciding how much to depend on it.
    expect(HOW_MANY).toBeGreaterThan(0);
    expect(page).toMatch(/One person makes this|HOW_MANY/);
    expect(WHERE.length).toBeGreaterThan(3);
  });

  it("still works with the seat empty", () => {
    // The unnamed branch has to say something true, not apologise for a
    // missing string.
    expect(page).toMatch(/people\.length > 0 \?/);
    expect(page).toMatch(/no team, no investor and no board/i);
  });
});

describe("the question a solo product owes an answer to", () => {
  it("asks it out loud", () => {
    expect(page).toMatch(/If I stop/);
    expect(page).toMatch(/none of them is[\s\S]{0,80}won&rsquo;t happen/);
  });

  it("answers it with things that are built, not intentions", () => {
    // Export, the physical book, and succession — all three exist. An
    // answer here that was a plan would be worse than no section.
    expect(page).toContain("/settings/privacy#export");
    expect(page).toContain("/settings/succession");
    expect(page).toMatch(/printed hardcover/i);
  });

  it("quotes the succession numbers the engine enforces", () => {
    expect(page).toContain("NOTICE_DAYS");
    expect(page).toContain("SILENT_FOR_DAYS");
    // Months, because eighteen months is how a person says 550 days.
    expect(Math.round(SILENT_FOR_DAYS / 30.44)).toBe(18);
    expect(NOTICE_DAYS).toBeGreaterThanOrEqual(14);
  });

  it("does not offer to find somebody an heir", () => {
    // If nobody was named, silence does nothing. The page has to carry that
    // half or it describes a product that gives archives away.
    // Whitespace-tolerant: the sentence wraps across JSX lines.
    expect(page).toMatch(/named\s+nobody, silence does nothing/i);
  });
});

describe("reachable and honest about what it is not", () => {
  it("is linked from the footer and from help", () => {
    for (const from of ["../src/app/page.tsx", "../src/app/help/page.tsx"]) {
      expect(src(from), from).toContain('href="/about"');
    }
  });

  it("is a page we want found", () => {
    expect(PUBLIC_PAGES).toContain("/about");
  });

  it("makes up no statistics", () => {
    // It first said memory "lasts about eighteen months" in a parent's head
    // — a specific, invented, unsourceable number, on a page whose whole
    // argument is that we only say what we can show. The nearby figures are
    // fine because they come from the succession engine; a research finding
    // nobody published is not.
    const words = bare(page)
      .replace(/NOTICE_DAYS|SILENT_FOR_DAYS|MONTHS_SILENT|HOW_MANY/g, "");
    expect(words).not.toMatch(/\b(studies|research|science|experts?) (show|say|find)/i);
    expect(words).not.toMatch(/\b\d+ ?(%|per cent|percent)/i);
    expect(words).not.toMatch(/lasts about/i);
  });

  it("tells people it is not a backup", () => {
    // The most expensive misunderstanding available. Somebody who deletes
    // their camera roll because "it's in Qotidia" has lost the photographs.
    expect(page).toMatch(/Keep your photos backed up as well/i);
  });
});
