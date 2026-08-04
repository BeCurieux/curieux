// Book structure generation (brief §12).
// The system proposes sections according to the memories that actually exist —
// it never forces every book into the same chapter structure.

import type {
  BookStructureDraft, Child, LittleThing, Memory, MemoryCluster, SectionDraft,
} from "@/lib/types";

const YEAR_WORDS: Record<number, string> = {
  1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
  6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
};

export function yearWord(year: number): string {
  return YEAR_WORDS[year] ?? String(year);
}

export interface StructureInput {
  child: Pick<Child, "first_name">;
  yearNumber: number;
  memories: Memory[];
  clusters: MemoryCluster[];   // confirmed clusters only
  littleThings: LittleThing[];
  quotes: Memory[];            // memories of type quote
}

/**
 * Deterministic structure proposal. Sections are only included when the
 * underlying material exists. Used directly by the mock AI provider and as
 * the validation baseline for model-proposed structures.
 */
export function proposeStructure(input: StructureInput): BookStructureDraft {
  const { child, yearNumber, memories, clusters, littleThings, quotes } = input;
  const word = yearWord(yearNumber);
  const sections: SectionDraft[] = [];

  sections.push({
    section_type: "opening",
    title: `This was you at ${word.toLowerCase()}`,
    memory_ids: [],
  });

  // "Your people" only if people appear in memories.
  const peopleMemories = memories.filter((m) => (m.people?.length ?? 0) > 0);
  if (peopleMemories.length >= 3) {
    sections.push({
      section_type: "people",
      title: "Your people",
      memory_ids: peopleMemories.slice(0, 12).map((m) => m.id),
    });
  }

  // One theme chapter per confirmed cluster, largest first, max 5.
  const ranked = [...clusters]
    .filter((c) => c.status === "confirmed" && c.memory_ids.length >= 3)
    .sort((a, b) => b.memory_ids.length - a.memory_ids.length)
    .slice(0, 5);
  for (const cluster of ranked) {
    sections.push({
      section_type: "theme",
      title: cluster.title,
      summary: cluster.summary ?? undefined,
      memory_ids: cluster.memory_ids,
    });
  }

  // "Things you said" spread when quotes exist.
  if (quotes.length >= 3) {
    sections.push({
      section_type: "quotes",
      title: "Things you said",
      memory_ids: quotes.map((q) => q.id),
    });
  }

  // "The little things" spread when entries exist.
  if (littleThings.length >= 3) {
    sections.push({
      section_type: "little_things",
      title: "The little things",
      memory_ids: [],
    });
  }

  // Ordinary days: memories not claimed by any cluster.
  const clustered = new Set(ranked.flatMap((c) => c.memory_ids));
  const ordinary = memories.filter(
    (m) => m.type === "photo" && !clustered.has(m.id)
  );
  if (ordinary.length >= 4) {
    sections.push({
      section_type: "ordinary_days",
      title: "Ordinary days",
      memory_ids: ordinary.slice(0, 16).map((m) => m.id),
    });
  }

  sections.push({
    section_type: "closing",
    title: `At the end of ${word.toLowerCase()}`,
    memory_ids: [],
  });

  return {
    title: `The Year You Were ${word}`,
    subtitle: child.first_name,
    sections,
  };
}

/** Book format constraints (brief §17). */
export const BOOK_SPEC = {
  minPages: 48,
  maxPages: 80,
  trimWidthInches: 8.27,
  trimHeightInches: 11.69,
  bleedInches: 0.125,
  safeMarginInches: 0.5,
  minEffectiveDpi: 150, // hard reject below this
  targetEffectiveDpi: 300,
} as const;
