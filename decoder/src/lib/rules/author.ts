/**
 * "What do you want us to watch for?" → structured rules.
 *
 * BRIEF.md §6: the user types
 *
 * > "I'm vegan. I avoid artificial sweeteners and carrageenan. I don't care
 * > about seed oils. Flag anything with caffeine."
 *
 * and gets back a list they confirm. §7 permits the model to help here — it
 * lists "resolving ingredient aliases" among the things the model may assist
 * with — but the model is doing translation, not deciding anything.
 *
 * ## Two constraints that make this safe
 *
 * **The vocabulary is closed.** The model may only name a class that exists in
 * the ontology or an ingredient that exists in the graph. Anything else is not
 * silently coerced into the nearest match — it is returned in `unmapped` and
 * shown to the user, because a rule the user thinks they set and does not have
 * is worse than no rule at all.
 *
 * **The model never writes the explanation.** It picks a target; `because` is
 * generated here from the kind and the label. §17 Rule 4 requires every
 * sentence to attribute the decision to the user, and that is a guarantee when
 * the sentence is generated and a hope when it is prompted.
 *
 * And the whole thing is a draft: §6 ends with "The user then confirms them."
 * `draftRules` returns a `RuleDraft`, never a live `RuleSet`.
 */

import { ALL_CLASSES, KNOWLEDGE, classLabel } from "@/lib/knowledge";
import { Rule, RuleSet, type ClassId, type RuleKind, type RuleTarget } from "@/lib/schema";
import { z } from "zod";

export const AUTHOR_PROMPT_VERSION = "author-1";

/* -------------------------------------------------------------------------- */
/* What the model may return                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Note what is absent: no `because`, and no free-text target. The model chooses
 * from a list and nothing else.
 */
const DraftedRule = z.object({
  kind: z.enum(["avoid", "flag", "never-flag"]),
  targetKind: z.enum(["class", "ingredient"]),
  targetValue: z.string().min(1),
});

const DraftResponse = z.object({
  rules: z.array(DraftedRule),
  /** Things the user said that the model could not map to the vocabulary. */
  unmapped: z.array(z.string()).default([]),
});

export type RuleDraft = {
  /** Awaiting the user's confirmation. Never applied without it. */
  ruleSet: RuleSet;
  /**
   * What we could not turn into a rule, in the user's own words. Shown to them
   * rather than dropped — §6's confirmation step is where a missing rule gets
   * caught, and it can only be caught if it is visible.
   */
  unmapped: string[];
  provenance: { promptVersion: string; source: "model" | "local" };
};

export interface RuleAuthorTransport {
  draft(request: { system: string; user: string }): Promise<string>;
}

/* -------------------------------------------------------------------------- */
/* The vocabulary, and the sentence                                            */
/* -------------------------------------------------------------------------- */

const CLASS_IDS = new Set<string>(ALL_CLASSES);
const ENTRY_IDS = new Set(KNOWLEDGE.map((e) => e.id));

export function vocabulary(): { classes: { id: ClassId; label: string }[]; ingredients: { id: string; label: string }[] } {
  return {
    classes: ALL_CLASSES.map((id) => ({ id, label: classLabel(id) })),
    ingredients: KNOWLEDGE.map((e) => ({ id: e.id, label: e.canonical })),
  };
}

/** The explanation, generated rather than prompted. §17 Rule 4. */
export function becauseFor(kind: RuleKind, label: string): string {
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  switch (kind) {
    case "avoid":
      return `You asked us to avoid ${lower}.`;
    case "flag":
      return `You asked us to flag ${lower}.`;
    case "never-flag":
      return `You told us not to flag ${lower}.`;
  }
}

function labelFor(target: RuleTarget): string | null {
  if (target.kind === "class") return CLASS_IDS.has(target.value) ? classLabel(target.value) : null;
  return KNOWLEDGE.find((e) => e.id === target.value)?.canonical ?? null;
}

/**
 * Turn validated model output into rules, dropping anything outside the
 * vocabulary into `unmapped`.
 */
