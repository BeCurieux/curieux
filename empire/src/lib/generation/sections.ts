import { SIDEKICK_PROMPT_KEYS, type AnyModuleOutput, type ModuleKey } from "@/lib/domain/modules";

// Which parts of an output can be regenerated on their own, and how a fresh
// part is merged into the current version. A section is a top-level field;
// for the Sidekick pack each prompt is its own section ("prompt:hero").

export function sectionsOf(module: ModuleKey, output: AnyModuleOutput): string[] {
  const keys = Object.keys(output);
  if (module === "theme_prompts") {
    const prompts = (output as { prompts: { key: string }[] }).prompts;
    return ["beforeYouStart", ...prompts.map((p) => `prompt:${p.key}`)];
  }
  return keys.filter((key) => key !== "missingInformation" && key !== "needsYourInput");
}

export function mergeSection(
  module: ModuleKey,
  base: AnyModuleOutput,
  fresh: AnyModuleOutput,
  section: string,
): AnyModuleOutput {
  if (module === "theme_prompts" && section.startsWith("prompt:")) {
    const key = section.slice("prompt:".length);
    if (!(SIDEKICK_PROMPT_KEYS as readonly string[]).includes(key)) return base;
    const basePrompts = (base as { prompts: { key: string }[] }).prompts;
    const replacement = (fresh as { prompts: { key: string }[] }).prompts.find(
      (p) => p.key === key,
    );
    if (!replacement) return base;
    return {
      ...base,
      prompts: basePrompts.map((p) => (p.key === key ? replacement : p)),
    } as AnyModuleOutput;
  }
  if (!Object.hasOwn(base, section) || !Object.hasOwn(fresh, section)) return base;
  return { ...base, [section]: (fresh as Record<string, unknown>)[section] } as AnyModuleOutput;
}
