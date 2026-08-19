/**
 * The drafter — the one place a model is allowed near a scan.
 *
 * What it does: proposes wordings. What it does not do, and structurally
 * cannot: decide whether a wording is acceptable. Everything it returns goes
 * through `validate.ts`, which re-scans with the same deterministic engine
 * that raised the finding. A draft the rules still flag is discarded no matter
 * how good it reads. That is law 1, and the reason this file returns
 * *candidates* rather than an answer.
 *
 * It drafts per **mark**, not per finding. One phrase routinely trips three
 * markets at once — "eco-friendly" answers to the ECGT, the Green Guides and
 * the ACCC — and three separate rewrites of the same three words is both
 * three times the cost and the wrong shape: the brand needs one sentence that
 * satisfies all three, which is exactly what the gate then checks.
 *
 * Injectable, so the suite and the kill test never need a key.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ruleById } from "../engine/registry.js";
import type { Finding } from "../engine/types.js";

export type DraftRequest = {
  /** The exact phrase on the page that was marked. */
  claim: string;
  /** The sentence or paragraph it sits in, for voice and for what may be reused. */
  context: string;
  /** Every rule this phrase tripped. One draft has to answer all of them. */
  findings: Finding[];
  /** How many wordings to ask for. The gate picks among them. */
  candidates?: number;
};

/** Drafts, best first. Returning none is a legitimate answer. */
export type Drafter = (request: DraftRequest) => Promise<string[]>;

export const DEFAULT_MODEL = "claude-opus-5";
export const DEFAULT_CANDIDATES = 3;

const Drafts = z.object({
  rewrites: z
    .array(z.string())
    .describe("Replacement wordings for the marked phrase, best first. Each replaces the phrase exactly."),
});

/**
 * The standing instruction. Frozen text, kept out of the per-request half so
 * it caches, and written to be read by somebody auditing what this product
 * tells a model to do on a brand's behalf.
 */
export const SYSTEM = `You rewrite marketing copy for beauty, wellness and clean-label brands so that a
specific phrase stops tripping a specific advertising rule, without the brand losing its voice.

You are given the phrase, the copy around it, and the rule or rules it trips — each with guidance on
what a good rewrite does, and one worked example of the same claim written well.

Hard constraints. These are not preferences.

1. NEVER introduce evidence that is not already in the copy you were shown. No study, no trial, no
   percentage, no sample size, no duration, no certification or scheme name, no ranking. If the copy
   does not contain a number, your rewrite contains no number. This is the single worst thing you can
   do here: the brand will publish what you write, and a figure they cannot support is a claim they
   cannot defend.
2. Where the honest fix needs a fact only the brand has — which scheme certified them, what their
   study measured, which component the claim is about — write the gap in square brackets rather than
   filling it: "carbon neutral, certified under [name your scheme]", "recyclable [where]". A blank
   the brand completes is a good answer. A plausible guess is the failure in rule 1.
3. Answer with the replacement itself — not a caveat appended to the claim, not a disclaimer, not a
   footnote, and not an explanation of your reasoning. A drop-in phrase is best where the phrase can
   be fixed in isolation; where it cannot, return the rewritten sentence instead. Either way it is
   shown to the brand as "instead, write this", so it has to read as finished copy.
4. Keep the brand's register — the sentence length, the punctuation habits, the warmth or the
   restraint of the copy around it. A rewrite that reads like a legal department is a rewrite the
   brand will not use, and unused is the same as not written.
5. Do not weaken the claim into meaninglessness. "Nourishing" in place of a real benefit is a worse
   answer than a narrower version of the real benefit.
6. Never assert that anything is compliant, approved, certified, safe or legal.

Where the copy genuinely cannot support any version of the claim, the right rewrite removes the
claim and keeps the sentence working — not one that hedges it into vagueness.`;

function promptFor(request: DraftRequest): string {
  const rules = request.findings.map((finding) => {
    const rule = ruleById(finding.ruleId);
    const lines = [
      `- ${finding.ruleTitle} (${finding.jurisdiction})`,
      `  Why it is marked: ${finding.concern}`,
      `  What would settle it: ${finding.remedy}`,
      `  Constraint on the rewrite: ${finding.rewriteGuidance}`,
    ];
    if (rule) {
      // The worked example is this rule's own fixture pair, and the quiet half
      // is proven by the corpus suite to actually clear the rule. It is the
      // most specific instruction available and it costs four lines.
      lines.push(`  Worked example — trips: ${JSON.stringify(rule.example.trips)}`);
      lines.push(`                   clear: ${JSON.stringify(rule.example.quiet)}`);
    }
    return lines.join("\n");
  });

  return [
    `The marked phrase, which is what you are replacing:`,
    JSON.stringify(request.claim),
    ``,
    `The copy it sits in, for voice — and the only place you may take a figure from:`,
    JSON.stringify(request.context),
    ``,
    `It trips ${request.findings.length === 1 ? "this rule" : `these ${request.findings.length} rules`}, and one rewrite has to answer all of them:`,
    rules.join("\n\n"),
    ``,
    `Give ${request.candidates ?? DEFAULT_CANDIDATES} replacements for the phrase, best first, each different in approach rather than in wording.`,
  ].join("\n");
}

/**
 * The key, under the name that survives being run inside a coding agent.
 *
 * `ANTHROPIC_API_KEY` is the agent's own credential and is stripped before it
 * reaches a child process, so a value set there arrives as undefined and the
 * failure looks like a missing key while the dashboard shows one set.
 */
export function apiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.ASSAY_ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_API_KEY?.trim() || undefined;
}

export type AnthropicDrafterOptions = {
  client?: Anthropic;
  model?: string;
  /** `low` through `max`. Unset uses the API default. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
};

/** The real drafter. Nothing else in this project constructs a client. */
export function anthropicDrafter(options: AnthropicDrafterOptions = {}): Drafter {
  const client = options.client ?? new Anthropic({ apiKey: apiKey() });
  const model = options.model ?? process.env.REWRITE_MODEL?.trim() ?? DEFAULT_MODEL;
  const effort = options.effort ?? (process.env.REWRITE_EFFORT?.trim() as AnthropicDrafterOptions["effort"]);

  return async (request) => {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: promptFor(request) }],
      output_config: {
        format: zodOutputFormat(Drafts),
        ...(effort ? { effort } : {}),
      },
    });
    const drafts = response.parsed_output?.rewrites ?? [];
    return drafts.map((draft) => draft.trim()).filter(Boolean);
  };
}
