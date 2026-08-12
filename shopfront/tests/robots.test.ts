import { describe, expect, it } from "vitest";
import { parseRobots } from "@/lib/ingest/robots";
import { ROBOTS_TXT } from "./helpers/fixtures";

const UA = "ShopfrontBot/0.1 (+https://shopfront.new/bot)";

describe("parseRobots", () => {
  it("applies a Shopify default robots.txt the way it is meant", () => {
    const rules = parseRobots(ROBOTS_TXT, UA);
    expect(rules.isAllowed("/products.json")).toBe(true);
    expect(rules.isAllowed("/collections/all")).toBe(true);
    expect(rules.isAllowed("/checkout")).toBe(false);
    expect(rules.isAllowed("/cart")).toBe(false);
    expect(rules.isAllowed("/collections/all?preview_theme_id=1")).toBe(false);
  });

  it("prefers the group that names us over the wildcard group", () => {
    const rules = parseRobots(
      `User-agent: *\nDisallow: /\n\nUser-agent: ShopfrontBot\nDisallow: /admin\n`,
      UA,
    );
    expect(rules.isAllowed("/products.json")).toBe(true);
    expect(rules.isAllowed("/admin")).toBe(false);
  });

  it("lets the longest matching rule win, with Allow taking a tie", () => {
    const rules = parseRobots(`User-agent: *\nDisallow: /collections\nAllow: /collections/all\n`, UA);
    expect(rules.isAllowed("/collections/new")).toBe(false);
    expect(rules.isAllowed("/collections/all")).toBe(true);
  });

  it("treats an empty Disallow as permission, not as a rule matching everything", () => {
    const rules = parseRobots(`User-agent: *\nDisallow:\n`, UA);
    expect(rules.isAllowed("/anything")).toBe(true);
  });

  it("honours $ anchoring", () => {
    const rules = parseRobots(`User-agent: *\nDisallow: /*.json$\n`, UA);
    expect(rules.isAllowed("/products.json")).toBe(false);
    expect(rules.isAllowed("/products.json?page=2")).toBe(true);
  });

  it("shares one block of rules between consecutive user-agent lines", () => {
    const rules = parseRobots(`User-agent: BadBot\nUser-agent: ShopfrontBot\nDisallow: /\n`, UA);
    expect(rules.isAllowed("/products.json")).toBe(false);
  });

  it("reads crawl-delay in milliseconds", () => {
    expect(parseRobots(`User-agent: *\nCrawl-delay: 2\n`, UA).crawlDelayMs).toBe(2000);
    expect(parseRobots(`User-agent: *\nDisallow: /x\n`, UA).crawlDelayMs).toBeNull();
  });

  it("ignores comments and directives that belong to no group", () => {
    const rules = parseRobots(`# a comment\nDisallow: /orphan\nUser-agent: *\nDisallow: /real\n`, UA);
    expect(rules.isAllowed("/orphan")).toBe(true);
    expect(rules.isAllowed("/real")).toBe(false);
  });

  it("allows everything when robots.txt says nothing about us", () => {
    expect(parseRobots("", UA).isAllowed("/products.json")).toBe(true);
    expect(parseRobots("Sitemap: https://x/sitemap.xml", UA).isAllowed("/products.json")).toBe(true);
  });
});
