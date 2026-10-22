"use server";

import { redirect } from "next/navigation";
import { KIT_VERSION } from "@/lib/fit/data";
import { parseAnswers, progressSchema } from "@/lib/fit/validate";
import { studio } from "@/lib/studio/context";
import { track } from "@/lib/analytics/track";

export async function submitFitAnswers(input: unknown): Promise<{ ok: false; message: string }> {
  const { repo } = await studio();
  const answers = parseAnswers(input);
  if (!answers)
    return { ok: false, message: "A few answers are missing. Go back and check each question." };
  const result = await repo.createFitResult(
    answers as unknown as Record<string, string | number>,
    KIT_VERSION,
  );
  await track("fit_completed", repo.userId);
  redirect(`/studio/fit/${result.id}`);
}

/**
 * Merges a change into her saved progress. The calculator and the plan save
 * independently, so each sends only what it changed; replacing the whole
 * object would let one overwrite the other.
 */
export async function saveFitProgress(id: string, patch: unknown): Promise<{ ok: boolean }> {
  const { repo } = await studio();
  const parsed = progressSchema.safeParse(patch);
  if (!parsed.success) return { ok: false };
  const current = await repo.getFitResult(id);
  if (!current) return { ok: false };
  const { calc, ...rest } = parsed.data;
  const next = progressSchema.safeParse({
    ...current.progress,
    ...rest,
    ...(calc ? { calc: { ...(current.progress.calc ?? {}), ...calc } } : {}),
  });
  if (!next.success) return { ok: false };
  try {
    await repo.updateFitProgress(id, next.data);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
