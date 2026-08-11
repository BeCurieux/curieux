import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("what a parent actually approved", () => {
  // The approval record exists to answer one question in a dispute: is the
  // book that arrived the book that was approved? The pdf_checksum column is
  // the entire answer, and it was being filled at approval time with
  // sha256(bookId + timestamp) — computed before the file existed, never
  // replaced, and indistinguishable at a glance from a real digest.

  const actions = readFileSync(join(__dirname, "..", "src/app/actions.ts"), "utf8");
  const handlers = readFileSync(join(__dirname, "..", "src/lib/jobs/handlers.ts"), "utf8");

  it("does not fabricate a checksum before the file exists", () => {
    const approval = actions.slice(actions.indexOf("book_approvals"));
    expect(approval).not.toMatch(/pdf_checksum:\s*sha256\(/);
  });

  it("records the checksum of the bytes that were actually rendered", () => {
    expect(handlers).toMatch(/pdf_checksum:\s*sha256\(bytes\)/);
  });

  it("writes it against the approval the print belongs to", () => {
    const region = handlers.slice(handlers.indexOf("pdf_checksum: sha256(bytes)") - 800);
    expect(region).toContain('from("book_approvals")');
    expect(region).toContain('.eq("book_id", bookId)');
  });
});
