/**
 * The rewrite engine, with no key anywhere in here.
 *
 * Two things are load-bearing. The **fabrication** tests are the product rule
 * CLAUDE.md calls the worst possible failure, checked: a rewrite that invents
 * a study or a percentage is a claim the brand cannot defend, published on our
 * advice, on a card carrying our mark. And the **gate** tests are law 1: the
 * model drafts, the same deterministic engine that raised the finding decides
 * whether the draft answers it.
 *
 * The drafter is injected everywhere, so none of this needs credentials. The
 * one thing that cannot be checked here is whether a real model writes good
 * copy — see the request-shape suite at the bottom for what *is* checked about
 * the live path.
 */

import { describe, expect, it, vi } from "vitest";
import { scan } from "@/engine/evaluate.js";
import { allRules, ruleById } from "@/engine/registry.js";
import { annotate, marksFor } from "@/card/annotate.js";
import { rewriteKey } from "@/card/page.js";
import { evidenceIn, fabricatedEvidence } from "@/rewrite/fabrication.js";
import { validateRewrite, topicOverlap, LENGTH_BAND } from "@/rewrite/validate.js";
import { mechanicalRewrite } from "@/rewrite/deterministic.js";
import { rewriteAll, rewriteMark, contextAround } from "@/rewrite/rewrite.js";
import { anthropicDrafter, SYSTEM, DEFAULT_MODEL, apiKey, type Drafter } from "@/rewrite/model.js";
import type { Jurisdiction } from "@/engine/types.js";

const MARKETS: Jurisdiction[] = ["AU", "US", "EU"];
const RULES = allRules();
const paste = { kind: "paste" } as const;

/** The mark for the first phrase a scan flags in this text. */
function firstMark(text: string, jurisdictions: Jurisdiction[] = MARKETS) {
  const result = scan({ text, source: paste, jurisdictions });
  const { marks } = annotate(text, result.findings);
  const mark = marks[0];
  if (!mark) throw new Error(`nothing flagged in ${JSON.stringify(text)}`);
  return mark;
}

const drafterOf = (...drafts: string[]): Drafter => async () => drafts;

// --------------------------------------------------------------- fabrication

describe("inventing evidence", () => {
  it("sees a figure, a duration, a scheme, a study and a ranking", () => {
    const kinds = (text: string) => new Set(evidenceIn(text).map((e) => e.kind));
    expect(kinds("87% of users")).toContain("figure");
    expect(kinds("in 28 days")).toContain("duration");
    expect(kinds("certified by ECOCERT")).toContain("scheme");
    expect(kinds("in a clinical trial")).toContain("study");
    expect(kinds("Australia's number one serum")).toContain("ranking");
  });

  it("counts a duration once, not as a number and a duration", () => {
    // Otherwise a draft could keep "28", drop "days", and read as clean.
    const found = evidenceIn("in 28 days");
    expect(found.filter((e) => e.kind === "figure")).toEqual([]);
    expect(found.map((e) => e.token)).toEqual(["28 days"]);
  });

  it("catches the draft that helpfully adds a study", () => {
    // The exact failure: asked to make "clinically proven" defensible, the
    // helpful thing to write is a study that does not exist.
    const fabricated = fabricatedEvidence(
      "Clinically proven to reduce fine lines.",
      "In a 12-week study, 87% of women reported smoother-looking skin.",
    );
    expect(fabricated.map((e) => e.token)).toEqual(expect.arrayContaining(["12-week", "87%"]));
  });

  it("catches a certification the brand never claimed", () => {
    const fabricated = fabricatedEvidence("An eco-friendly serum.", "Certified by ECOCERT.");
    expect(fabricated.map((e) => e.kind)).toContain("scheme");
  });

  it("allows a figure the brand already published elsewhere on the page", () => {
    // Reusing the brand's own number is the remedy, not an invention.
    const context = "A 12-week study of 42 volunteers. Clinically proven to firm.";
    expect(fabricatedEvidence(context, "In our 12-week study, skin looked firmer.")).toEqual([]);
  });

  it("is untroubled by a rewrite that removes evidence", () => {
    expect(fabricatedEvidence("Proven in 28 days.", "Skin looks smoother over time.")).toEqual([]);
  });
});

