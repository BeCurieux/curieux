import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { CONTACT, COUNTRIES, OPPORTUNITIES, SKILLS, TECH } from "@/lib/fit/data";
import {
  calculate,
  gates,
  plan,
  preference,
  risks,
  scoreAll,
  top3,
  whyFits,
} from "@/lib/fit/engine";
import { QUESTIONS, type Answers } from "@/lib/fit/questions";
import { RULES } from "@/lib/fit/rules";

// The port must behave exactly like the engine shipped in Income Fit Test
// v1.4. The reference is the shipped JavaScript, run as-is.
const ref = createRequire(import.meta.url)("../fixtures/fit-reference.cjs") as {
  scoreAll: (
    opts: unknown[],
    a: unknown,
  ) => {
    o: { id: number };
    key: number;
    total: number;
    band: string;
    why: string[];
    strengths: string[];
    weak: string[];
    cap: number;
    sym: string;
    life: number;
    ready: number;
    comm: number;
  }[];
  top3: (scored: unknown[]) => { o: { id: number } }[];
  OPTS: unknown[];
};

// Deterministic pseudo-random answers, so failures reproduce.
function rng(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
}
const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;

function answers(r: () => number): Answers {
  return {
    country: pick(
      r,
      COUNTRIES.map((c) => c[0]),
    ),
    hours: 1 + Math.floor(r() * 40),
    block: 1 + Math.floor(r() * 4),
    evenings: pick(r, ["Yes", "No"] as const),
    priority: pick(r, ["Money soon", "Flexibility", "Building something over time"] as const),
    soon: pick(r, ["Yes", "No"] as const),
    budget: pick(r, [0, 0, 50, 100, 150, 250, 400, 1000, 5000]),
    car: pick(r, ["Yes", "No"] as const),
    space: pick(r, ["Yes", "No"] as const),
    checks: pick(r, ["Yes", "No"] as const),
    contact: pick(r, CONTACT),
    psa: pick(r, ["Products", "Services", "Either"] as const),
    rp: pick(r, ["Recurring", "Project", "Either"] as const),
    tech: pick(r, TECH),
    skill1: pick(r, SKILLS),
    skill2: pick(r, [...SKILLS, ""] as const),
    remote: pick(r, ["Yes", "No"] as const),
    camera: pick(r, ["Yes", "No"] as const),
    minrate: pick(r, [15, 25, 40, 80]),
    name: "",
  };
}

// The reference scores the data embedded in the shipped report, so this
// also proves content/fit/opportunities.json maps onto it exactly.
const refOpts = ref.OPTS;

