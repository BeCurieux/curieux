import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPEC.md → Non-negotiables: no earnings language in any UI copy, and no
// GST anywhere. Checks the page copy and every page and component. The Hype
// Check's rubric and scorer are excluded: spotting these phrases is their job.

const ROOT = path.resolve(import.meta.dirname, "../..");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full, ext) : ext.test(name) ? [full] : [];
  });
}

const EARNINGS = [
  /\$\s?\d[\d,.]*\s?k?\s*(?:\/|per|a|every)\s*(?:day|week|month|year)/i,
  /\b(?:six|seven|6|7)[- ]figure/i,
  /\bpassive income\b/i,
  /\bmake money\b/i,
  /\bfinancial freedom\b/i,
  /\bquit your job\b/i,
  /\bearn up to\b/i,
  /\bguaranteed (?:income|results|sales|returns)\b/i,
  /\bget rich\b/i,
];

const sources = [
  ...files(path.join(ROOT, "content/pages"), /\.md$/),
  ...files(path.join(ROOT, "src/app"), /\.tsx?$/),
  ...files(path.join(ROOT, "src/components"), /\.tsx?$/),
];

describe("copy", () => {
  it("has no earnings language", () => {
    const hits = sources.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return EARNINGS.filter((re) => re.test(text)).map(
        (re) => `${path.relative(ROOT, file)}: ${re}`,
      );
    });
    expect(hits).toEqual([]);
  });

  it("never mentions GST", () => {
    const hits = sources.filter((file) => /\bGST\b/.test(readFileSync(file, "utf8")));
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("never types a price into page copy", () => {
    const hits = files(path.join(ROOT, "content/pages"), /\.md$/).filter((file) =>
      /(?:A\$|US\$|\$)\s?\d/.test(readFileSync(file, "utf8")),
    );
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
