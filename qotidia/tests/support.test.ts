// What a one-person company may promise about answering.
//
// The failure mode this file guards is not exaggeration in general — it is
// one specific, tempting kind. A solo operation reaches for the vocabulary of
// a support organisation ("our team", "24/7", "priority support") because
// that vocabulary exists and sounds reassuring, and every word of it would be
// false here. What is actually true is unusually good: one person reads every
// email and that person wrote the code. It only reads as good if the page
// hasn't also claimed to be a department.
//
// The other guard is the name. FOUNDER.name is empty in the repository and
// nothing may invent one — a fabricated human on a page whose whole purpose
// is that a real human answers is the exact failure the page exists to
// prevent.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FOUNDER, HONEST_LIMIT, REPLY, SUPPORT_PROMISE, URGENT, signedBy, whoReads,
} from "@/lib/trust/founder";
import { SUPPORT_ACCESS_HOURS } from "@/lib/family/support";
import { PUBLIC_PAGES } from "@/app/sitemap";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = src("../src/app/help/page.tsx");
const module_ = src("../src/lib/trust/founder.ts");

/**
 * Source with comments removed.
 *
 * A vocabulary guard read against raw source is broken by the sentence
 * explaining the rule — founder.ts names "our team" and "24/7" precisely to
 * say they are forbidden. Third time this trap has been walked into in this
 * codebase; the storage guard and the asking test got there first.
 */
const bare = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|\*).*$/gm, "");

