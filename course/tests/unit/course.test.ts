import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canOpen,
  continueAt,
  formatDuration,
  neighbours,
  type OutlineLesson,
  type OutlineModule,
} from "@/lib/course/outline";
import { reaches } from "@/lib/course/tiers";
import { videoEmbedUrl } from "@/lib/course/video";

const lesson = (
  id: string,
  position: number,
  extra: Partial<OutlineLesson> = {},
): OutlineLesson => ({
  id,
  slug: id,
  number: `0.${position}`,
  title: id,
  summary: "",
  min_tier: "free",
  opens_with_benchmark_pack: false,
  video_provider: null,
  duration_sec: null,
  example: false,
  position,
  ...extra,
});

const mod = (
  slug: string,
  position: number,
  lessons: OutlineLesson[],
  hidden = false,
): OutlineModule => ({
  id: slug,
  slug,
  number: position,
  title: slug,
  summary: "",
  hidden,
  position,
  lessons,
});

// Deliberately out of order: sorting is the outline's job.
const outline = [
  mod(
    "library",
    9,
    [
      lesson("bench", 1, { min_tier: "course", opens_with_benchmark_pack: true }),
      lesson("tmpl", 2, { min_tier: "course" }),
    ],
    true,
  ),
  mod("one", 1, [lesson("b", 2, { min_tier: "course" }), lesson("a", 1, { min_tier: "course" })]),
  mod("zero", 0, [lesson("z2", 2), lesson("z1", 1), lesson("z3", 3, { min_tier: "module0" })]),
];

describe("tiers", () => {
  it("orders free < module0 < course < founding", () => {
    expect(reaches("founding", "course")).toBe(true);
    expect(reaches("module0", "course")).toBe(false);
    expect(reaches("free", "free")).toBe(true);
    expect(reaches(null, "free")).toBe(false);
  });

  it("opens library sheets with the benchmark pack alone", () => {
    const [bench, tmpl] = outline[0]!.lessons;
    expect(canOpen(bench!, { tier: "free", benchmarkPack: true })).toBe(true);
    expect(canOpen(tmpl!, { tier: "free", benchmarkPack: true })).toBe(false);
    expect(canOpen(tmpl!, { tier: "course", benchmarkPack: true })).toBe(true);
  });
});

describe("neighbours", () => {
  it("runs through the course in order, across modules", () => {
    expect(neighbours(outline, "z1")).toMatchObject({
      previous: undefined,
      next: { lesson: { id: "z2" } },
    });
    expect(neighbours(outline, "z3")).toMatchObject({
      previous: { lesson: { id: "z2" } },
      next: { lesson: { id: "a" } },
    });
    expect(neighbours(outline, "b").next).toBeUndefined();
  });

  it("keeps the library to itself", () => {
    expect(neighbours(outline, "bench")).toMatchObject({
      previous: undefined,
      next: { lesson: { id: "tmpl" } },
    });
    expect(neighbours(outline, "b").next?.lesson.id).not.toBe("bench");
  });

  it("knows nothing of a missing lesson", () => {
    expect(neighbours(outline, "nope")).toEqual({ previous: undefined, next: undefined });
  });
});

describe("continueAt", () => {
  const free = { tier: "free" as const, benchmarkPack: false };
  it("is her first lesson not yet done that she can open", () => {
    expect(continueAt(outline, new Set(), free)?.lesson.id).toBe("z1");
    expect(continueAt(outline, new Set(["z1"]), free)?.lesson.id).toBe("z2");
    expect(continueAt(outline, new Set(["z1", "z2"]), free)).toBeUndefined();
    expect(
      continueAt(outline, new Set(["z1", "z2"]), { tier: "module0", benchmarkPack: false })?.lesson
        .id,
    ).toBe("z3");
  });
});

describe("formatDuration", () => {
  it("rounds to minutes", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(20)).toBe("1 min");
    expect(formatDuration(510)).toBe("9 min");
    expect(formatDuration(3900)).toBe("1 h 5 min");
  });
});

describe("videoEmbedUrl", () => {
  it("embeds YouTube without cookies", () => {
    expect(videoEmbedUrl("youtube", "abc123", {})).toBe(
      "https://www.youtube-nocookie.com/embed/abc123?rel=0",
    );
  });

  it("needs the Bunny library id", () => {
    expect(videoEmbedUrl("bunny", "guid", {})).toBeNull();
    expect(videoEmbedUrl("bunny", "guid", { bunnyLibraryId: "123" })).toBe(
      "https://iframe.mediadelivery.net/embed/123/guid",
    );
  });

  it("signs Bunny embeds the way Bunny checks them, expiring in six hours", () => {
    const now = Date.UTC(2026, 10, 3);
    const url = new URL(
      videoEmbedUrl("bunny", "guid", { bunnyLibraryId: "123", bunnyTokenKey: "key" }, now)!,
    );
    const expires = now / 1000 + 6 * 60 * 60;
    expect(url.searchParams.get("expires")).toBe(String(expires));
    expect(url.searchParams.get("token")).toBe(
      createHash("sha256").update(`keyguid${expires}`).digest("hex"),
    );
  });
});
