// Book structure generation (brief §12).
// Sections are proposed from the memories that actually exist — never a fixed
// chapter template. Which sections are eligible, and what the book is called,
// come from the subject-type config, so a child's year, a family's year and a
// life story share this generator without special-casing.

import type {
  BookStructureDraft, LittleThing, Memory, MemoryCluster, SectionDraft, Subject,
} from "@/lib/types";
import { allowsSection, configFor, subtitleFor, titleFor, yearWord } from "@/lib/subjects/config";

export { yearWord };

export interface StructureInput {
  subject: Pick<Subject, "display_name" | "subject_type">;
  /** Years of life completed — child books only. */
  yearNumber?: number | null;
  /** Calendar year — family books only. */
  calendarYear?: number | null;
  memories: Memory[];
  clusters: MemoryCluster[];   // confirmed clusters only
  littleThings: LittleThing[];
  quotes: Memory[];            // memories of type quote
}

/**
 * Deterministic structure proposal. Used directly by the mock AI provider and
 * as the validation baseline for model-proposed structures.
 */
export function proposeStructure(input: StructureInput): BookStructureDraft {
  const { subject, memories, clusters, littleThings, quotes } = input;
  const type = subject.subject_type;
  const config = configFor(type);
  const sections: SectionDraft[] = [];

  const push = (section: SectionDraft) => {
    if (allowsSection(type, section.section_type)) sections.push(section);
  };

  push({
    section_type: "opening",
    title: openingTitle(input),
    memory_ids: [],
  });

  // "Your people" only if people actually appear in the memories.
  const peopleMemories = memories.filter((m) => (m.people?.length ?? 0) > 0);
  if (peopleMemories.length >= 3) {
    push({
      section_type: "people",
      title: type === "life" ? "The people in it" : "Your people",
      memory_ids: peopleMemories.slice(0, 12).map((m) => m.id),
    });
  }

  // One chapter per confirmed cluster, largest first, capped at five.
  // A life story calls these eras; a year calls them themes.
  const clusterSection = allowsSection(type, "era") && type === "life" ? "era" : "theme";
  const ranked = [...clusters]
    .filter((c) => c.status === "confirmed" && c.memory_ids.length >= 3)
    .sort((a, b) => b.memory_ids.length - a.memory_ids.length)
    .slice(0, 5);
  for (const cluster of ranked) {
    push({
      section_type: clusterSection as SectionDraft["section_type"],
      title: cluster.title,
      summary: cluster.summary ?? undefined,
      memory_ids: cluster.memory_ids,
    });
  }

  if (quotes.length >= 3) {
    push({
      section_type: "quotes",
      title: type === "life" ? "In their own words" : "Things you said",
      memory_ids: quotes.map((q) => q.id),
    });
  }

  if (littleThings.length >= 3) {
    push({
      section_type: "little_things",
      title: type === "life" ? "The things they always did" : "The little things",
      memory_ids: [],
    });
  }

  // Whatever no chapter claimed.
  const clustered = new Set(ranked.flatMap((c) => c.memory_ids));
  const ordinary = memories.filter((m) => m.type === "photo" && !clustered.has(m.id));
  if (ordinary.length >= 4) {
    push({
      section_type: "ordinary_days",
      title: "Ordinary days",
      memory_ids: ordinary.slice(0, 16).map((m) => m.id),
    });
  }

  push({
    section_type: "closing",
    title: closingTitle(input),
    memory_ids: [],
  });

  return {
    title: titleFor(type, {
      displayName: subject.display_name,
      yearNumber: input.yearNumber,
      calendarYear: input.calendarYear,
    }),
    subtitle: subtitleFor(type, {
      displayName: subject.display_name,
      yearNumber: input.yearNumber,
      calendarYear: input.calendarYear,
    }) ?? undefined,
    sections,
  };
}

function openingTitle(input: StructureInput): string {
  switch (input.subject.subject_type) {
    case "child":
      return `This was you at ${yearWord(input.yearNumber ?? 1).toLowerCase()}`;
    case "family":
      return "This was us";
    case "life":
      return `This was ${input.subject.display_name}`;
  }
}

function closingTitle(input: StructureInput): string {
  switch (input.subject.subject_type) {
    case "child":
      return `At the end of ${yearWord(input.yearNumber ?? 1).toLowerCase()}`;
    case "family":
      return "At the end of the year";
    case "life":
      return "And then";
  }
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
