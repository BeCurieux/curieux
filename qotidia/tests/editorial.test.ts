import { describe, expect, it } from "vitest";
import { enforceEditorial, lintCopy } from "@/lib/editorial";

describe("editorial rules (§13)", () => {
  it("rejects banned sentimental phrases", () => {
    const verdict = lintCopy("It was a magical year filled with adventure and love.");
    expect(verdict.ok).toBe(false);
    expect(verdict.violations.length).toBeGreaterThan(0);
  });

  it("accepts specific, restrained copy", () => {
    const verdict = lintCopy(
      "For three months, you refused to leave the house without the yellow boots.",
      { supported: true }
    );
    expect(verdict.ok).toBe(true);
  });

  it("rejects unsupported emotional claims", () => {
    const verdict = lintCopy("Florence loved her first swimming lesson.");
    expect(verdict.ok).toBe(false);
    expect(verdict.violations.join(" ")).toMatch(/unsupported claim/);
  });

  it("allows emotional claims when parent-supported", () => {
    const verdict = lintCopy("You loved the beach that week — you said so every morning.", {
      supported: true,
    });
    expect(verdict.ok).toBe(true);
  });

  it("rejects unsupported 'first' claims (§29)", () => {
    expect(lintCopy("This was your first haircut.").ok).toBe(false);
    expect(lintCopy("This was your first haircut.", { supported: true }).ok).toBe(true);
  });

  it("drops violating AI blocks but never parent copy", () => {
    const blocks = [
      { content: "A magical journey of growth.", ai_generated: true },
      { content: "A magical journey of growth.", ai_generated: false },
      { content: "Bun Bun came everywhere.", ai_generated: true },
    ];
    const { kept, dropped } = enforceEditorial(blocks, () => true);
    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].block.ai_generated).toBe(true);
  });
});