describe("Fit Finder engine", () => {
  it("has the 23 researched opportunities and 20 questions", () => {
    expect(OPPORTUNITIES).toHaveLength(23);
    expect(new Set(OPPORTUNITIES.map((o) => o.id)).size).toBe(23);
    expect(QUESTIONS).toHaveLength(20);
    expect(OPPORTUNITIES.filter((o) => o.camera === "Yes").map((o) => o.id)).toEqual([1, 2, 13]);
  });

  it("scores exactly like the shipped v1.4 engine on 5,000 answer sets", () => {
    const r = rng(42);
    for (let n = 0; n < 5000; n += 1) {
      const a = answers(r);
      const mine = scoreAll(a);
      const theirs = ref.scoreAll(refOpts, { ...a, block: +a.block });
      expect(
        mine.map((s) => [
          s.o.id,
          s.total,
          s.life,
          s.ready,
          s.comm,
          s.key,
          s.band,
          s.cap,
          s.sym,
          s.why,
          s.strengths,
          s.weak,
        ]),
      ).toEqual(
        theirs.map((s) => [
          s.o.id,
          s.total,
          s.life,
          s.ready,
          s.comm,
          s.key,
          s.band,
          s.cap,
          s.sym,
          s.why,
          s.strengths,
          s.weak,
        ]),
      );
      // With no stated preference the order is the shipped one. With one,
      // only ideas of equal fit may swap places.
      if (a.psa === "Either" && a.rp === "Either")
        expect(top3(mine).map((s) => s.o.id)).toEqual(ref.top3(theirs).map((s) => s.o.id));
      const fit = (xs: { key: number }[]) => xs.map((s) => Math.floor(s.key));
      expect(fit(top3(mine))).toEqual(fit(ref.top3(theirs) as unknown as { key: number }[]));
    }
  });

  it("breaks ties on products/services and recurring/one-off, never changing a score", () => {
    const r = rng(9);
    let reordered = 0;
    for (let n = 0; n < 2000; n += 1) {
      const a = answers(r);
      const neutral = scoreAll({ ...a, psa: "Either", rp: "Either" });
      const stated = scoreAll(a);
      expect(stated.map((s) => [s.total, s.key, s.band])).toEqual(
        neutral.map((s) => [s.total, s.key, s.band]),
      );
      const t = top3(stated);
      for (let k = 1; k < t.length; k += 1) {
        const [x, y] = [t[k - 1]!, t[k]!];
        if (Math.floor(x.key) === Math.floor(y.key)) expect(x.pref).toBeGreaterThanOrEqual(y.pref);
      }
      if (
        t.map((s) => s.o.id).join() !==
        top3(neutral)
          .map((s) => s.o.id)
          .join()
      )
        reordered += 1;
    }
    expect(reordered).toBeGreaterThan(0);
    const tutor = OPPORTUNITIES.find((o) => o.id === 1)!; // Service, Recurring
    expect(preference(tutor, { psa: "Services", rp: "Recurring" })).toBe(2);
    expect(preference(tutor, { psa: "Products", rp: "Project" })).toBe(0);
    expect(preference(tutor, { psa: "Either", rp: "Either" })).toBe(0);
  });

  it("labels every market figure and dates each idea's research", () => {
    expect(OPPORTUNITIES.find((o) => o.id === 10)!.who).toContain("July 2026 (FACT)");
    expect(OPPORTUNITIES.find((o) => o.id === 22)!.verify).toContain("AU$0.25/word (FACT)");
    for (const o of OPPORTUNITIES) expect(o.checked).toMatch(/^1[67] October 2026$/);
  });

  it("explains a recommendation in the report's words", () => {
    const a: Answers = {
      ...answers(rng(1)),
      country: "Australia",
      hours: 10,
      block: 2,
      evenings: "No",
      priority: "Building something over time",
      soon: "No",
      budget: 500,
      car: "No",
      space: "No",
      checks: "Yes",
      contact: "Messaging only",
      tech: "High",
      skill1: "Creative",
      skill2: "Writing",
      remote: "Yes",
      camera: "No",
      minrate: 30,
    };
    const [first] = top3(scoreAll(a));
    expect(first).toBeDefined();
    expect(whyFits(first!, a).length).toBeGreaterThan(0);
    expect(risks(first!, a).at(-1)).toMatch(/^Main reason it fails: /);
    expect(plan(first!, a).map((d) => d.d)).toEqual([1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(gates(first!, a).go[2]).toContain("A$30/hr");
  });

  it("calculator: nothing until price and hours are in, then the report's maths", () => {
    const a: Answers = { ...answers(rng(2)), country: "Australia", hours: 10, minrate: 30 };
    const s = scoreAll(a).find((x) => x.o.id === 1)!;
    expect(calculate(s, a, { price: 0, hrs: 1, cost: 0, fixed: 0, start: 150 })).toBeNull();
    // 10 hrs/week = 43.33 hrs/month; 1.5 hrs per session → capacity 28.88.
    const c = calculate(s, a, { price: 60, hrs: 1.5, cost: 5, fixed: 20, start: 150 })!;
    expect(c.margin).toBe(55);
    expect(c.breakEven).toBe(3);
    expect(c.capacity).toBe(28);
    expect(c.scenarios.map((x) => x.n)).toEqual([7, 14, 28]);
    expect(c.scenarios[1]!.p).toBe(14 * 55 - 20);
    expect(c.scenarios[1]!.h).toBeCloseTo((14 * 55 - 20) / ((10 * 52) / 12));
    expect(c.signal).toBe("only-full"); // ~A$17/hr at half busy, ~A$35 full
    expect(calculate(s, a, { price: 10, hrs: 1, cost: 12, fixed: 0, start: 0 })!.signal).toBe(
      "loss",
    );
  });

  it("country rules are dated and labelled", () => {
    expect(Object.keys(RULES).sort()).toEqual([
      "Australia",
      "Canada",
      "New Zealand",
      "United Kingdom",
      "United States",
    ]);
    for (const r of Object.values(RULES)) {
      expect(r.checked).toMatch(/October 2026/);
      for (const f of r.facts) expect(["fact", "est", "unknown"]).toContain(f.label);
    }
  });
});

describe("Fit Finder answers", () => {
  it("validate on the way in and still validate when read back", async () => {
    const { parseAnswers } = await import("@/lib/fit/validate");
    const a = answers(rng(7));
    const stored = parseAnswers({ ...a, block: String(a.block) })!;
    expect(stored.block).toBe(a.block);
    expect(parseAnswers(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(parseAnswers({ ...a, country: "Atlantis" })).toBeNull();
    expect(parseAnswers({ ...a, hours: 400 })).toBeNull();
  });
});