function assemble(
  drafted: z.infer<typeof DraftResponse>,
  setId: string,
  setLabel: string,
  source: "model" | "local",
): RuleDraft {
  const rules = [];
  const unmapped = [...drafted.unmapped];
  const seen = new Set<string>();

  for (const item of drafted.rules) {
    const target: RuleTarget =
      item.targetKind === "class"
        ? { kind: "class", value: item.targetValue as ClassId }
        : { kind: "ingredient", value: item.targetValue };

    const valid = item.targetKind === "class" ? CLASS_IDS.has(item.targetValue) : ENTRY_IDS.has(item.targetValue);
    if (!valid) {
      // Not coerced to the nearest match. A rule the user believes they set and
      // does not actually have is the worst outcome available here.
      unmapped.push(item.targetValue);
      continue;
    }

    const label = labelFor(target);
    if (!label) {
      unmapped.push(item.targetValue);
      continue;
    }

    const id = `${item.kind}-${item.targetValue}`;
    if (seen.has(id)) continue;
    seen.add(id);

    rules.push(
      Rule.parse({
        id,
        kind: item.kind,
        target,
        label,
        because: becauseFor(item.kind, label),
        origin: "custom",
      }),
    );
  }

  return {
    ruleSet: RuleSet.parse({ id: setId, label: setLabel, rules }),
    unmapped,
    provenance: { promptVersion: AUTHOR_PROMPT_VERSION, source },
  };
}

/* -------------------------------------------------------------------------- */
/* The prompt                                                                  */
/* -------------------------------------------------------------------------- */

export function systemPrompt(): string {
  const vocab = vocabulary();
  return `You turn a person's description of what they avoid into structured rules. You are a translator. You do not decide what anybody should eat, and you never add a rule they did not ask for.

Return ONLY a JSON object:

{
  "rules": [ { "kind": "avoid" | "flag" | "never-flag", "targetKind": "class" | "ingredient", "targetValue": "<id from the lists below>" } ],
  "unmapped": [ "<anything they asked for that is not in the lists>" ]
}

Rules:

1. "avoid" is a blocker — they do not want it at all. "flag" means show it but do not block. "never-flag" means they explicitly said they do not care about it; use it whenever they say something like "I don't care about X" or "don't flag X".

2. targetValue MUST be an id copied exactly from the lists below. Never invent one, never guess at the closest, never abbreviate. If somebody asks for something that is not in the lists, put their own words in "unmapped" and move on.

3. Prefer a class over an ingredient when the class covers what they said. "I'm vegan" is one rule targeting the class animal-derived, not forty ingredient rules.

4. Do not add rules they did not ask for. "I'm vegan" does not imply anything about sugar.

CLASSES:
${vocab.classes.map((c) => `  ${c.id} — ${c.label}`).join("\n")}

INGREDIENTS:
${vocab.ingredients.map((i) => `  ${i.id} — ${i.label}`).join("\n")}`;
}

/* -------------------------------------------------------------------------- */
/* Drafting                                                                    */
/* -------------------------------------------------------------------------- */

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON object in the response");
  return JSON.parse(body.slice(start, end + 1));
}

export async function draftRules(
  description: string,
  transport: RuleAuthorTransport,
  options: { id?: string; label?: string } = {},
): Promise<RuleDraft> {
  const raw = await transport.draft({ system: systemPrompt(), user: description });
  const parsed = DraftResponse.parse(extractJson(raw));
  return assemble(parsed, options.id ?? "custom", options.label ?? "My rules", "model");
}

/* -------------------------------------------------------------------------- */
/* The offline path                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Keyword matching against the same closed vocabulary, with no model involved.
 *
 * Two reasons this exists rather than being a shortcut. §6 budgets 45–60
 * seconds for onboarding and §25 measures onboarding completion — an
 * onboarding step that fails when an inference call fails is a dead funnel at
 * the worst possible moment. And it lets the mapping logic be tested directly,
 * without a fake transport standing in for the part being tested.
 *
 * It is deliberately literal. It recognises the phrasings people actually type
 * and reports everything else as unmapped rather than reaching.
 */
