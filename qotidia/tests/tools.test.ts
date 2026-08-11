// A free tool that is not a lead magnet.
//
// "Free tool" in growth marketing usually means a form with a result behind
// it: you give it your email, it gives you a number, and the number was never
// the point. Everything here exists to make that shape impossible to build by
// accident under this wordmark.
//
// The load-bearing test is the one about uploads. A page that reads somebody's
// camera roll and sends nothing is the most persuasive privacy argument this
// product can make — far stronger than any sentence on /privacy — and it is
// only worth making because it is structural rather than promised. So it is
// checked: no fetch, no server action, no form post, and no FileReader, that
// last one because reading the bytes is precisely the step that would turn
// "we never look at your photographs" from a fact about the code into a thing
// you have to trust us about.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeOnly as bare } from "./helpers/source";
import { NEVER, TOOLS, publishedTools, toolBySlug } from "@/lib/tools/list";
import { PUBLIC_PAGES } from "@/app/sitemap";
import sitemap from "@/app/sitemap";
import { OFF_LIMITS } from "@/app/robots";
import { discoveries, looksFake, type Shot } from "@/lib/onboarding/discover";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const tool = src("../src/app/tools/what-your-photos-know/tool.tsx");
const index = src("../src/app/tools/page.tsx");
const detail = src("../src/app/tools/[slug]/page.tsx");

describe("nothing leaves the device", () => {
  it("sends nothing, anywhere", () => {
    const code = bare(tool);
    expect(code).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
    expect(code).not.toMatch(/"use server"|<form|action=\{/);
    expect(code).not.toMatch(/supabase|uploadTicket|@\/app\/actions/);
  });

  it("never opens a file", () => {
    // The step that would turn "we never look at your photographs" from a
    // fact about the code into a thing you have to trust us about.
    const code = bare(tool);
    expect(code).not.toMatch(/FileReader|\.arrayBuffer\(|\.text\(\)|createObjectURL/);
  });

  it("takes the timestamp and nothing else from each file", () => {
    // Not the name, not the size, not the type beyond "is it an image".
    const read = bare(tool).slice(bare(tool).indexOf("const shots"), bare(tool).indexOf("if (shots.length < 6)"));
    expect(read).toContain("file.lastModified");
    expect(read).not.toMatch(/file\.name|file\.size|file\.webkitRelativePath/);
  });

  it("keeps nothing, not even a count", () => {
    const code = bare(tool);
    expect(code).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    // Including our own analytics, which would otherwise be the obvious
    // place to measure how the tool is doing.
    expect(code).not.toMatch(/@\/lib\/analytics/);
  });

  it("says so above the tool, not in a footer", () => {
    // Somebody deciding whether to hand a page four hundred photographs of
    // their child needs the sentence before they decide.
    expect(detail.indexOf("{tool.promise}")).toBeLessThan(detail.indexOf("<Tool />"));
    for (const t of TOOLS) expect(t.promise, t.slug).toMatch(/nothing leaves|no account/i);
  });
});

describe("it is not a lead magnet", () => {
  it("asks for nothing before it works", () => {
    // A tool that collects an address before it works is an advertisement
    // wearing a lab coat.
    const code = bare(tool);
    expect(code).not.toMatch(/type="email"|name="email"|Enter your email|sign up to see/i);
    // The only input is the file picker.
    const inputs = code.match(/<input[\s\S]*?\/>/g) ?? [];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain('type="file"');
  });

  it("shows the whole answer, not a teaser", () => {
    const code = bare(tool);
    expect(code).not.toMatch(/unlock|see the rest|upgrade to (see|view)|blur/i);
  });

  it("makes one offer, after the useful part", () => {
    const code = bare(tool);
    const links = code.match(/href="\/(pricing|signup)"/g) ?? [];
    expect(links).toHaveLength(1);
    expect(code.indexOf('href="/pricing"')).toBeGreaterThan(code.indexOf("verdict.found.map"));
  });

  it("states its refusals where a visitor reads them", () => {
    expect(NEVER.length).toBeGreaterThanOrEqual(4);
    for (const page of [index, detail]) expect(page).toContain("NEVER");
  });
});

describe("it runs the real engine", () => {
  it("imports the product's own module rather than imitating it", () => {
    // A simplified imitation would be both less useful and less true.
    expect(tool).toMatch(/from "@\/lib\/onboarding\/discover"/);
    expect(tool).toMatch(/discoveries\(/);
  });

  it("inherits the engine's refusal to speak from junk timestamps", () => {
    // A camera card copied in one go gives every file the same time. The
    // engine already knows; the tool must not route around it.
    const sameInstant: Shot[] = Array.from({ length: 50 }, (_, i) => ({
      id: String(i), at: "2027-03-01T09:00:00.000Z",
    }));
    expect(looksFake(sameInstant)).toBe(true);
    expect(discoveries(sameInstant)).toEqual([]);
    expect(tool).toMatch(/looksFake\(shots\)/);
  });

  it("explains that rather than showing an error", () => {
    // "These dates aren't real dates" is a finding. A spinner that never
    // resolves is a bug report.
    expect(tool).toMatch(/aren&rsquo;t real dates/);
    expect(tool).toMatch(/We could invent something\s*\n?\s*from it. We would rather say nothing/);
  });

  it("drops back from mornings to days when there is no clock", () => {
    expect(tool).toMatch(/hasClockTimes\(shots\)/);
    expect(tool).toMatch(/dates but not times/);
  });

  it("treats finding nothing as an answer, not a failure", () => {
    expect(tool).toMatch(/a real answer rather than a\s*\n?\s*failure/);
  });
});

describe("published means published", () => {
  it("is in the sitemap, and nothing robots forbids is", () => {
    const urls = sitemap().map((e) => e.url);
    for (const t of publishedTools()) {
      expect(urls.some((u) => u.endsWith(`/tools/${t.slug}`)), t.slug).toBe(true);
    }
    for (const url of urls) {
      for (const blocked of OFF_LIMITS) expect(url.includes(blocked), url).toBe(false);
    }
    expect(PUBLIC_PAGES).toContain("/tools");
  });

  it("claims no modified date it cannot support", () => {
    // A tool changes when its code changes. Inventing a date for that is the
    // same lie the journal refuses to tell.
    const rows = sitemap().filter((r) => r.url.includes("/tools/"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.lastModified).toBeUndefined();
  });

  it("serves only what exists", () => {
    expect(toolBySlug("a-tool-nobody-built")).toBeNull();
    expect(detail).toContain("dynamicParams = false");
  });

  it("names the question a person actually has", () => {
    for (const t of TOOLS) {
      expect(t.question, t.slug).toMatch(/\?$/);
      expect(t.description.length, t.slug).toBeGreaterThan(40);
    }
  });

  it("is reachable from somewhere a person will be", () => {
    expect(src("../src/app/page.tsx")).toContain('href="/tools"');
    expect(src("../src/app/journal/page.tsx")).toContain('href="/tools"');
  });
});
