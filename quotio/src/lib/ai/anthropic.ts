// Anthropic-backed generation.
//
// The escalation ladder from §30, in order, with no step skipped:
//
//   1. Generate, then run the output through repair + Zod + structural checks.
//   2. If that fails, tell the model what was wrong and regenerate once.
//   3. If that fails too, build the widget locally from the prompt, and if
//      even that can't be done, clone the closest template.
//
// The user never sees a failure state. They see a widget, and — when we had to
// fall back — one honest sentence saying where it came from.

import Anthropic from "@anthropic-ai/sdk";
import { generationPrompt, repairPrompt, SYSTEM_PROMPT } from "./prompts";
import { parseGeneratedWidget } from "./repair";
import { generateLocally } from "./heuristic";
import type { AIProvider, GenerateOptions, GeneratedWidget } from "./provider";
import { validateStructure, widgetSchemaSchema } from "@/lib/widget/schema";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.AI_MODEL ?? "claude-sonnet-5";
  }

  async generateWidget(prompt: string, options: GenerateOptions = {}): Promise<GeneratedWidget> {
    try {
      const first = await this.ask(generationPrompt(prompt, options.preferredType));
      const parsed = parseGeneratedWidget(first.json);
      if (parsed) return { document: parsed, source: "model" };

      const second = await this.ask(repairPrompt(prompt, first.problem ?? describe(first.json)));
      const repaired = parseGeneratedWidget(second.json);
      if (repaired) return { document: repaired, source: "model" };
    } catch (error) {
      // Rate limits, timeouts, a missing key, a model outage — all the same
      // to the person waiting: they still get a widget.
      console.error("[ai] generation failed, falling back", error);
    }

    const local = generateLocally(prompt, options);
    return {
      ...local,
      note:
        local.note ??
        "We built this one from your description without the model — everything still works, and you can edit it all.",
    };
  }

  private async ask(userPrompt: string): Promise<{ json: unknown; problem?: string }> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const json = extractJson(text);
    if (json === undefined) return { json: undefined, problem: "The reply contained no JSON object." };

    // A precise complaint gets a much better second attempt than "invalid".
    const parsed = widgetSchemaSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { json, problem: `${issue.path.join(".") || "root"}: ${issue.message}` };
    }
    const structural = validateStructure(parsed.data)[0];
    return { json, problem: structural ? `${structural.path}: ${structural.message}` : undefined };
  }
}

/**
 * Pull the JSON object out of a reply.
 *
 * Models are asked for bare JSON and usually comply, but a fenced block or a
 * "Here you go:" preamble shouldn't cost a round trip.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidates = [fenced?.[1], trimmed, sliceOutermostObject(trimmed)];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  return undefined;
}

function sliceOutermostObject(text: string): string | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : undefined;
}

function describe(json: unknown): string {
  if (json === undefined) return "No JSON was returned.";
  return "The JSON did not match the widget schema.";
}
