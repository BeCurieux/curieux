import { describe, expect, it } from "vitest";
import { proposeStructure } from "@/lib/book/structure";
import { MockAIProvider } from "@/lib/ai/mock";
import { MAX_QUESTIONS_PER_BOOK } from "@/lib/ai/provider";
import type { Memory, MemoryCluster } from "@/lib/types";

const photo = (id: string, tags: string[] = [], people: string[] = []): Memory => ({
  id,
  child_id: "c1",
  memory_date: "2025-06-01",
  type: "photo",
  raw_text: null,
  transcript: null,
  location: null,
  metadata: {},
  tags,
  people,
});

const cluster = (id: string, title: string, ids: string[]): MemoryCluster => ({
  id,
  child_id: "c1",
  title,
  summary: null,
  start_date: "2025-03-01",
  end_date: "2025-09-01",
  confidence: 0.8,
  status: "confirmed",
  memory_ids: ids,
});

describe("book structure (§12)", () => {
  it("only includes sections with actual material", () => {
    const structure = proposeStructure({
      child: { first_name: "Florence" },
      yearNumber: 2,
      memories: [photo("m1"), photo("m2")],
      clusters: [],
      littleThings: [],
      quotes: [],
    });
    const types = structure.sections.map((s) => s.section_type);
    expect(types).toContain("opening");
    expect(types).toContain("closing");
    expect(types).not.toContain("quotes");
    expect(types).not.toContain("little_things");
    expect(types).not.toContain("people");
  });

  it("adds theme chapters from confirmed clusters, largest first, max 5", () => {
    const clusters = Array.from({ length: 7 }, (_, i) =>
      cluster(`cl${i}`, `Cluster ${i}`, Array.from({ length: 3 + i }, (_, j) => `m${i}-${j}`))
    );
    const structure = proposeStructure({
      child: { first_name: "Florence" },
      yearNumber: 2,
      memories: [],
      clusters,
      littleThings: [],
      quotes: [],
    });
    const themes = structure.sections.filter((s) => s.section_type === "theme");
    expect(themes).toHaveLength(5);
    expect(themes[0].title).toBe("Cluster 6"); // largest
  });

  it("titles the book with the year word", () => {
    const structure = proposeStructure({
      child: { first_name: "Florence" },
      yearNumber: 2,
      memories: [],
      clusters: [],
      littleThings: [],
      quotes: [],
    });
    expect(structure.title).toBe("The Year You Were Two");
  });
});

describe("question engine limit (§10)", () => {
  const bigClusters = Array.from({ length: 10 }, (_, i) =>
    cluster(`cl${i}`, `Theme ${i}`, ["a", "b", "c", "d", "e"])
  );

  it("never exceeds the per-book question budget", async () => {
    const ai = new MockAIProvider();
    const questions = await ai.generateQuestions([], bigClusters, []);
    expect(questions.length).toBeLessThanOrEqual(MAX_QUESTIONS_PER_BOOK);
  });

  it("counts already-asked questions against the budget", async () => {
    const ai = new MockAIProvider();
    const existing = Array.from({ length: 4 }, (_, i) => ({
      child_id: "c1",
      question: `q${i}`,
      reason: "r",
      status: "pending" as const,
    }));
    const questions = await ai.generateQuestions([], bigClusters, existing);
    expect(questions.length).toBeLessThanOrEqual(1);
  });
});

describe("mock clustering (§9)", () => {
  it("clusters memories sharing a tag, needs 3+", async () => {
    const ai = new MockAIProvider();
    const memories = [
      photo("m1", ["swimming"]),
      photo("m2", ["swimming"]),
      photo("m3", ["swimming"]),
      photo("m4", ["beach"]),
    ];
    const clusters = await ai.clusterMemories(memories);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].title).toBe("Swimming");
    expect(clusters[0].memory_ids).toEqual(["m1", "m2", "m3"]);
    expect(clusters[0].status).toBe("suggested");
  });
});
