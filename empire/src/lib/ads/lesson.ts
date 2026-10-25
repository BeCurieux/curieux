import { z } from "zod";

// Course lessons are Markdown files with a small front matter block
// (content/ads/modules). The front matter is a strict subset of YAML:
// `key: value` lines, and `key:` followed by `  - item` lines for lists.
// That keeps it editable by hand without adding a YAML dependency.

export const lessonMetaSchema = z.object({
  slug: z.string().regex(/^\d{2}-[a-z0-9-]+$/),
  module: z.coerce.number().int().min(1).max(10),
  title: z.string().min(1),
  outcome: z.string().min(20),
  prerequisites: z.array(z.string().min(1)).min(1),
  estimated_minutes: z.coerce.number().int().positive(),
  /** Says what the time estimate is based on. Always an estimate. */
  estimate_note: z.string().regex(/^EST\b/),
  /** "Label | URL or document | FACT, checked <date>" or "... | UNKNOWN" */
  sources: z
    .array(z.string().regex(/\|.*\|\s*(FACT, checked \d{1,2} \w+ \d{4}|EST\b.*|UNKNOWN\b.*)$/))
    .min(1),
});

export type LessonMeta = z.infer<typeof lessonMetaSchema>;

export function parseLesson(markdown: string): { meta: LessonMeta; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error("Lesson has no front matter");
  const raw: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of (match[1] ?? "").split("\n")) {
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      (raw[listKey] as string[]).push((item[1] ?? "").trim());
      continue;
    }
    const pair = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!pair) throw new Error(`Can't read front matter line: ${line}`);
    const key = pair[1]!;
    const value = pair[2] ?? "";
    if (value === "") {
      raw[key] = [];
      listKey = key;
    } else {
      raw[key] = value.trim();
      listKey = null;
    }
  }
  return { meta: lessonMetaSchema.parse(raw), body: markdown.slice(match[0].length) };
}

/** Headings every module must have, in this order. */
export const REQUIRED_SECTIONS = [
  "What you'll be able to do",
  "Before you start",
  "The lesson",
  "Worked example",
  "Common mistakes",
  "Your checklist",
  "Check your understanding",
  "Answers",
  "Sources",
] as const;
