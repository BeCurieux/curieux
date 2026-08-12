/**
 * The zod half of the Genome contract — what the model is allowed to return.
 *
 * Deliberately narrower than `ProductGenome`: the model supplies inferences and
 * nothing else. Price tier and photography are merged in afterwards from
 * `heuristics.ts`, so there is no path by which a model's opinion about a
 * distribution or a resolution reaches the stored Genome.
 */

import { z } from "zod";

export const ProductInferenceSchema = z.object({
  handle: z.string(),
  problemSolved: z.string().max(160),
  audience: z.string().max(160),
  occasions: z.array(z.string().max(40)).max(3),
  role: z.enum(["hero", "supporting", "add-on"]),
  giftability: z.enum(["high", "medium", "low"]),
  complements: z.array(z.string()).max(4),
  substitutes: z.array(z.string()).max(4),
  confidence: z.enum(["high", "medium", "low"]),
});

export const GenomeInference = z.object({
  catalogueRead: z.string().max(240),
  products: z.array(ProductInferenceSchema).min(1),
});

export type GenomeInference = z.infer<typeof GenomeInference>;