const PHRASES: { match: RegExp; kind: RuleKind; target: RuleTarget }[] = [
  { match: /\bvegan\b/i, kind: "avoid", target: { kind: "class", value: "animal-derived" } },
  { match: /\bvegetarian\b/i, kind: "avoid", target: { kind: "class", value: "meat" } },
  { match: /\bno pork\b|\bpork[- ]free\b/i, kind: "avoid", target: { kind: "class", value: "pork-derived" } },
  { match: /\bartificial sweeteners?\b/i, kind: "avoid", target: { kind: "class", value: "sweetener-artificial" } },
  { match: /\bsugar alcohols?\b/i, kind: "flag", target: { kind: "class", value: "sweetener-sugar-alcohol" } },
  { match: /\bseed oils?\b/i, kind: "avoid", target: { kind: "class", value: "oil-seed" } },
  { match: /\badded sugars?\b/i, kind: "avoid", target: { kind: "class", value: "sugar-added" } },
  { match: /\bemulsifiers?\b/i, kind: "avoid", target: { kind: "class", value: "emulsifier" } },
  { match: /\bpreservatives?\b/i, kind: "avoid", target: { kind: "class", value: "preservative" } },
  { match: /\b(artificial|synthetic) colou?rs?\b/i, kind: "avoid", target: { kind: "class", value: "colour-synthetic" } },
  { match: /\bcarrageenan\b/i, kind: "avoid", target: { kind: "ingredient", value: "carrageenan" } },
  { match: /\bcaffeine\b/i, kind: "flag", target: { kind: "class", value: "caffeine-source" } },
  { match: /\bgluten\b/i, kind: "avoid", target: { kind: "class", value: "gluten-grain" } },
  { match: /\balcohol\b/i, kind: "flag", target: { kind: "class", value: "alcohol" } },
  { match: /\bmsg\b|\bglutamate\b/i, kind: "avoid", target: { kind: "ingredient", value: "msg" } },
  { match: /\btitanium dioxide\b/i, kind: "avoid", target: { kind: "ingredient", value: "titanium-dioxide" } },
];

/** "I don't care about X" / "don't flag X" — the clause that flips a rule off. */
const INDIFFERENCE = /\b(?:don'?t care about|do not care about|don'?t flag|do not flag|not worried about|fine with)\b([^.;!?]*)/gi;

export function draftRulesLocally(description: string, options: { id?: string; label?: string } = {}): RuleDraft {
  const indifferentTo: string[] = [];
  for (const m of description.matchAll(INDIFFERENCE)) indifferentTo.push(m[1] ?? "");
  const indifferentText = indifferentTo.join(" ");

  const rules: z.infer<typeof DraftedRule>[] = [];
  for (const phrase of PHRASES) {
    if (!phrase.match.test(description)) continue;
    // A phrase inside an "I don't care about …" clause becomes a never-flag
    // rather than the rule it would otherwise be. Without this, §6's own
    // example produces the exact opposite of what the user said.
    const kind: RuleKind = phrase.match.test(indifferentText) ? "never-flag" : phrase.kind;
    rules.push({ kind, targetKind: phrase.target.kind, targetValue: phrase.target.value });
  }

  // Anything that looks like a request but matched nothing is reported rather
  // than swallowed.
  const unmapped: string[] = [];
  for (const clause of description.split(/[.;!?\n]/)) {
    const trimmed = clause.trim();
    if (trimmed.length < 3) continue;
    const looksLikeARequest = /\bavoid\b|\bflag\b|\bno\b|\bwithout\b|\ballerg/i.test(trimmed);
    const matchedSomething = PHRASES.some((p) => p.match.test(trimmed));
    if (looksLikeARequest && !matchedSomething) unmapped.push(trimmed);
  }

  return assemble({ rules, unmapped }, options.id ?? "custom", options.label ?? "My rules", "local");
}
