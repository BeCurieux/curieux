import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  extractAnchors,
  extractHeadings,
  extractJsonLd,
  extractMeta,
  extractProse,
  extractStyleBlocks,
  extractStylesheetHrefs,
  extractTitle,
  htmlToText,
  jsonLdOfType,
  parseAttributes,
} from "@/lib/ingest/html";
import { HOMEPAGE_HTML } from "./helpers/fixtures";

describe("parseAttributes", () => {
  it("handles the quoting styles that appear in real theme markup", () => {
    const attributes = parseAttributes(`class="a b" id='x' data-flag src=/y.png hidden`);
    expect(attributes).toMatchObject({ class: "a b", id: "x", src: "/y.png", "data-flag": "", hidden: "" });
  });
});

describe("extractMeta", () => {
  const meta = extractMeta(HOMEPAGE_HTML);

  it("reads name and property tags into one lookup", () => {
    expect(meta.get("og:site_name")).toBe("Kelp & Cotton");
    expect(meta.get("theme-color")).toBe("#2f5d50");
    expect(meta.get("OG:SITE_NAME")).toBe("Kelp & Cotton");
  });

  it("first() falls through in preference order", () => {
    expect(meta.first("og:nothing", "description")).toContain("Slow basics");
    expect(meta.first("og:nothing", "also:nothing")).toBeUndefined();
  });
});

describe("extractTitle", () => {
  it("decodes entities and collapses whitespace", () => {
    expect(extractTitle(HOMEPAGE_HTML)).toBe("Kelp & Cotton | Slow basics for a warm house");
    expect(extractTitle("<html><head></head></html>")).toBeUndefined();
  });
});

describe("extractJsonLd", () => {
  it("parses ld+json blocks and finds nodes by type", () => {
    const nodes = extractJsonLd(HOMEPAGE_HTML);
    const organisations = jsonLdOfType(nodes, "Organization");
    expect(organisations[0]!["name"]).toBe("Kelp & Cotton");
  });

  it("flattens @graph, which is how most themes emit several nodes", () => {
    const html = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebSite","name":"A"},{"@type":"Organization","name":"B"}]}</script>`;
    expect(jsonLdOfType(extractJsonLd(html), "Organization")[0]!["name"]).toBe("B");
  });

  it("drops one broken block without losing the good one beside it", () => {
    const html = `
      <script type="application/ld+json">{ not json }</script>
      <script type="application/ld+json">{"@type":"Organization","name":"Survivor"}</script>`;
    expect(jsonLdOfType(extractJsonLd(html), "Organization")).toHaveLength(1);
  });

  it("ignores scripts that are not ld+json", () => {
    expect(extractJsonLd(`<script>{"@type":"Organization"}</script>`)).toEqual([]);
  });
});

describe("extractHeadings and extractAnchors", () => {
  it("reads the copy and the links", () => {
    expect(extractHeadings(HOMEPAGE_HTML).map((h) => h.text)).toEqual([
      "Slow basics for a warm house",
      "Knitted in Porto, in runs of fifty",
    ]);
    const anchors = extractAnchors(HOMEPAGE_HTML);
    expect(anchors.find((a) => a.href === "/pages/about")?.text).toBe("Our workshop");
    expect(anchors.some((a) => a.href.includes("instagram.com"))).toBe(true);
  });
});

describe("extractProse", () => {
  it("takes body copy and leaves script and style contents alone", () => {
    const prose = extractProse(HOMEPAGE_HTML);
    expect(prose[0]).toContain("We make a small number of things");
    expect(prose.join(" ")).not.toContain("Shopify.currency");
    expect(prose.join(" ")).not.toContain("--color-background");
  });

  it("skips fragments too short to say anything about voice", () => {
    expect(extractProse("<p>Hi</p><p>An actual sentence about the product.</p>")).toEqual([
      "An actual sentence about the product.",
    ]);
  });
});

describe("style extraction", () => {
  it("finds inline blocks and stylesheet hrefs", () => {
    expect(extractStyleBlocks(HOMEPAGE_HTML)[0]).toContain("--color-accent");
    expect(extractStylesheetHrefs(HOMEPAGE_HTML)).toEqual(["//cdn.shopify.com/s/files/1/0001/theme.css"]);
  });
});

describe("decodeEntities", () => {
  it("handles named, decimal and hex forms", () => {
    expect(decodeEntities("Kelp &amp; Cotton")).toBe("Kelp & Cotton");
    expect(decodeEntities("caf&#233;")).toBe("café");
    expect(decodeEntities("caf&#xe9;")).toBe("café");
    expect(decodeEntities("it&rsquo;s")).toBe("it’s");
  });

  it("leaves unknown entities alone rather than eating them", () => {
    expect(decodeEntities("a &notanentity; b")).toBe("a &notanentity; b");
    expect(decodeEntities("100% & rising")).toBe("100% & rising");
  });
});

describe("htmlToText", () => {
  it("keeps block boundaries as spaces", () => {
    expect(htmlToText("<p>One.</p><p>Two.</p>")).toBe("One. Two.");
    expect(htmlToText("Line<br>break")).toBe("Line break");
  });

  it("truncates on a word boundary, with an ellipsis", () => {
    const text = htmlToText(`<p>${"word ".repeat(50)}</p>`, 40);
    expect(text.length).toBeLessThanOrEqual(41);
    expect(text.endsWith("…")).toBe(true);
    expect(text).not.toMatch(/\bwor…$/);
  });

  it("strips script and style content out of a description", () => {
    expect(htmlToText(`<p>Real copy.</p><script>alert(1)</script>`)).toBe("Real copy.");
  });
});
