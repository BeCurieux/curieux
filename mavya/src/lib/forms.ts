import { z } from "zod";
import { DomainError } from "@/lib/domain/db";

// What a form's server action returns: a message for the whole form, one
// per field, or a success note.
export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string };

export function fieldErrors(error: z.ZodError): FormState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { error: "Check the highlighted details.", fieldErrors: errors };
}

// Runs a domain call and turns a DomainError into a form message. Anything
// else is a bug and is rethrown for error reporting.
export async function attempt(run: () => Promise<void>): Promise<FormState | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

// FormData → plain object, with empty strings as undefined so optional
// fields validate as absent.
export function formValues(formData: FormData): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value.trim() === "" ? undefined : value.trim();
  }
  return values;
}

export const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} is too long.`)
    .optional()
    .transform((v) => v ?? null);

export const requiredText = (max: number, label: string) =>
  z
    .string({ error: `Enter a ${label.toLowerCase()}.` })
    .min(1, `Enter a ${label.toLowerCase()}.`)
    .max(max, `${label} is too long.`);
