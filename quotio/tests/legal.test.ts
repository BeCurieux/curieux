import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { brand, legalEntityKnown } from "@/config/brand";

/**
 * The privacy policy makes checkable promises.
 *
 * "No cookies, no IP addresses, no cross-site tracking" is not a sentiment —
 * it is a claim about code, and the day somebody adds a cookie for a good
 * reason it becomes a false statement in a legal document. That is a worse
 * failure than any of the copy drift this project has fixed so far, so it gets
 * a test rather than a good intention.
 */
const SRC = path.join(__dirname, "..", "src");

function read(...parts: string[]): string {
  return readFileSync(path.join(SRC, ...parts), "utf8");
}

/** Strip comments, so a line explaining why we don't do X doesn't read as X. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("the policy's promises are true of the code", () => {
  it("sets no cookie in anything a visitor loads", () => {
    // The session cookie is the author's, set on sign-in. A published widget,
    // its embed, and the analytics client must set nothing.
    for (const file of [
      ["components", "widget", "WidgetRenderer.tsx"],
      ["components", "widget", "LeadForm.tsx"],
      ["lib", "analytics", "client.ts"],
      ["app", "embed", "[slug]", "page.tsx"],
    ]) {
      expect(code(read(...file)), file.join("/")).not.toMatch(/document\.cookie|Set-Cookie/i);
    }
  });

  it("records no IP address on any endpoint a visitor reaches", () => {
    // /api/generate does key its rate limit on the caller's address, but only
    // the builder calls that. The two a published widget talks to must not.
    for (const route of ["events", "leads"]) {
      const source = code(read("app", "api", route, "route.ts"));
      expect(source, route).not.toMatch(/x-forwarded-for|x-real-ip/i);
    }
  });

  it("stores the analytics id in sessionStorage, which the policy says dies with the tab", () => {
    const client = code(read("lib", "analytics", "client.ts"));
    expect(client).toContain("sessionStorage");
    expect(client).not.toContain("localStorage");
  });

  it("names the same number of event types the policy quotes", async () => {
    // The page renders EVENT_TYPES.length rather than a number someone typed,
    // so this guards the import rather than the sentence.
    const { EVENT_TYPES } = await import("@/lib/analytics/events");
    expect(read("app", "privacy", "page.tsx")).toContain("EVENT_TYPES.length");
    expect(EVENT_TYPES.length).toBeGreaterThan(0);
  });

  it("only sends prompts to the AI provider, never visitor data", () => {
    const provider = code(read("lib", "ai", "anthropic.ts"));
    expect(provider).not.toMatch(/listLeads|LeadRecord|createLead/);
  });
});

describe("the pages refuse to look finished before they are", () => {
  it("has no operator configured yet, so the notice is showing", () => {
    // If this fails because somebody filled brand.legal in, that is the point
    // — delete this assertion and check the pages read correctly instead.
    expect(legalEntityKnown()).toBe(false);
    expect(brand.legal.entity).toBe("");
  });

  it("ships no placeholder text that could reach production", () => {
    for (const page of ["terms", "privacy"]) {
      const source = read("app", page, "page.tsx");
      expect(source, page).not.toMatch(/\[COMPANY|\[YOUR|TODO|XXX|Lorem/i);
    }
  });

  it("links both ways, so neither is a dead end", () => {
    expect(read("app", "terms", "page.tsx")).toContain('current="terms"');
    expect(read("app", "privacy", "page.tsx")).toContain('current="privacy"');
    expect(read("components", "site", "Chrome.tsx")).toContain('href: "/privacy"');
    expect(read("components", "site", "Chrome.tsx")).toContain('href: "/terms"');
  });
});
