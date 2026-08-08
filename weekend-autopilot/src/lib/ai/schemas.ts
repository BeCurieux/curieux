/**
 * Structured output schemas for every AI call (§12).
 *
 * The model is never permitted to return prose that becomes a plan. It returns
 * these shapes, they are validated with Zod, and a malformed response is
 * retried rather than coerced. Note what the schemas do NOT contain: no
 * addresses, no opening hours, no prices, no travel times, no venue names the
 * model invented. Selection is by candidate ID; facts come from providers
 * (§13, §53).
 */

import { z } from "zod";

// ------------------------------------------------------------ search intents

export const searchIntentSchema = z.object({
  /** Natural-language query handed to the PlaceProvider. */
  query: z.string().min(3).max(120),
  /** Our taxonomy categories this intent is hunting for. */
  categories: z.array(z.string()).min(1).max(4),
  /** What role this would play in a plan. Drives assembly. */
  role: z.enum(["ANCHOR", "FOOD", "ADDON"]),
  /** Why this intent suits the household. One short clause, for debugging. */
  rationale: z.string().max(200),
  /** 1–5; the planner spends its candidate budget on high-priority intents first. */
  priority: z.number().int().min(1).max(5),
});

export const searchIntentsSchema = z.object({
  intents: z.array(searchIntentSchema).min(2).max(10),
});

export type SearchIntent = z.infer<typeof searchIntentSchema>;

// ------------------------------------------------------------ candidate ranking

export const candidateRankingSchema = z.object({
  rankings: z
    .array(
      z.object({
        candidate_id: z.string(),
        /** 0–100. Advisory: blended with the deterministic score, not trusted alone. */
        score: z.number().min(0).max(100),
        reason: z.string().max(240),
      })
    )
    .min(1),
});

// ------------------------------------------------------------ plan selection

export const planSelectionSchema = z.object({
  /** IDs of assembled bundles, best first. Never free-text venue names. */
  primary_bundle_id: z.string(),
  backup_bundle_id: z.string(),
  /** Why the primary suits this household this weekend. */
  primary_reason: z.string().max(400),
  /** Why the backup is the right fallback (easier/closer/weather-proof). */
  backup_reason: z.string().max(400),
  /** 0–1. The model's own confidence, blended into the plan's score. */
  confidence: z.number().min(0).max(1),
});

// ------------------------------------------------------------ critique

export const planCritiqueSchema = z.object({
  /** Would a thoughtful friend actually send this plan? */
  approve: z.boolean(),
  /** Concrete problems, each one actionable. Empty when approving. */
  problems: z
    .array(
      z.object({
        severity: z.enum(["BLOCKER", "CONCERN"]),
        item_sequence: z.number().int().nullable(),
        description: z.string().max(300),
      })
    )
    .max(6),
  /** 0–1 quality read, used to break ties between assembled bundles. */
  quality: z.number().min(0).max(1),
});

// ------------------------------------------------------------ copy

export const planCopySchema = z.object({
  /** "Coastal walk + dumplings + a swim". Concrete, no marketing language. */
  title: z.string().min(8).max(80),
  /** One line under the title. */
  short_description: z.string().min(10).max(160),
  /** The "why this fits you" paragraph, grounded in supplied taste evidence. */
  fit_reason: z.string().min(20).max(400),
  /** Per-item copy, keyed by sequence. Descriptions only — never facts. */
  items: z
    .array(
      z.object({
        sequence: z.number().int().min(0),
        title: z.string().min(2).max(90),
        description: z.string().max(220).nullable(),
      })
    )
    .min(1),
});

export type PlanCopy = z.infer<typeof planCopySchema>;

// ------------------------------------------------------------ taste

export const tasteSummarySchema = z.object({
  /** The readable summary shown at the end of onboarding (§9 screen 10). */
  summary: z.string().min(20).max(400),
});

export const tasteInsightSchema = z.object({
  /** "You seem happiest when there's water involved." One line, or null. */
  insight: z.string().max(160).nullable(),
});

export const feedbackSummarySchema = z.object({
  /** Structured signal updates the model proposes from free-text feedback. */
  signals: z
    .array(
      z.object({
        dimension: z.string().max(40),
        value: z.string().max(60),
        /** −1…+1 */
        delta: z.number().min(-1).max(1),
        evidence: z.string().max(200),
      })
    )
    .max(8),
});

export const tasteModelUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        dimension: z.string().max(40),
        value: z.string().max(60),
        weight: z.number().min(-1).max(1),
        confidence: z.number().min(0).max(1),
        reason: z.string().max(200),
      })
    )
    .max(20),
});

// ------------------------------------------------------------ validation helper

export interface ValidationFailure {
  attempt: number;
  message: string;
}

/**
 * Parse a model response against a schema, returning either the value or the
 * validation error text to feed back into a retry. We never partially accept:
 * a shape that does not validate is discarded (§12).
 */
export function parseStructured<T>(
  schema: z.ZodType<T>,
  raw: unknown
): { ok: true; value: T } | { ok: false; error: string } {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    error: result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; "),
  };
}
