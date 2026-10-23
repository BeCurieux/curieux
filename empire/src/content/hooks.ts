import source from "../../content/hooks/hooks.json";

// 100 Faceless Hooks (Her Little Empire, v1.1, October 2026), word for word.
// content/hooks/hooks.json was extracted from the product's content file and
// checked line by line against it (content/REGISTER.md). Categories are the
// product's seven goals. Hooks are templates: [brackets] are hers to fill.

export interface Hook {
  id: string;
  text: string;
  category: HookGoal;
  notes: string;
}

export const HOOK_GOALS = [
  "Stop the scroll",
  "Make them save",
  "Make them comment",
  "Make them share",
  "Build trust while faceless",
  "Soft sell / lead to the offer",
  "Story slides",
] as const;
export type HookGoal = (typeof HOOK_GOALS)[number];

export const HOOKS: Hook[] = (
  source as { id: string; text: string; category: string; notes: string }[]
).map((h) => ({
  id: h.id,
  text: h.text,
  category: h.category as HookGoal,
  notes: h.notes,
}));

// Several hooks are written for Her Little Empire's own audience (side
// income, mums, nap time). A store's social kit skips those.
const HLE_SPECIFIC = /side income|\bmum\b|nap time|school pick-up|the woman|your week\?/i;

export function hooksFor(goal: HookGoal, { storeSafe = true } = {}): Hook[] {
  return HOOKS.filter((h) => h.category === goal && (!storeSafe || !HLE_SPECIFIC.test(h.text)));
}

/** Fills the common blanks we know; leaves the rest as [brackets] for her. */
export function fillHook(text: string, fill: Record<string, string>): string {
  return text.replace(/\[([^\]]+)\]/g, (whole, key: string) => fill[key.toLowerCase()] ?? whole);
}
