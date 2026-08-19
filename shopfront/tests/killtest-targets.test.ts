/**
 * Reading the targets file.
 *
 * This is the list a thirty-merchant run is made from, and it is assembled by
 * redirecting one command's output into a file — which means the file can
 * contain things nobody typed. The read has to notice.
 *
 * The case that matters is the one that already happened: `pnpm` writes a
 * two-line banner to stdout before the script it runs, `pnpm screen … >>
 * targets.txt` captures it, and neither line starts with `#`. The old parser
 * took them as store URLs and handed them to preflight, which had nothing to
 * say about a store it cannot recognise — so the only complaint was that two
 * screening runs had appended the same banner twice:
 *
 *     × Duplicate targets: > shopfront@0.1.0 screen C:\dev\popuup\shopfront …
 *
 * True, useless, and actively misleading: deduplicating leaves one copy of each
 * and the run then tries to ingest them.
 */

import { describe, expect, it } from "vitest";
import { parseTargets } from "@/lib/killtest/targets";

describe("reading a targets file", () => {
  it("reads storefronts under their headings", () => {
    const targets = parseTargets(
      [
        "# thirty merchants",
        "",
        "[merchants]",
        "https://store.com          # beauty, ~80 products",
        "https://other.com",
        "",
        "[creators]",
        "https://creator.com        # 40k followers",
      ].join("\n"),
    );

    expect(targets).toEqual([
      { storeUrl: "https://store.com", segment: "merchant", note: "beauty, ~80 products" },
      { storeUrl: "https://other.com", segment: "merchant" },
      { storeUrl: "https://creator.com", segment: "creator", note: "40k followers" },
    ]);
  });

  it("reads a file with Windows line endings identically", () => {
    const lines = ["[merchants]", "https://store.com  # a note", "https://other.com"];
    expect(parseTargets(lines.join("\r\n"))).toEqual(parseTargets(lines.join("\n")));
  });

  it("ignores a line that is only a comment, wherever the comment starts", () => {
    expect(parseTargets("  # https://store.com — rejected, feed closed\n")).toEqual([]);
  });

  /*
   * The banner, which is the reason this file exists.
   */
  describe("a line that is not a store", () => {
    const BANNER = [
      "[merchants]",
      "> shopfront@0.1.0 screen C:\\dev\\popuup\\shopfront",
      "> tsx --env-file-if-exists=.env.local scripts/screen.ts \"killtest\\candidates.txt\"",
      "https://store.com",
    ].join("\n");

    it("refuses to read it rather than passing it on as a target", () => {
      expect(() => parseTargets(BANNER)).toThrow(/not a store URL/);
    });

    it("says which line, so the file can be opened at the right place", () => {
      expect(() => parseTargets(BANNER, { file: "killtest/targets.txt" })).toThrow(
        /Line 2 in killtest\/targets\.txt/,
      );
    });

    it("names the redirect and the flag that prevents it", () => {
      // The failure is one flag away from never happening. A message that
      // stopped at "not a store URL" would leave somebody deleting lines by
      // hand and then doing it again after the next batch.
      expect(() => parseTargets(BANNER)).toThrow(/pnpm --silent/);
    });

    it("rejects anything else that is not a URL, without guessing at a cause", () => {
      expect(() => parseTargets("[merchants]\nstore.com")).toThrow(/One storefront URL per line/);
    });

    it("rejects a protocol that is not http", () => {
      // `file:` and `javascript:` parse perfectly well as URLs.
      expect(() => parseTargets("[merchants]\nfile:///etc/passwd")).toThrow(/not a store URL/);
    });

    it("truncates a long line rather than printing the whole file at somebody", () => {
      const long = `https://store.com/${"x".repeat(200)}`;
      let message = "";
      try {
        parseTargets(`[merchants]\n${long}`);
      } catch (error) {
        message = error instanceof Error ? error.message : "";
      }
      // It parses as a URL, so this one is legal — the guard is on the message
      // for the lines that are not.
      expect(message).toBe("");
      expect(() => parseTargets(`[merchants]\n${"not-a-url ".repeat(40)}`)).toThrow(/…/);
    });
  });

  it("refuses a section it does not know", () => {
    expect(() => parseTargets("[shoppers]\nhttps://store.com", { file: "t.txt" })).toThrow(
      /Unknown section \[shoppers\] in t\.txt/,
    );
  });
});
