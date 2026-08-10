// Provider-agnostic widget generation (brief §30).
//
// The application depends on this interface and never on a model vendor.
// Two implementations ship:
//
//   heuristic  a real natural-language → widget builder that runs locally with
//              no API key. It is not a stub: it reads prices and questions out
//              of the prompt and assembles a working widget, and it is what
//              `npm run dev` uses out of the box.
//   anthropic  the good one, when ANTHROPIC_API_KEY is set.
//
// Both return the same thing and both pass through the same validation, so a
// generation is never trusted just because it came from a model.

import type { WidgetDocument } from "@/lib/widget/schema";
import { HeuristicProvider } from "./heuristic";
import { AnthropicProvider } from "./anthropic";

export interface GenerateOptions {
  /** Nudge the generator when the user picked a card rather than typing. */
  preferredType?: WidgetDocument["type"];
}

export interface GeneratedWidget {
  document: WidgetDocument;
  /**
   * Where this came from, so the UI can be honest about it and the tests can
   * assert which path ran.
   *
   *   model     the language model produced it
   *   parsed    built locally from the words in the prompt
   *   template  we couldn't do better than the nearest ready-made widget
   */
  source: "model" | "parsed" | "template";
  /** Shown once in the builder — plain English, never an error code. */
  note?: string;
}

export interface AIProvider {
  generateWidget(prompt: string, options?: GenerateOptions): Promise<GeneratedWidget>;
}

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const configured =
    process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "heuristic");
  cached = configured === "anthropic" ? new AnthropicProvider() : new HeuristicProvider();
  return cached;
}

/** Test seam. */
export function setAIProvider(provider: AIProvider | null): void {
  cached = provider;
}

export const MAX_PROMPT_LENGTH = 1200;