// ---------------------------------------------------------------- the gate

describe("the gate", () => {
  const mark = firstMark("An eco-friendly formula.", ["EU"]);
  const finding = mark.findings[0]!;
  const gate = (rewrite: string, claim = mark.text, context?: string) =>
    validateRewrite({ claim, rewrite, finding, context, jurisdictions: ["EU"] });

  it("accepts a rewrite that clears the rule", () => {
    expect(gate("made with plant-derived surfactants")).toEqual({ ok: true });
  });

  it("accepts a blank the brand fills in, and does not read it as a claim", () => {
    // Without this, "never invent evidence" collapses into "always delete the
    // claim", because the honest fix here needs a fact only the brand has.
    expect(gate("made with [your figure]% bio-based ingredients")).toEqual({ ok: true });
  });

  it("rejects a draft that still trips the rule it was written for", () => {
    const verdict = gate("an eco-friendly, planet friendly formula");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("still-trips");
  });

  it("rejects a draft that fixes one rule by tripping another", () => {
    // Moving the problem is not fixing it. This is the check that makes the
    // per-mark gate worth having.
    const verdict = gate("a cruelty free formula, never tested on animals");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("trips-something-new");
  });

  it("rejects a draft that invents evidence, however well it reads", () => {
    const verdict = gate("cutting packaging emissions by 62%");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("fabricates");
      expect(verdict.reason).toContain("62%");
    }
  });

  it("rejects the draft that quietly deletes a sentence-length claim", () => {
    // Only checkable when the claim is a sentence. A two-word trigger has no
    // vocabulary to keep, which is why the overlap check sits out below four
    // content words — see TOPIC_CHECK_MIN_WORDS.
    const sentence = firstMark("Every parcel we send is carbon neutral.", ["EU"]);
    const verdict = validateRewrite({
      claim: "Every parcel we send is carbon neutral.",
      rewrite: "Contact our team for shipping information.",
      finding: sentence.findings[0]!,
      jurisdictions: ["EU"],
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("off-topic");
  });

  it("rejects an essay", () => {
    const verdict = gate("Our approach to materials ".repeat(30));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("too-long");
  });

  it("rejects an unchanged draft and an empty one", () => {
    expect(gate(mark.text).ok).toBe(false);
    expect(gate("   ").ok).toBe(false);
  });

  it("lets a one-word mark grow into a sentence", () => {
    // The ratio alone rejected "recyclable where facilities exist", which is
    // the exact fix the Green Guides ask for.
    const recyclable = firstMark("The bottle is recyclable.", ["US"]);
    const verdict = validateRewrite({
      claim: recyclable.text,
      rewrite: "recyclable where facilities exist",
      finding: recyclable.findings[0]!,
      jurisdictions: ["US"],
    });
    expect(verdict).toEqual({ ok: true });
    expect("recyclable where facilities exist".length).toBeGreaterThan(
      recyclable.text.length * LENGTH_BAND.max,
    );
  });

  it("measures whether the draft is still about the same thing", () => {
    expect(topicOverlap("carbon neutral shipping", "carbon reduced shipping")).toBeGreaterThan(0.5);
    expect(topicOverlap("carbon neutral shipping", "contact us for details")).toBe(0);
  });
});

// --------------------------------------------------------------- mechanical

describe("the rewrites that need no model", () => {
  it("swaps a permitted-indication verb, keeping the case", () => {
    const mark = firstMark("Boosts immunity through winter.", ["AU"]);
    expect(mechanicalRewrite(mark.findings[0]!, mark.text)).toBe("Supports immunity");
  });

  it("adds the availability qualifier after the phrase, not at the end", () => {
    const mark = firstMark("The bottle is recyclable; the carton is card.", ["US"]);
    const rewrite = mechanicalRewrite(mark.findings[0]!, "The bottle is recyclable; the carton is card.");
    expect(rewrite).toBe("The bottle is recyclable where facilities exist; the carton is card.");
  });

  it("does not add a qualifier that is already there", () => {
    const mark = firstMark("Fully recyclable.", ["US"]);
    expect(mechanicalRewrite(mark.findings[0]!, "recyclable where facilities exist")).toBeNull();
  });

  it("returns nothing for a rule whose fix needs knowledge it does not have", () => {
    // "No nasties" becomes the brand's own exclusion list, and nothing here
    // knows what is in it. A guess would displace a correct remedy.
    const mark = firstMark("No nasties, ever.", ["AU"]);
    expect(mechanicalRewrite(mark.findings[0]!, mark.text)).toBeNull();
  });

  it("is declared on exactly the rules that have one", () => {
    const withFix = allRules().filter((rule) => rule.mechanical).map((rule) => rule.id);
    expect(withFix.sort()).toEqual(["au-tga-indication-outside-permitted-list", "us-ftc-recyclable-unqualified"]);
  });
});

// ------------------------------------------------------------ orchestration

describe("drafting a mark", () => {
  const context = "Lumen Daily Immunity Drops. Boosts immunity through winter.";

  it("takes the exact fix without asking a model", async () => {
    const drafter = vi.fn(drafterOf("should not be reached"));
    const outcome = await rewriteMark(firstMark("Boosts immunity through winter.", ["AU"]), context, { drafter });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.rewrite.source).toBe("mechanical");
    expect(drafter).not.toHaveBeenCalled();
  });

  it("asks the model where no exact fix exists", async () => {
    const mark = firstMark("An eco-friendly formula.", ["EU"]);
    const outcome = await rewriteMark(mark, "An eco-friendly formula.", {
      drafter: drafterOf("made with plant-derived surfactants"),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.rewrite.source).toBe("model");
  });

  it("works offline, and says why when it cannot", async () => {
    const outcome = await rewriteMark(firstMark("An eco-friendly formula.", ["EU"]), context);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.miss.reason).toContain("no drafter");
  });

  it("takes the first candidate that clears, and records the ones that did not", async () => {
    const mark = firstMark("An eco-friendly formula.", ["EU"]);
    const outcome = await rewriteMark(mark, "An eco-friendly formula.", {
      drafter: drafterOf(
        "an eco-friendly blend",
        "cutting emissions by 62%",
        "made with plant-derived surfactants",
      ),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.rewrite.text).toBe("made with plant-derived surfactants");
      expect(outcome.rewrite.rejected.map((r) => r.code)).toEqual(["still-trips", "fabricates"]);
    }
  });

  it("ships nothing rather than something wrong when every draft fails", async () => {
    const mark = firstMark("An eco-friendly formula.", ["EU"]);
    const outcome = await rewriteMark(mark, "An eco-friendly formula.", {
      drafter: drafterOf("eco-friendly!", "planet friendly"),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.miss.reason).toContain("2 drafts were rejected");
      expect(outcome.miss.rejected).toHaveLength(2);
    }
  });

  it("survives the drafter throwing", async () => {
    const outcome = await rewriteMark(firstMark("An eco-friendly formula.", ["EU"]), context, {
      drafter: async () => {
        throw new Error("429 rate limited\nretry later");
      },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.miss.reason).toBe("the drafter failed: 429 rate limited");
  });

  it("requires one draft to answer every rule on the mark", async () => {
    // "eco-friendly" trips three markets at once. A draft clearing the ECGT
    // and leaving the Green Guides has moved the problem, not fixed it.
    const mark = firstMark("An eco-friendly formula.", MARKETS);
    expect(new Set(mark.findings.map((f) => f.jurisdiction)).size).toBeGreaterThan(1);
    const outcome = await rewriteMark(mark, "An eco-friendly formula.", {
      drafter: drafterOf("made with plant-derived surfactants"),
      jurisdictions: MARKETS,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.rewrite.ruleIds.length).toBeGreaterThan(1);
  });
});

describe("a whole page", () => {
  const text = `Lumen Daily Immunity Drops

Boosts immunity through winter.
The bottle is recyclable.
An eco-friendly formula.`;

  it("files one accepted wording under every finding on its mark", async () => {
    const result = scan({ text, source: paste, jurisdictions: MARKETS });
    const { marks } = annotate(text, result.findings);
    const run = await rewriteAll(text, marks, { jurisdictions: MARKETS });

    const eco = marks.find((m) => m.text.toLowerCase().includes("eco"))!;
    for (const finding of eco.findings) expect(run.rewrites[rewriteKey(finding)]).toBeUndefined();

    const boosts = marks.find((m) => m.text.toLowerCase().startsWith("boosts"))!;
    for (const finding of boosts.findings) {
      expect(run.rewrites[rewriteKey(finding)]).toBe("Supports immunity");
    }
  });

  it("reports what it could not do rather than leaving a gap", async () => {
    const result = scan({ text, source: paste, jurisdictions: MARKETS });
    const { marks } = annotate(text, result.findings);
    const run = await rewriteAll(text, marks, { jurisdictions: MARKETS });
    expect(run.accepted.length + run.missed.length).toBe(marks.length);
    for (const miss of run.missed) expect(miss.reason.length).toBeGreaterThan(10);
  });

  it("gives the drafter the copy around the claim, not just the claim", () => {
    const around = contextAround(text, text.indexOf("eco-friendly"), text.indexOf("eco-friendly") + 12);
    expect(around).toContain("Lumen Daily Immunity Drops");
    expect(around).toContain("recyclable");
  });

  it("hands the card exactly the shape it takes", async () => {
    const result = scan({ text, source: paste, jurisdictions: MARKETS });
    const { marks } = annotate(text, result.findings);
    const run = await rewriteAll(text, marks, { jurisdictions: MARKETS });
    for (const key of Object.keys(run.rewrites)) expect(key).toMatch(/^[a-z0-9-]+@\d+$/);
  });
});

// ------------------------------------------------------- the live request

describe("what the live drafter sends", () => {
  // The model's output cannot be checked without a key. The request can, and
  // a wrong parameter name is the failure that only shows up in production.
  function capturing() {
    const sent: Record<string, unknown>[] = [];
    const client = {
      messages: {
        parse: async (params: Record<string, unknown>) => {
          sent.push(params);
          return { parsed_output: { rewrites: ["a rewrite that is long enough"] } };
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { sent, drafter: anthropicDrafter({ client: client as any }) };
  }

  it("asks Opus 5 with adaptive thinking and a cached system prompt", async () => {
    const { sent, drafter } = capturing();
    const mark = firstMark("An eco-friendly formula.", ["EU"]);
    await drafter({ claim: mark.text, context: "An eco-friendly formula.", findings: mark.findings });

    const params = sent[0]!;
    expect(params.model).toBe(DEFAULT_MODEL);
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config).toHaveProperty("format");
    const system = params.system as { text: string; cache_control?: unknown }[];
    expect(system[0]?.text).toBe(SYSTEM);
    expect(system[0]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("carries the rule's guidance and its worked example into the prompt", async () => {
    const { sent, drafter } = capturing();
    const mark = firstMark("An eco-friendly formula.", ["EU"]);
    await drafter({ claim: mark.text, context: "An eco-friendly formula.", findings: mark.findings });

    const prompt = (sent[0]!.messages as { content: string }[])[0]!.content;
    const rule = ruleById("eu-ecgt-generic-environmental")!;
    expect(prompt).toContain(rule.rewriteGuidance);
    expect(prompt).toContain(rule.example.quiet);
    expect(prompt).toContain("eco-friendly");
  });

  it("tells the model in its standing instruction never to invent evidence", () => {
    expect(SYSTEM).toContain("NEVER introduce evidence");
    expect(SYSTEM.toLowerCase()).toContain("certification");
  });

  it("reads the key from the name that survives a coding agent", () => {
    expect(apiKey({ ASSAY_ANTHROPIC_API_KEY: "a", ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)).toBe("a");
    expect(apiKey({ ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)).toBe("b");
    expect(apiKey({} as NodeJS.ProcessEnv)).toBeUndefined();
  });
});

describe("marks with nothing to rewrite", () => {
  it("returns an empty run for a page with no findings", async () => {
    const run = await rewriteAll("A serum in an amber bottle.", marksFor([]));
    expect(run).toEqual({ rewrites: {}, accepted: [], missed: [] });
  });
});
