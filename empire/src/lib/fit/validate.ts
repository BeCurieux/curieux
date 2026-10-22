import { z } from "zod";
import { QUESTIONS, type Answers } from "./questions";

// Server-side check of a submitted quiz: every choice must be one of the
// question's options and every number inside its range. Built from the
// question list so the two can't drift.

const shape: Record<string, z.ZodType> = {};
for (const q of QUESTIONS) {
  // Choices are compared as text: "block" is stored as a number once parsed.
  if (q.t === "choice")
    shape[q.k] = z.preprocess(
      (v) => (v === undefined || v === null ? v : String(v)),
      z.enum(q.o as [string, ...string[]]),
    );
  else if (q.t === "num")
    shape[q.k] = z.coerce
      .number()
      .min(q.min ?? 0)
      .max(q.max ?? 1e6);
  else shape[q.k] = z.string().trim().max(30).default("");
}

export const answersSchema = z.object(shape);

export function parseAnswers(input: unknown): Answers | null {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return null;
  const a = parsed.data as Record<string, unknown>;
  return { ...(a as unknown as Answers), block: Number(a.block) };
}

export const progressSchema = z.object({
  start: z.iso.date().optional(),
  done: z.array(z.number().int().min(1).max(14)).max(14).optional(),
  calc: z
    .record(
      z.string().regex(/^\d{1,2}$/),
      z.object({
        price: z.number().min(0).max(1e7).optional(),
        hrs: z.number().min(0).max(1e4).optional(),
        cost: z.number().min(0).max(1e7).optional(),
        fixed: z.number().min(0).max(1e7).optional(),
        start: z.number().min(0).max(1e7).optional(),
      }),
    )
    .optional(),
});
