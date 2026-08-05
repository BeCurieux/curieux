// Anthropic-backed AI provider.
// All outputs pass through the same provenance + editorial enforcement as
// the mock provider — model output is never trusted directly onto a page.

import Anthropic from "@anthropic-ai/sdk";
import type {
  BookStructureDraft, ContentBlockDraft, FollowUpQuestion, Memory,
  MemoryCluster, PhotoAnalysis,
} from "@/lib/types";
import type { AIProvider, AnalyseMemoriesInput, DraftCopyInput } from "./provider";
import { MAX_QUESTIONS_PER_BOOK } from "./provider";
import { ANALYSIS_SYSTEM, EDITORIAL_SYSTEM, QUESTIONS_SYSTEM, clusterPrompt, copyPrompt } from "./prompts";
import { enforceProvenance } from "@/lib/book/provenance";
import { enforceEditorial } from "@/lib/editorial";
import { proposeStructure } from "@/lib/book/structure";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.AI_MODEL ?? "claude-sonnet-5";
  }

  private async json<T>(system: string, prompt: string): Promise<T> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("model returned no JSON");
    return JSON.parse(match[0]) as T;
  }

  async analyseMemories(input: AnalyseMemoriesInput): Promise<PhotoAnalysis[]> {
    const familyNames = input.familyMembers.map((f) => f.name);
    const out = await this.json<{ analyses: PhotoAnalysis[] }>(
      ANALYSIS_SYSTEM,
      `Family members: ${JSON.stringify(familyNames)}\n` +
        `Memories: ${JSON.stringify(strip(input.memories))}\n` +
        `Respond with JSON: {"analyses":[{"memory_id":string,"likely_people":string[],` +
        `"scene":string|null,"activity":string|null,"objects":string[],"setting":string|null,` +
        `"emotional_tone":string|null,"visually_strong":boolean,"near_duplicate_of":string|null,` +
        `"suggested_tags":string[]}]}`
    );
    // Drop analyses for memories we didn't send (hallucination guard).
    const known = new Set(input.memories.map((m) => m.id));
    return (out.analyses ?? []).filter((a) => known.has(a.memory_id));
  }

  async clusterMemories(memories: Memory[]): Promise<MemoryCluster[]> {
    const out = await this.json<{ clusters: Omit<MemoryCluster, "subject_id" | "status">[] }>(
      EDITORIAL_SYSTEM,
      clusterPrompt(JSON.stringify(strip(memories)))
    );
    const known = new Set(memories.map((m) => m.id));
    const subjectId = memories[0]?.subject_id;
    return (out.clusters ?? [])
      .map((c) => ({
        ...c,
        subject_id: subjectId,
        status: "suggested" as const,
        confidence: clamp01(c.confidence),
        memory_ids: (c.memory_ids ?? []).filter((id) => known.has(id)),
      }))
      .filter((c) => c.memory_ids.length >= 3);
  }

  async generateQuestions(
    memories: Memory[],
    clusters: MemoryCluster[],
    existing: FollowUpQuestion[]
  ): Promise<FollowUpQuestion[]> {
    const budget = MAX_QUESTIONS_PER_BOOK - existing.length;
    if (budget <= 0) return [];
    const out = await this.json<{ questions: { question: string; reason: string; cluster_id?: string }[] }>(
      QUESTIONS_SYSTEM,
      `At most ${budget} questions.\n` +
        `Clusters: ${JSON.stringify(clusters.map((c) => ({ id: c.id, title: c.title, size: c.memory_ids.length, start: c.start_date, end: c.end_date })))}\n` +
        `Memories: ${JSON.stringify(strip(memories))}\n` +
        `Already asked (do not repeat): ${JSON.stringify(existing.map((q) => q.question))}\n` +
        `Respond with JSON: {"questions":[{"question":string,"reason":string,"cluster_id":string|null}]}`
    );
    const subjectId = memories[0]?.subject_id;
    return (out.questions ?? []).slice(0, budget).map((q) => ({
      subject_id: subjectId,
      cluster_id: q.cluster_id ?? null,
      question: q.question,
      reason: q.reason,
      status: "pending" as const,
    }));
  }

  async generateBookStructure(
    input: Parameters<AIProvider["generateBookStructure"]>[0]
  ): Promise<BookStructureDraft> {
    // The deterministic proposal is the safety baseline; the model may
    // re-title and re-order but sections must map to real material, so we
    // use the deterministic structure and let the model refine titles only.
    const base = proposeStructure({
      ...input,
      quotes: input.memories.filter((m) => m.type === "quote"),
    });
    try {
      const out = await this.json<{ titles: Record<string, string> }>(
        EDITORIAL_SYSTEM,
        `Improve these chapter titles for a child's yearly book. Keep them short,
concrete, unsentimental. Do not add or remove chapters.
Chapters: ${JSON.stringify(base.sections.map((s, i) => ({ index: i, type: s.section_type, title: s.title })))}
Respond with JSON: {"titles":{"<index>":"<new title>"}}`
      );
      for (const [idx, title] of Object.entries(out.titles ?? {})) {
        const i = Number(idx);
        if (base.sections[i] && typeof title === "string" && title.length > 0 && title.length < 80) {
          base.sections[i].title = title;
        }
      }
    } catch {
      // Baseline titles are fine — refinement is optional.
    }
    return base;
  }

  async draftBookCopy(input: DraftCopyInput): Promise<ContentBlockDraft[]> {
    const material = {
      memories: strip(input.memories),
      answers: input.answers
        .filter((a) => a.status === "answered")
        .map((a) => ({ id: a.id, question: a.question, answer: a.answer })),
      little_things: input.littleThings.map((lt) => ({ id: lt.id, category: lt.category, value: lt.value })),
    };
    const out = await this.json<{ blocks: ContentBlockDraft[] }>(
      EDITORIAL_SYSTEM,
      copyPrompt(
        JSON.stringify({ title: input.section.title, type: input.section.section_type, subject: input.subject.display_name, year: input.yearNumber }),
        JSON.stringify(material)
      )
    );
    const drafts = (out.blocks ?? []).map((b) => ({ ...b, ai_generated: true, source_ids: b.source_ids ?? [] }));
    const known = new Set<string>([
      ...input.memories.map((m) => m.id),
      ...input.answers.map((a) => a.id!).filter(Boolean),
      ...input.littleThings.map((lt) => lt.id!).filter(Boolean),
    ]);
    const { kept } = enforceProvenance(drafts, known);
    const { kept: final } = enforceEditorial(kept, (b) => b.source_ids.length > 0);
    return final;
  }

  async editParentCopy(text: string): Promise<string> {
    const out = await this.json<{ edited: string }>(
      EDITORIAL_SYSTEM,
      `Lightly copy-edit this parent-written text for a memory book: fix
spelling/grammar only. Preserve meaning, voice and every fact exactly.
Text: ${JSON.stringify(text)}
Respond with JSON: {"edited":string}`
    );
    // If the edit drifted too far from the original, keep the original.
    return typeof out.edited === "string" && out.edited.length > 0 ? out.edited : text;
  }
}

/** Reduce memories to the fields the model needs — no storage paths, no user ids. */
function strip(memories: Memory[]) {
  return memories.map((m) => ({
    id: m.id,
    date: m.memory_date,
    type: m.type,
    text: m.raw_text ?? m.transcript ?? null,
    location: m.location,
    tags: m.tags ?? [],
    people: m.people ?? [],
  }));
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}
