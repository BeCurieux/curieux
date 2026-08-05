// Deterministic mock AI provider.
// Used in development, tests and demos so the full product can run without
// any model calls or real child data. Behaviour mirrors the contract the
// real provider must satisfy — including provenance and question limits.

import type {
  BookStructureDraft, ContentBlockDraft, FollowUpQuestion, Memory,
  MemoryCluster, PhotoAnalysis,
} from "@/lib/types";
import type { AIProvider, AnalyseMemoriesInput, DraftCopyInput } from "./provider";
import { MAX_QUESTIONS_PER_BOOK } from "./provider";
import { proposeStructure } from "@/lib/book/structure";
import { enforceProvenance } from "@/lib/book/provenance";
import { enforceEditorial } from "@/lib/editorial";

export class MockAIProvider implements AIProvider {
  async analyseMemories(input: AnalyseMemoriesInput): Promise<PhotoAnalysis[]> {
    return input.memories.map((m) => ({
      memory_id: m.id,
      likely_people: m.people ?? [],
      scene: m.location ?? null,
      activity: (m.tags ?? [])[0] ?? null,
      objects: [],
      setting: m.location ? "outdoors" : null,
      emotional_tone: null,
      visually_strong: true,
      near_duplicate_of: null,
      suggested_tags: m.tags ?? [],
    }));
  }

  async clusterMemories(memories: Memory[]): Promise<MemoryCluster[]> {
    // Group by shared tag; a cluster needs 3+ memories to be worth suggesting.
    const byTag = new Map<string, Memory[]>();
    for (const m of memories) {
      for (const tag of m.tags ?? []) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push(m);
      }
    }
    const clusters: MemoryCluster[] = [];
    for (const [tag, members] of byTag) {
      if (members.length < 3) continue;
      const dates = members
        .map((m) => m.memory_date)
        .filter((d): d is string => !!d)
        .sort();
      clusters.push({
        subject_id: members[0].subject_id,
        title: titleCase(tag.replace(/_/g, " ")),
        summary: null,
        start_date: dates[0] ?? null,
        end_date: dates[dates.length - 1] ?? null,
        confidence: Math.min(0.95, 0.4 + members.length * 0.05),
        status: "suggested",
        memory_ids: members.map((m) => m.id),
      });
    }
    return clusters.sort((a, b) => b.memory_ids.length - a.memory_ids.length);
  }

  async generateQuestions(
    memories: Memory[],
    clusters: MemoryCluster[],
    existing: FollowUpQuestion[]
  ): Promise<FollowUpQuestion[]> {
    const budget = MAX_QUESTIONS_PER_BOOK - existing.length;
    if (budget <= 0) return [];
    const questions: FollowUpQuestion[] = [];
    for (const cluster of clusters) {
      if (questions.length >= budget) break;
      if (cluster.memory_ids.length < 4) continue;
      const span = cluster.start_date && cluster.end_date && cluster.start_date !== cluster.end_date;
      questions.push({
        subject_id: cluster.subject_id,
        cluster_id: cluster.id ?? null,
        question: span
          ? `"${cluster.title}" shows up from ${cluster.start_date} to ${cluster.end_date}. Did anything change about it over the year?`
          : `"${cluster.title}" appears in ${cluster.memory_ids.length} photos. Is there a story behind it?`,
        reason: `Cluster "${cluster.title}" is prominent but the photos alone can't explain it.`,
        status: "pending",
      });
    }
    return questions.slice(0, budget);
  }

  async generateBookStructure(input: Parameters<AIProvider["generateBookStructure"]>[0]): Promise<BookStructureDraft> {
    return proposeStructure({
      ...input,
      quotes: input.memories.filter((m) => m.type === "quote"),
    });
  }

  async draftBookCopy(input: DraftCopyInput): Promise<ContentBlockDraft[]> {
    const drafts: ContentBlockDraft[] = [];
    const { section, memories, answers } = input;

    drafts.push({
      type: "heading",
      content: section.title,
      source_ids: [],
      ai_generated: true,
    });

    // Factual copy is only ever assembled from parent-supplied text.
    for (const m of memories.slice(0, 6)) {
      if (m.type === "quote" && m.raw_text) {
        drafts.push({
          type: "quote",
          content: m.raw_text,
          source_ids: [{ kind: "memory", id: m.id }],
          ai_generated: true,
        });
      } else if (m.raw_text) {
        drafts.push({
          type: "caption",
          content: m.raw_text,
          source_ids: [{ kind: "memory", id: m.id }],
          ai_generated: true,
        });
      }
    }
    for (const a of answers.filter((a) => a.status === "answered" && a.answer)) {
      drafts.push({
        type: "text",
        content: a.answer!,
        source_ids: [{ kind: "answer", id: a.id! }],
        ai_generated: true,
      });
    }

    // Same enforcement pipeline as the real provider.
    const known = new Set<string>([
      ...memories.map((m) => m.id),
      ...answers.map((a) => a.id!).filter(Boolean),
      ...input.littleThings.map((lt) => lt.id!).filter(Boolean),
    ]);
    const { kept } = enforceProvenance(drafts, known);
    const { kept: final } = enforceEditorial(kept, (b) => b.source_ids.length > 0);
    return final;
  }

  async editParentCopy(text: string): Promise<string> {
    return text.trim().replace(/\s+/g, " ");
  }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
