// Book generation (brief §12): structure → sections → paginated pages with
// content blocks. Pure planning logic; persistence happens in job handlers.

import type {
  BookStructureDraft, ContentBlockDraft, MediaAsset, PageDraft, SectionDraft,
} from "@/lib/types";
import { archetypeForSinglePhoto } from "./templates";
import { imageTier } from "./format";

export interface PaginationInput {
  structure: BookStructureDraft;
  /** blocks drafted per section index (same order as structure.sections) */
  sectionBlocks: ContentBlockDraft[][];
  /** photo assets keyed by memory id */
  assetsByMemory: Map<string, MediaAsset>;
}

/**
 * Turn a structure + drafted copy into a flat page plan.
 * Each section gets an opener page; photos flow onto photo pages using
 * aspect-ratio-appropriate templates; quotes get quote pages.
 */
export function paginateBook(input: PaginationInput): PageDraft[] {
  const pages: PageDraft[] = [];

  input.structure.sections.forEach((section, sectionIndex) => {
    const blocks = input.sectionBlocks[sectionIndex] ?? [];
    const heading = blocks.find((b) => b.type === "heading");
    const texts = blocks.filter((b) => b.type === "text");
    const quotes = blocks.filter((b) => b.type === "quote");
    const captions = blocks.filter((b) => b.type === "caption");

    if (section.section_type === "opening" || section.section_type === "closing") {
      pages.push({
        template_id: section.section_type === "opening" ? "chapter_opener" : "closing_page",
        section_index: sectionIndex,
        blocks: [
          heading ?? { type: "heading", content: section.title, source_ids: [], ai_generated: false },
          ...texts.slice(0, 1),
        ],
      });
      return;
    }

    if (section.section_type === "little_things") {
      pages.push({
        template_id: "little_things",
        section_index: sectionIndex,
        blocks: [
          heading ?? { type: "heading", content: section.title, source_ids: [], ai_generated: false },
          ...texts,
        ],
      });
      return;
    }

    if (section.section_type === "quotes") {
      // Up to 3 quotes per quote page.
      for (let i = 0; i < quotes.length; i += 3) {
        pages.push({
          template_id: "quote_page",
          section_index: sectionIndex,
          blocks: [
            ...(i === 0 && heading ? [heading] : []),
            ...quotes.slice(i, i + 3),
          ],
        });
      }
      return;
    }

    // Theme / people / ordinary_days / trip: opener, then photo pages.
    pages.push({
      template_id: "chapter_opener",
      section_index: sectionIndex,
      blocks: [
        heading ?? { type: "heading", content: section.title, source_ids: [], ai_generated: false },
        ...texts.slice(0, 1),
      ],
    });

    const photoMemories = section.memory_ids.filter((id) => input.assetsByMemory.has(id));
    const captionByMemory = new Map(
      captions
        .filter((c) => c.source_ids[0]?.kind === "memory")
        .map((c) => [c.source_ids[0].id, c] as const)
    );

    let i = 0;
    while (i < photoMemories.length) {
      const remaining = photoMemories.length - i;
      const asset = input.assetsByMemory.get(photoMemories[i])!;
      if (remaining >= 3 && i % 2 === 1) {
        // Vary pacing: alternate single-photo and multi-photo pages.
        const ids = photoMemories.slice(i, i + 3);
        pages.push({
          template_id: "three_photo_sequence",
          section_index: sectionIndex,
          blocks: ids.map((id) => photoBlock(id)),
        });
        i += 3;
      } else if (remaining === 2) {
        const ids = photoMemories.slice(i, i + 2);
        pages.push({
          template_id: "two_photo_sequence",
          section_index: sectionIndex,
          blocks: ids.map((id) => photoBlock(id)),
        });
        i += 2;
      } else {
        const caption = captionByMemory.get(photoMemories[i]);
        pages.push({
          template_id: archetypeForSinglePhoto(imageTier(asset.width, asset.height), !!caption),
          section_index: sectionIndex,
          blocks: [photoBlock(photoMemories[i]), ...(caption ? [caption] : [])],
        });
        i += 1;
      }
    }
  });

  return padToSpread(pages);
}

function photoBlock(memoryId: string): ContentBlockDraft {
  return {
    type: "photo",
    content: memoryId,
    source_ids: [{ kind: "memory", id: memoryId }],
    ai_generated: false,
  };
}

/** Books print in spreads: pad with blank pages to an even count. */
function padToSpread(pages: PageDraft[]): PageDraft[] {
  if (pages.length % 2 !== 0) {
    pages.push({
      template_id: "quote_page",
      section_index: pages[pages.length - 1]?.section_index ?? 0,
      blocks: [],
    });
  }
  return pages;
}

/** Little-things entries rendered as "label: value" text blocks. */
export function littleThingsBlocks(
  littleThings: { id?: string; category: string; value: string }[]
): ContentBlockDraft[] {
  return littleThings.slice(0, 8).map((lt) => ({
    type: "text" as const,
    content: `${lt.category.replace(/_/g, " ")}: ${lt.value}`,
    source_ids: lt.id ? [{ kind: "little_thing" as const, id: lt.id }] : [],
    ai_generated: false,
  }));
}