describe("the promise is one a single person can keep", () => {
  it("counts the working day in days, not hours", () => {
    // "Within 24 hours" from one person means "within 24 hours unless it is
    // Saturday", and a family finding that out on Saturday has learned
    // something about how carefully we choose our words.
    expect(page).toMatch(/business day/);
    expect(bare(page)).not.toMatch(/\b24[/ ]?7\b|around the clock|\bany time of day\b/i);
  });

  it("says where in the world the working day is", () => {
    // A promise measured in business days is meaningless without one.
    expect(FOUNDER.timezone.length).toBeGreaterThan(3);
    expect(page).toContain("FOUNDER.timezone");
  });

  it("has two tiers, because one number would be a lie or useless", () => {
    // Somebody locked out and somebody asking about paper stock are not
    // asking the same question.
    expect(REPLY.urgentDays).toBeLessThan(REPLY.ordinaryDays);
    expect(REPLY.ordinaryDays).toBeLessThanOrEqual(5);
    expect(URGENT.length).toBeGreaterThanOrEqual(3);
  });

  it("spells small numbers, like everything else the product says", () => {
    // It first rendered "the urgent kinds within 1" — a bare numeral with
    // the unit dropped. Same class as "the yellow boots is back": copy
    // built by interpolating a number into a sentence nobody read back.
    const said = SUPPORT_PROMISE.map((u) => u.text).join(" ");
    expect(said).toContain("one business day");
    expect(said).toContain("three business days");
    expect(said).not.toMatch(/within [0-9]/);
  });

  it("says concretely what counts as urgent", () => {
    // "Urgent issues" is a tier nobody can place themselves in.
    for (const u of URGENT) expect(u.length, u).toBeGreaterThan(15);
    expect(URGENT.join(" ")).toMatch(/can't get in|missing/i);
  });

  it("never claims to be a team", () => {
    const all = bare(page) + bare(module_);
    expect(all).not.toMatch(/\bour team\b|\bthe team\b|\bour staff are\b/i);
    expect(all).not.toMatch(/priority support|dedicated (support|account) manager|first[- ]line/i);
  });

  it("states the limitation as a limitation", () => {
    // A promise page that only lists strengths is an advertisement. There
    // being nobody to escalate to is the truthful cost of the same fact
    // that makes the support good.
    const escalate = SUPPORT_PROMISE.find((u) => /escalate/i.test(u.text));
    expect(escalate).toBeTruthy();
    expect(escalate!.text).toMatch(/nobody above/i);
  });

  it("promises an answer even when the answer is no", () => {
    const said = SUPPORT_PROMISE.map((u) => u.text).join(" ");
    expect(said).toMatch(/can\u2019t be fixed|won\u2019t be/i);
  });
});

describe("nobody is invented", () => {
  it("ships no name, rather than a made-up one", () => {
    // If this ever fails it should be because a real person filled it in.
    // It must never be satisfied by a plausible-looking placeholder.
    expect(FOUNDER.name).not.toMatch(/john|jane|sarah|alex|sam\b|founder|admin|team|example/i);
  });

  it("signs off truthfully with the name unset", () => {
    expect(signedBy()).toBe("the person who built Qotidia");
    expect(whoReads()).toBe("The person who wrote it");
  });

  it("would use a real name the moment one is set", () => {
    // The page reads through the helpers rather than hardcoding either
    // branch, so filling in the constant is the whole change.
    expect(page).toMatch(/whoReads\(\)/);
    expect(bare(page)).not.toMatch(/the person who wrote it/i);
  });

  it("sets its apostrophes, on a page in the display serif", () => {
    // The trust modules are the only copy in the product set as a document.
    // A straight quote in "can\u2019t" is visible there in a way it is not
    // in a form label.
    const strings = [...SUPPORT_PROMISE.map((u) => `${u.heading} ${u.text}`), ...URGENT, HONEST_LIMIT];
    for (const s of strings) expect(s, s.slice(0, 40)).not.toContain("'");
  });

  it("uses the address we actually send from", () => {
    expect(page).toContain("FROM.address");
    expect(page).not.toMatch(/@[a-z]+\.(com|test)/);
  });
});

describe("what it says about looking inside", () => {
  it("quotes the expiry the code actually sets", () => {
    const look = SUPPORT_PROMISE.find((u) => /look inside/i.test(u.heading))!;
    expect(look.text).toContain(String(SUPPORT_ACCESS_HOURS));
  });

  it("separates what software enforces from what a person promises", () => {
    // The consent record and the week-long database ceiling are real. That
    // nobody looks without asking is conduct — the credentials that run the
    // product can read any row, as they can everywhere. Implying the
    // database prevents it would be a more sophisticated version of the
    // badge row the trust strip refuses to be.
    expect(HONEST_LIMIT).toMatch(/commitment, not a mechanism/i);
    expect(HONEST_LIMIT).toMatch(/activity log/i);
    expect(page).toContain("HONEST_LIMIT");
  });

  it("does not claim the database stops us reading", () => {
    const all = SUPPORT_PROMISE.map((u) => u.text).join(" ");
    expect(all).not.toMatch(/we (can|could)not (technically )?(read|see|access)/i);
    expect(all).not.toMatch(/impossible for us to/i);
  });
});

describe("it is a page, not a help centre", () => {
  it("puts the address above the reasons to trust it", () => {
    // Somebody in trouble came for the address. Burying it under six
    // promises would be its own small failure.
    // Against where they are rendered, not where they are imported — the
    // import line sits above everything and made this pass backwards.
    const address = page.indexOf("href={`mailto:");
    const promises = page.indexOf("SUPPORT_PROMISE.map");
    expect(address).toBeGreaterThan(-1);
    expect(address).toBeLessThan(promises);
  });

  it("has no search box and no article stubs", () => {
    expect(page).not.toMatch(/type="search"|knowledge base|browse (articles|topics)/i);
  });

  it("offers only what is genuinely faster than asking", () => {
    // A fifth entry is the beginning of a help centre.
    const links = page.match(/\/settings\/[a-z#]+/g) ?? [];
    expect(new Set(links).size).toBeLessThanOrEqual(4);
  });

  it("is reachable without knowing the URL", () => {
    for (const from of ["../src/app/page.tsx", "../src/app/account/page.tsx"]) {
      expect(src(from), from).toContain('href="/help"');
    }
  });

  it("is a page we want found", () => {
    // Unlike everything else a family touches. A parent deciding whether to
    // trust this should be able to read what happens when they need help
    // before they hand over their child's photographs.
    expect(PUBLIC_PAGES).toContain("/help");
  });
});
