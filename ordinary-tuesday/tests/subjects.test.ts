// The same engine, three product lines (child / family / life).
// These tests pin the behaviour that must differ between them, and the
// behaviour that must not.

import { describe, expect, it } from "vitest";
import {
  SUBJECT_TYPES, allowsSection, configFor, subtitleFor, titleFor,
} from "@/lib/subjects/config";
import { proposeStructure } from "@/lib/book/structure";
import type { LittleThing, Memory, MemoryCluster, SubjectType } from "@/lib/types";

const photo = (id: string, people: string[] = []): Memory => ({
  id, subject_id: "s1", memory_date: "2025-06-01", type: "photo",
  raw_text: null, transcript: null, location: null, metadata: {}, tags: [], people,
});

const quote = (id: string): Memory => ({ ...photo(id), type: "quote", raw_text: "said something" });

const cluster = (id: string, title: string, n: number): MemoryCluster => ({
  id, subject_id: "s1", title, summary: null,
  start_date: "2025-01-01", end_date: "2025-12-01",
  confidence: 0.8, status: "confirmed",
  memory_ids: Array.from({ length: n }, (_, i) => `${id}-m${i}`),
});

const littleThing = (i: number): LittleThing => ({
  subject_id: "s1", recorded_date: "2025-06-01", category: "saying", value: `v${i}`,
});

describe("subject type config", () => {
  const types: SubjectType[] = ["child", "family", "life"];

  it("defines every type", () => {
    for (const t of types) expect(configFor(t).type).toBe(t);
    expect(Object.keys(SUBJECT_TYPES).sort()).toEqual(["child", "family", "life"]);
  });

  it("rejects unknown types", () => {
    expect(() => configFor("wedding" as SubjectType)).toThrow(/unknown subject type/);
  });

  it("gives each type its own little-things vocabulary", () => {
    const child = configFor("child").littleThingCategories.map((c) => c.value);
    const life = configFor("life").littleThingCategories.map((c) => c.value);
    expect(child).toContain("comfort_object");
    expect(life).toContain("recipe");
    // No accidental sharing — a life story should not ask for a bedtime demand.
    expect(life).not.toContain("bedtime_ritual");
  });

  it("only a life story may use era chapters", () => {
    expect(allowsSection("life", "era")).toBe(true);
    expect(allowsSection("child", "era")).toBe(false);
    expect(allowsSection("family", "era")).toBe(false);
  });

  it("keeps the shared sections available to every type", () => {
    for (const t of types) {
      expect(allowsSection(t, "opening")).toBe(true);
      expect(allowsSection(t, "closing")).toBe(true);
      expect(allowsSection(t, "quotes")).toBe(true);
      expect(allowsSection(t, "little_things")).toBe(true);
    }
  });
});

describe("book titling", () => {
  it("names a child's book by their age", () => {
    expect(titleFor("child", { displayName: "Florence", yearNumber: 2 })).toBe("The Year You Were Two");
    expect(subtitleFor("child", { displayName: "Florence", yearNumber: 2 })).toBe("Florence");
  });

  it("names a family's book by the calendar year", () => {
    expect(titleFor("family", { displayName: "The Rosens", calendarYear: 2027 })).toBe("Our Year, 2027");
  });

  it("names a life story after the person, with no subtitle", () => {
    expect(titleFor("life", { displayName: "Margaret" })).toBe("The Life of Margaret");
    expect(subtitleFor("life", { displayName: "Margaret" })).toBeNull();
  });
});

describe("structure generation across types", () => {
  const material = {
    memories: [photo("m1", ["Mum"]), photo("m2", ["Dad"]), photo("m3", ["Gran"]), photo("m4"), photo("m5"), photo("m6"), photo("m7")],
    clusters: [cluster("c1", "Swimming", 6), cluster("c2", "Yellow boots", 4)],
    littleThings: [littleThing(1), littleThing(2), littleThing(3)],
    quotes: [quote("q1"), quote("q2"), quote("q3")],
  };

  it("a child's clusters become themes", () => {
    const s = proposeStructure({
      subject: { display_name: "Florence", subject_type: "child" }, yearNumber: 2, ...material,
    });
    expect(s.sections.filter((x) => x.section_type === "theme").length).toBe(2);
    expect(s.sections.some((x) => x.section_type === "era")).toBe(false);
    expect(s.sections[0].title).toBe("This was you at two");
  });

  it("a life story's clusters become eras", () => {
    const s = proposeStructure({
      subject: { display_name: "Margaret", subject_type: "life" }, ...material,
    });
    expect(s.sections.filter((x) => x.section_type === "era").length).toBe(2);
    expect(s.sections.some((x) => x.section_type === "theme")).toBe(false);
    expect(s.sections[0].title).toBe("This was Margaret");
  });

  it("adapts section titles to the subject, not just the chapter list", () => {
    const life = proposeStructure({
      subject: { display_name: "Margaret", subject_type: "life" }, ...material,
    });
    const child = proposeStructure({
      subject: { display_name: "Florence", subject_type: "child" }, yearNumber: 2, ...material,
    });
    expect(life.sections.find((s) => s.section_type === "quotes")?.title).toBe("In their own words");
    expect(child.sections.find((s) => s.section_type === "quotes")?.title).toBe("Things you said");
  });

  it("writes a family book in the first person plural", () => {
    const s = proposeStructure({
      subject: { display_name: "The Rosens", subject_type: "family" }, calendarYear: 2027, ...material,
    });
    expect(s.title).toBe("Our Year, 2027");
    expect(s.sections[0].title).toBe("This was us");
    expect(s.sections[s.sections.length - 1].title).toBe("At the end of the year");
  });

  it("still omits sections with no material, whatever the type", () => {
    const bare = { memories: [], clusters: [], littleThings: [], quotes: [] };
    for (const subject_type of ["child", "family", "life"] as SubjectType[]) {
      const s = proposeStructure({
        subject: { display_name: "X", subject_type }, yearNumber: 1, ...bare,
      });
      const types = s.sections.map((x) => x.section_type);
      expect(types).toEqual(["opening", "closing"]);
    }
  });
});
