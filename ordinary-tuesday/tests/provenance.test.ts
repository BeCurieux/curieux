import { describe, expect, it } from "vitest";
import { enforceProvenance, validateBlock, validateSourcesExist } from "@/lib/book/provenance";
import type { ContentBlockDraft } from "@/lib/types";

const cited = (content: string): ContentBlockDraft => ({
  type: "text",
  content,
  source_ids: [{ kind: "memory", id: "m1" }],
  ai_generated: true,
});

describe("provenance (§14)", () => {
  it("requires sources on AI factual text", () => {
    const block: ContentBlockDraft = {
      type: "text",
      content: "For most of winter, Bun Bun came everywhere.",
      source_ids: [],
      ai_generated: true,
    };
    expect(validateBlock(block).ok).toBe(false);
  });

  it("accepts AI factual text with sources", () => {
    expect(validateBlock(cited("For most of winter, Bun Bun came everywhere.")).ok).toBe(true);
  });

  it("does not require sources on parent-authored text", () => {
    const block: ContentBlockDraft = {
      type: "text",
      content: "Written by mum.",
      source_ids: [],
      ai_generated: false,
    };
    expect(validateBlock(block).ok).toBe(true);
  });

  it("does not require sources on AI headings", () => {
    const block: ContentBlockDraft = {
      type: "heading",
      content: "Your people",
      source_ids: [],
      ai_generated: true,
    };
    expect(validateBlock(block).ok).toBe(true);
  });

  it("rejects hallucinated source ids", () => {
    const verdict = validateSourcesExist(cited("x"), new Set(["other-id"]));
    expect(verdict.ok).toBe(false);
  });

  it("enforceProvenance omits invalid blocks rather than repairing them", () => {
    const known = new Set(["m1"]);
    const blocks: ContentBlockDraft[] = [
      cited("supported statement"),
      { type: "text", content: "unsupported statement", source_ids: [], ai_generated: true },
      {
        type: "caption",
        content: "hallucinated source",
        source_ids: [{ kind: "memory", id: "nope" }],
        ai_generated: true,
      },
    ];
    const { kept, rejected } = enforceProvenance(blocks, known);
    expect(kept.map((b) => b.content)).toEqual(["supported statement"]);
    expect(rejected).toHaveLength(2);
  });
});
