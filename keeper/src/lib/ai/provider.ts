// Provider-agnostic AI adapter (brief §3).
// Business logic depends only on this interface — never on a model vendor.
// Every provider's output passes through the same enforcement pipeline:
// provenance (src/lib/book/provenance.ts) and editorial rules (src/lib/editorial.ts).

import type {
  BookStructureDraft, Child, ContentBlockDraft, FamilyMember, FollowUpQuestion,
  LittleThing, Memory, MemoryCluster, PhotoAnalysis, SectionDraft,
} from "@/lib/types";

export interface AnalyseMemoriesInput {
  memories: Memory[];
  familyMembers: FamilyMember[];
  /** data-URL or signed-URL thumbnails keyed by memory id (optional in dev) */
  thumbnails?: Record<string, string>;
}

export interface DraftCopyInput {
  child: Pick<Child, "first_name" | "pronouns">;
  yearNumber: number;
  section: SectionDraft;
  memories: Memory[];              // the section's source memories, full detail
  answers: FollowUpQuestion[];     // answered questions relevant to this child
  littleThings: LittleThing[];
}

export interface AIProvider {
  /** Editorial photo/memory analysis. Facts only; never invented memories (§8). */
  analyseMemories(input: AnalyseMemoriesInput): Promise<PhotoAnalysis[]>;

  /** Group related memories into suggested clusters (§9). */
  clusterMemories(memories: Memory[]): Promise<MemoryCluster[]>;

  /** Smart question engine (§10): max 5 high-value, gap-filling questions. */
  generateQuestions(
    memories: Memory[],
    clusters: MemoryCluster[],
    existing: FollowUpQuestion[]
  ): Promise<FollowUpQuestion[]>;

  /** Propose a book structure from actual available material (§12). */
  generateBookStructure(input: {
    child: Pick<Child, "first_name">;
    yearNumber: number;
    memories: Memory[];
    clusters: MemoryCluster[];
    littleThings: LittleThing[];
  }): Promise<BookStructureDraft>;

  /** Draft captions/narrative blocks for one section, with provenance. */
  draftBookCopy(input: DraftCopyInput): Promise<ContentBlockDraft[]>;

  /** Light copy-edit of parent-written text. Meaning must be preserved. */
  editParentCopy(text: string): Promise<string>;
}

export const MAX_QUESTIONS_PER_BOOK = 5;

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const name = process.env.AI_PROVIDER ?? "mock";
  if (name === "anthropic") {
    // Lazy import keeps the SDK out of client bundles and mock-only deploys.
    const { AnthropicProvider } = require("./anthropic") as typeof import("./anthropic");
    cached = new AnthropicProvider();
  } else {
    const { MockAIProvider } = require("./mock") as typeof import("./mock");
    cached = new MockAIProvider();
  }
  return cached;
}

/** Test seam. */
export function setAIProvider(provider: AIProvider | null): void {
  cached = provider;
}
