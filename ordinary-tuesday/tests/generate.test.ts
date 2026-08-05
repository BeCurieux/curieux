import { describe, expect, it } from "vitest";
import { paginateBook, littleThingsBlocks } from "@/lib/book/generate";
import { renderBookHtml } from "@/lib/pdf/html";
import { archetypeForSinglePhoto, compatibleArchetypes } from "@/lib/book/templates";
import { imageTier } from "@/lib/book/format";
import { colourForAge } from "@/lib/book/colours";
import type { BookStructureDraft, MediaAsset } from "@/lib/types";

const asset = (memoryId: string, width = 3000, height = 2000): MediaAsset => ({
  id: `asset-${memoryId}`,
  memory_id: memoryId,
  storage_path: `u/c/${memoryId}.jpg`,
  thumbnail_path: null,
  mime_type: "image/jpeg",
  width,
  height,
  capture_timestamp: null,
  checksum: memoryId,
});

describe("pagination (§12, §16)", () => {
  const structure: BookStructureDraft = {
    title: "The Year You Were Two",
    subtitle: "Florence",
    sections: [
      { section_type: "opening", title: "This was you at two", memory_ids: [] },
      { section_type: "theme", title: "Swimming", memory_ids: ["m1", "m2", "m3", "m4"] },
      { section_type: "closing", title: "At the end of two", memory_ids: [] },
    ],
  };

  it("produces an even page count", () => {
    const pages = paginateBook({
      structure,
      sectionBlocks: [[], [], []],
      assetsByMemory: new Map(["m1", "m2", "m3", "m4"].map((id) => [id, asset(id)])),
    });
    expect(pages.length % 2).toBe(0);
  });

  it("places every clustered photo exactly once", () => {
    const pages = paginateBook({
      structure,
      sectionBlocks: [[], [], []],
      assetsByMemory: new Map(["m1", "m2", "m3", "m4"].map((id) => [id, asset(id)])),
    });
    const photoIds = pages.flatMap((p) => p.blocks.filter((b) => b.type === "photo").map((b) => b.content));
    expect([...photoIds].sort()).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("photo blocks carry provenance to their memory", () => {
    const pages = paginateBook({
      structure,
      sectionBlocks: [[], [], []],
      assetsByMemory: new Map([["m1", asset("m1")]]),
    });
    const photos = pages.flatMap((p) => p.blocks.filter((b) => b.type === "photo"));
    for (const photo of photos) {
      expect(photo.source_ids).toEqual([{ kind: "memory", id: photo.content }]);
    }
  });
});

describe("templates (§15, §16)", () => {
  it("places a photograph at the largest size its pixels honestly support", () => {
    // Good camera file, no story to tell → let it fill the page.
    expect(archetypeForSinglePhoto(imageTier(4000, 3000), false)).toBe("hero_photograph");
    // Same file, with a story → give the story room.
    expect(archetypeForSinglePhoto(imageTier(4000, 3000), true)).toBe("portrait_plus_story");
    // Poor but important photo → small, with white space, carried by words.
    expect(archetypeForSinglePhoto("intimate", true)).toBe("object_portrait");
    // Nothing printable → the page becomes a quote rather than a blur.
    expect(archetypeForSinglePhoto("unprintable", true)).toBe("quote_page");
  });

  it("layout swaps stay within what the image can carry", () => {
    const options = compatibleArchetypes("two_photo_sequence", "editorial");
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((t: { photoSlots: number }) => t.photoSlots === 2)).toBe(true);
  });
});

describe("html rendering", () => {
  it("escapes user content", () => {
    const html = renderBookHtml(
      {
        cover: {
          childName: "Florence", ageWord: "TWO", year: "2028",
          imprint: "Ordinary Tuesday", colour: colourForAge(2), spineWidthMm: 12.8,
        },
        pages: [
          {
            pageNumber: 1,
            archetype: "quote_page" as const,
            blocks: [{ type: "quote" as const, content: `<script>alert("x")</script>` }],
          },
        ],
      },
      "digital"
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders little things as label/value entries", () => {
    const blocks = littleThingsBlocks([
      { id: "lt1", category: "favourite_food", value: "strawberries" },
    ]);
    expect(blocks[0].content).toBe("favourite food: strawberries");
    expect(blocks[0].source_ids).toEqual([{ kind: "little_thing", id: "lt1" }]);
  });
});
